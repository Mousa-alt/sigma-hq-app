# Message Classification - AI-powered message analysis

import re
import json

import vertexai
from vertexai.generative_models import GenerativeModel

from config import GCP_PROJECT, GCP_LOCATION
from utils.date_utils import extract_deadline, extract_assignee

# Initialize Vertex AI
VERTEX_AI_ENABLED = False
try:
    vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    VERTEX_AI_ENABLED = True
except Exception as e:
    print(f"Vertex AI init error: {e}")


def classify_message(message_text, sender, group_name, projects, group_config, chat_id=None):
    """Use Vertex AI to classify WhatsApp message
    
    Args:
        message_text: The message content
        sender: Sender identifier
        group_name: Name of the WhatsApp group
        projects: List of registered projects
        group_config: Configuration for this group (type, priority, etc.)
        chat_id: Chat ID for sending responses
    
    Returns:
        dict: Classification result with project_name, is_actionable, etc.
    """
    # Import here to avoid circular dependency
    from handlers.commands import handle_command
    
    mapped_project = group_config.get('project') if group_config else None
    group_type = group_config.get('type', 'internal') if group_config else 'internal'
    group_priority = group_config.get('priority', 'medium') if group_config else 'medium'
    
    # Command groups get special handling
    if group_type == 'command':
        return handle_command(message_text, sender, projects, chat_id)
    
    # Extract deadline and assignee from text
    deadline = extract_deadline(message_text)
    assignee = extract_assignee(message_text)
    
    # Use fallback if Vertex AI not available
    if not VERTEX_AI_ENABLED:
        result = fallback_classify(message_text, group_name, projects, mapped_project, group_type, group_priority)
        if deadline:
            result['deadline'] = deadline
        if assignee:
            result['assigned_to'] = assignee
        return result
    
    try:
        model = GenerativeModel('gemini-1.5-flash-001')
        
        project_list = "\n".join([
            f"- {p['name']} (Client: {p.get('client', 'N/A')})" 
            for p in projects
        ])
        project_hint = f"\nNOTE: This group is mapped to project '{mapped_project}'." if mapped_project else ""
        
        prompt = f"""Classify this WhatsApp message for a construction company.

PROJECTS:
{project_list}

GROUP TYPE: {group_type}
{project_hint}

MESSAGE:
Group: {group_name}
From: {sender}
Text: {message_text[:1500]}

RESPOND JSON ONLY:
{{
  "project_name": "exact project name or null",
  "is_actionable": true/false,
  "action_type": "decision_needed|approval_request|task|info|question|deadline|delivery|invoice|none",
  "summary": "one line English summary",
  "urgency": "high|medium|low",
  "assigned_to": "person name or null",
  "deadline": "YYYY-MM-DD or null"
}}
"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            
            # Use mapped project if not detected
            if not result.get('project_name') and mapped_project and mapped_project != '__general__':
                result['project_name'] = mapped_project
            
            result['channel_type'] = group_type
            
            # Override with extracted values if AI didn't find them
            if deadline and not result.get('deadline'):
                result['deadline'] = deadline
            if assignee and not result.get('assigned_to'):
                result['assigned_to'] = assignee
            
            return result
            
    except Exception as e:
        print(f"AI classification error: {e}")
    
    # Fallback to keyword-based classification
    result = fallback_classify(message_text, group_name, projects, mapped_project, group_type, group_priority)
    if deadline:
        result['deadline'] = deadline
    if assignee:
        result['assigned_to'] = assignee
    return result


def fallback_classify(message_text, group_name, projects, mapped_project=None, 
                      group_type='internal', group_priority='medium'):
    """Fallback keyword-based classification when AI is unavailable"""
    lower_text = message_text.lower()
    lower_group = group_name.lower() if group_name else ''
    
    # Try to match project
    matched_project = mapped_project
    if not matched_project or matched_project == '__general__':
        for project in projects:
            project_name = project['name'].lower()
            if project_name in lower_group or project_name in lower_text:
                matched_project = project['name']
                break
    
    # Check for actionable keywords
    action_keywords = [
        'please', 'urgent', 'asap', 'need', 'required', 
        'confirm', 'approve', 'send', 'check', 'review', 'deadline'
    ]
    is_actionable = any(kw in lower_text for kw in action_keywords)
    
    # Determine urgency
    urgency = group_priority
    if any(kw in lower_text for kw in ['urgent', 'asap', 'immediately', 'today', 'عاجل']):
        urgency = 'high'
    
    # Determine action type
    action_type = 'info'
    if any(kw in lower_text for kw in ['approve', 'approval', 'confirm']):
        action_type = 'approval_request'
    elif any(kw in lower_text for kw in ['decide', 'choose', 'which', 'option']):
        action_type = 'decision_needed'
    elif any(kw in lower_text for kw in ['invoice', 'payment', 'pay']):
        action_type = 'invoice'
    elif is_actionable:
        action_type = 'task'
    
    return {
        'project_name': matched_project if matched_project != '__general__' else None,
        'is_actionable': is_actionable,
        'action_type': action_type,
        'summary': message_text[:100],
        'urgency': urgency,
        'channel_type': group_type
    }
