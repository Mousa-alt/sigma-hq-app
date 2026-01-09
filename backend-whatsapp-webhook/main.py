import os
import json
import re
from datetime import datetime, timezone
import functions_framework
from flask import jsonify
from google.cloud import firestore
import vertexai
from vertexai.generative_models import GenerativeModel

# Configuration
GCP_PROJECT = os.environ.get('GCP_PROJECT', 'sigma-hq-technical-office')
GCP_LOCATION = os.environ.get('GCP_LOCATION', 'us-central1')
FIREBASE_PROJECT = os.environ.get('FIREBASE_PROJECT', 'sigma-hq-38843')
APP_ID = os.environ.get('APP_ID', 'sigma-hq-production')

# Initialize clients
db = firestore.Client(project=FIREBASE_PROJECT)

# Initialize Vertex AI
try:
    vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    VERTEX_AI_ENABLED = True
except Exception as e:
    print(f"Vertex AI init error: {e}")
    VERTEX_AI_ENABLED = False

def get_registered_projects():
    """Get list of registered projects from Firestore"""
    projects = []
    try:
        docs = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('projects').stream()
        for doc in docs:
            data = doc.to_dict()
            projects.append({
                'id': doc.id,
                'name': data.get('name', ''),
                'client': data.get('client', ''),
                'keywords': data.get('keywords', [])
            })
    except Exception as e:
        print(f"Error loading projects: {e}")
    return projects

def get_group_mappings():
    """Get WhatsApp group mappings from Firestore"""
    mappings = {}
    try:
        docs = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_groups').stream()
        for doc in docs:
            data = doc.to_dict()
            group_name = data.get('name', '')
            if group_name:
                mappings[group_name.lower()] = {
                    'project': data.get('project'),
                    'type': data.get('type', 'internal'),
                    'priority': data.get('priority', 'medium'),
                    'autoExtractTasks': data.get('autoExtractTasks', True)
                }
    except Exception as e:
        print(f"Error loading group mappings: {e}")
    return mappings

def classify_message(message_text, sender, group_name, projects, group_config):
    """Use Vertex AI to classify WhatsApp message"""
    mapped_project = group_config.get('project') if group_config else None
    group_type = group_config.get('type', 'internal') if group_config else 'internal'
    group_priority = group_config.get('priority', 'medium') if group_config else 'medium'
    
    if group_type == 'command':
        return handle_command(message_text, sender, projects)
    
    if not VERTEX_AI_ENABLED:
        return fallback_classify(message_text, group_name, projects, mapped_project, group_type, group_priority)
    
    try:
        model = GenerativeModel('gemini-1.5-flash-001')
        
        project_list = "\n".join([f"- {p['name']} (Client: {p.get('client', 'N/A')})" for p in projects])
        project_hint = f"\nNOTE: This group is mapped to project '{mapped_project}'. Use this unless message clearly refers to a different project." if mapped_project else ""
        
        prompt = f"""Classify this WhatsApp message for a construction company.

REGISTERED PROJECTS:
{project_list}

GROUP TYPE: {group_type}
GROUP PRIORITY: {group_priority}
{project_hint}

MESSAGE:
Group: {group_name}
From: {sender}
Text: {message_text[:1500]}

RESPOND IN JSON ONLY:
{{
  "project_name": "exact project name from list, or null",
  "is_actionable": true/false,
  "action_type": "decision_needed|approval_request|task|info|question|deadline|delivery|invoice|none",
  "summary": "one line summary in English",
  "urgency": "high|medium|low",
  "assigned_to": "person name if @mentioned or clearly assigned, else null",
  "deadline": "extracted deadline if mentioned, else null",
  "channel_type": "{group_type}"
}}

RULES:
- Match project by group name, client name, or message content
- is_actionable = true if someone needs to do something
- action_type: decision_needed for choices, approval_request for sign-offs, task for assignments
- Urgency: high if urgent/ASAP/deadline soon, medium for normal requests, low for FYI
- Summarize in English even if message is Arabic
"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            if not result.get('project_name') and mapped_project and mapped_project != '__general__':
                result['project_name'] = mapped_project
            result['channel_type'] = group_type
            return result
    except Exception as e:
        print(f"AI classification error: {e}")
    
    return fallback_classify(message_text, group_name, projects, mapped_project, group_type, group_priority)

def handle_command(message_text, sender, projects):
    """Handle Command Group messages"""
    lower_text = message_text.lower().strip()
    
    task_match = re.match(r'task:\s*(.+?)\s*-\s*(.+)', message_text, re.IGNORECASE)
    if task_match:
        project_hint = task_match.group(1).strip()
        task_desc = task_match.group(2).strip()
        
        matched_project = None
        for p in projects:
            if project_hint.lower() in p['name'].lower():
                matched_project = p['name']
                break
        
        return {
            'project_name': matched_project,
            'is_actionable': True,
            'action_type': 'task',
            'summary': task_desc,
            'urgency': 'medium',
            'is_command': True,
            'command_type': 'create_task',
            'channel_type': 'command'
        }
    
    query_match = re.search(r"what'?s?\s+(pending|status|open)\s+(on|for|in)\s+(.+)", lower_text, re.IGNORECASE)
    if query_match:
        project_hint = query_match.group(3).strip().rstrip('?')
        return {
            'project_name': project_hint,
            'is_actionable': False,
            'action_type': 'query',
            'summary': f"Query: pending items for {project_hint}",
            'urgency': 'low',
            'is_command': True,
            'command_type': 'query_pending',
            'channel_type': 'command'
        }
    
    if 'summarize' in lower_text or 'summary' in lower_text:
        return {
            'project_name': None,
            'is_actionable': False,
            'action_type': 'query',
            'summary': 'Request: weekly summary',
            'urgency': 'low',
            'is_command': True,
            'command_type': 'summarize',
            'channel_type': 'command'
        }
    
    return {
        'project_name': None,
        'is_actionable': False,
        'action_type': 'info',
        'summary': message_text[:100],
        'urgency': 'low',
        'is_command': False,
        'channel_type': 'command'
    }

def fallback_classify(message_text, group_name, projects, mapped_project=None, group_type='internal', group_priority='medium'):
    """Fallback keyword-based classification"""
    lower_text = message_text.lower()
    lower_group = group_name.lower() if group_name else ''
    
    matched_project = mapped_project
    if not matched_project or matched_project == '__general__':
        for project in projects:
            project_name = project['name'].lower()
            if project_name in lower_group or project_name in lower_text:
                matched_project = project['name']
                break
    
    action_keywords = ['please', 'urgent', 'asap', 'need', 'required', 'confirm', 'approve', 'send', 'check', 'review', 'deadline']
    is_actionable = any(kw in lower_text for kw in action_keywords)
    
    urgency = group_priority
    if any(kw in lower_text for kw in ['urgent', 'asap', 'immediately', 'today']):
        urgency = 'high'
    
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

def save_message(message_data, classification):
    """Save classified message to Firestore"""
    try:
        collection_path = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')
        
        doc_data = {
            'message_id': message_data.get('id', ''),
            'group_name': message_data.get('group_name', ''),
            'group_id': message_data.get('group_id', ''),
            'sender': message_data.get('sender', ''),
            'sender_name': message_data.get('sender_name', ''),
            'text': message_data.get('text', ''),
            'timestamp': message_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'project_name': classification.get('project_name'),
            'is_actionable': classification.get('is_actionable', False),
            'action_type': classification.get('action_type', 'info'),
            'summary': classification.get('summary', ''),
            'urgency': classification.get('urgency', 'low'),
            'channel_type': classification.get('channel_type', 'internal'),
            'assigned_to': classification.get('assigned_to'),
            'deadline': classification.get('deadline'),
            'is_command': classification.get('is_command', False),
            'command_type': classification.get('command_type'),
            'status': 'pending' if classification.get('is_actionable') else 'info',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        collection_path.add(doc_data)
        print(f"Saved message: {doc_data['summary'][:50]}")
        return True
    except Exception as e:
        print(f"Error saving message: {e}")
        return False

def save_debug_payload(payload, chat_id):
    """Save raw payload to Firestore for debugging"""
    try:
        debug_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('webhook_debug')
        debug_ref.add({
            'chat_id': chat_id,
            'payload': json.dumps(payload, default=str)[:10000],
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
        print(f"DEBUG: Saved payload for {chat_id}")
    except Exception as e:
        print(f"Error saving debug: {e}")

def auto_add_group(group_name, group_id):
    """Auto-add new group to mappings"""
    try:
        group_doc_id = re.sub(r'[^a-zA-Z0-9]', '_', group_name)[:50]
        group_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_groups').document(group_doc_id)
        
        if not group_ref.get().exists:
            group_ref.set({
                'name': group_name,
                'group_id': group_id,
                'project': None,
                'type': 'internal',
                'priority': 'medium',
                'autoExtractTasks': True,
                'createdAt': datetime.now(timezone.utc).isoformat()
            })
            print(f"Auto-added group: {group_name}")
    except Exception as e:
        print(f"Error auto-adding group: {e}")

@functions_framework.http
def whatsapp_webhook(request):
    """Handle incoming WhatsApp webhooks from Waha"""
    if request.method == 'OPTIONS':
        return ('', 204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        })
    
    headers = {'Access-Control-Allow-Origin': '*'}
    
    if request.method == 'GET':
        return (jsonify({
            'status': 'WhatsApp Webhook v2.2 - Debug logging',
            'features': ['group_mapping', 'command_group', 'enhanced_classification', 'debug_logging'],
            'vertex_ai_enabled': VERTEX_AI_ENABLED,
            'firebase_project': FIREBASE_PROJECT
        }), 200, headers)
    
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            
            event = data.get('event', '')
            payload = data.get('payload', {})
            
            if event != 'message':
                return (jsonify({'status': 'ignored', 'event': event}), 200, headers)
            
            chat_id = payload.get('chatId', '') or payload.get('from', '')
            is_group = '@g.us' in chat_id
            
            # DEBUG: Save raw payload to see what Waha sends
            save_debug_payload(payload, chat_id)
            
            # Extract group name - try ALL possible fields
            group_name = ''
            sender_name = ''
            _data = payload.get('_data', {})
            
            # Log what we're seeing
            print(f"DEBUG chat_id: {chat_id}")
            print(f"DEBUG is_group: {is_group}")
            print(f"DEBUG _data keys: {list(_data.keys()) if _data else 'None'}")
            
            if is_group:
                chat_info = _data.get('chat', {})
                print(f"DEBUG chat_info keys: {list(chat_info.keys()) if chat_info else 'None'}")
                print(f"DEBUG chat_info: {chat_info}")
                
                # Try ALL possible fields for group name
                group_name = (
                    chat_info.get('name', '') or 
                    chat_info.get('subject', '') or 
                    chat_info.get('formattedTitle', '') or 
                    _data.get('chat', {}).get('name', '') or
                    payload.get('chatName', '') or
                    payload.get('notifyName', '') or  # Sometimes Waha puts it here
                    ''
                )
                
                # If still empty, use chat_id
                if not group_name:
                    group_name = chat_id.replace('@g.us', '')
                
                # Sender name
                sender_name = _data.get('notifyName', '') or payload.get('from', '').split('@')[0]
                
                print(f"DEBUG extracted group_name: {group_name}")
                print(f"DEBUG extracted sender_name: {sender_name}")
            else:
                sender_name = _data.get('notifyName', '') or payload.get('from', '').split('@')[0]
            
            sender = payload.get('from', '')
            if not sender_name:
                sender_name = sender.split('@')[0]
            
            message_data = {
                'id': payload.get('id', {}).get('id', '') if isinstance(payload.get('id'), dict) else payload.get('id', ''),
                'text': payload.get('body', ''),
                'sender': sender,
                'sender_name': sender_name,
                'group_name': group_name,
                'group_id': chat_id,
                'timestamp': payload.get('timestamp', '')
            }
            
            if not message_data['text']:
                return (jsonify({'status': 'skipped', 'reason': 'no text'}), 200, headers)
            
            if is_group and group_name:
                auto_add_group(group_name, chat_id)
            
            group_mappings = get_group_mappings()
            group_config = group_mappings.get(group_name.lower()) if group_name else None
            projects = get_registered_projects()
            
            classification = classify_message(
                message_data['text'],
                message_data['sender'],
                message_data['group_name'],
                projects,
                group_config
            )
            
            save_message(message_data, classification)
            
            return (jsonify({
                'status': 'processed',
                'group_name': group_name,
                'sender_name': sender_name,
                'chat_id': chat_id,
                'project': classification.get('project_name'),
                'actionable': classification.get('is_actionable'),
                'action_type': classification.get('action_type'),
                'channel_type': classification.get('channel_type'),
                'summary': classification.get('summary', '')[:50]
            }), 200, headers)
            
        except Exception as e:
            print(f"Webhook error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
