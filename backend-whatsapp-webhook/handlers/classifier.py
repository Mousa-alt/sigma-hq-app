# Message Classifier - AI-powered message classification using Vertex AI

import re
import json
from datetime import datetime, timezone, timedelta

import vertexai
from vertexai.generative_models import GenerativeModel

from config import GCP_PROJECT, GCP_LOCATION

# Initialize Vertex AI
try:
    vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    VERTEX_AI_ENABLED = True
except Exception as e:
    print(f"Vertex AI init error: {e}")
    VERTEX_AI_ENABLED = False


def extract_deadline(text):
    """Extract deadline from message text
    
    Supports:
    - today/tomorrow
    - Day names (Sunday, Monday, etc.)
    - Date formats (DD/MM, DD-MM-YYYY)
    - Arabic day names
    """
    lower = text.lower()
    today = datetime.now(timezone.utc)
    
    # Today/Tomorrow
    if 'today' in lower or 'اليوم' in lower:
        return today.strftime('%Y-%m-%d')
    if 'tomorrow' in lower or 'بكره' in lower or 'غدا' in lower:
        return (today + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Day names
    days = {
        'sunday': 6, 'monday': 0, 'tuesday': 1, 'wednesday': 2, 
        'thursday': 3, 'friday': 4, 'saturday': 5,
        'الأحد': 6, 'الاثنين': 0, 'الثلاثاء': 1, 'الأربعاء': 2, 
        'الخميس': 3, 'الجمعة': 4, 'السبت': 5
    }
    for day, num in days.items():
        if day in lower:
            days_ahead = num - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')
    
    # Date patterns
    date_match = re.search(r'(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?', text)
    if date_match:
        day = int(date_match.group(1))
        month = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else today.year
        if year < 100:
            year += 2000
        try:
            return f"{year}-{month:02d}-{day:02d}"
        except:
            pass
    
    return None


def extract_assignee(text):
    """Extract assigned person from message
    
    Supports:
    - @mentions
    - "to/for/assign to [Name]" patterns
    """
    # @mention
    mention = re.search(r'@(\w+)', text)
    if mention:
        return mention.group(1)
    
    # Assign patterns
    assign_match = re.search(r'(?:to|for|assign(?:ed)?(?:\s+to)?)\s+([A-Z][a-z]+)', text)
    if assign_match:
        return assign_match.group(1)
    
    return None


def classify_message(message_text, sender, group_name, projects, group_config, chat_id=None):
    """Use Vertex AI to classify WhatsApp message
    
    Args:
        message_text: The message content
        sender: Sender identifier
        group_name: Name of the WhatsApp group
        projects: List of registered projects
        group_config: Configuration for this group (type, priority, etc.)
        chat_id: Chat ID for command responses
    
    Returns:
        dict: Classification result with project_name, is_actionable, action_type, etc.
    """
    from handlers.commands import handle_command
    
    mapped_project = group_config.get('project') if group_config else None
    group_type = group_config.get('type', 'internal') if group_config else 'internal'
    group_priority = group_config.get('priority', 'medium') if group_config else 'medium'
    
    # Command groups get special handling
    if group_type == 'command':
        return handle_command(message_text, sender, projects, chat_id)
    
    # Extract deadline and assignee from message
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
        
        project_list = "\n".join([f"- {p['name']} (Client: {p.get('client', 'N/A')})" for p in projects])
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
        
        # Parse JSON from response
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            
            # Apply mapped project if not detected
            if not result.get('project_name') and mapped_project and mapped_project != '__general__':
                result['project_name'] = mapped_project
            
            result['channel_type'] = group_type
            
            # Apply extracted deadline/assignee if AI didn't find them
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
    """Fallback keyword-based classification when AI is unavailable
    
    Uses simple keyword matching to determine:
    - Project name (from group name or message content)
    - Whether message is actionable
    - Action type
    - Urgency level
    """
    lower_text = message_text.lower()
    lower_group = group_name.lower() if group_name else ''
    
    # Determine project
    matched_project = mapped_project
    if not matched_project or matched_project == '__general__':
        for project in projects:
            project_name = project['name'].lower()
            if project_name in lower_group or project_name in lower_text:
                matched_project = project['name']
                break
    
    # Check if actionable
    action_keywords = [
        'please', 'urgent', 'asap', 'need', 'required', 'confirm', 
        'approve', 'send', 'check', 'review', 'deadline'
    ]
    is_actionable = any(kw in lower_text for kw in action_keywords)
    
    # Determine urgency
    urgency = group_priority
    urgent_keywords = ['urgent', 'asap', 'immediately', 'today', 'عاجل']
    if any(kw in lower_text for kw in urgent_keywords):
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
