import os
import json
import re
import requests
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
WAHA_API_URL = os.environ.get('WAHA_API_URL', 'http://34.78.137.109:3000')
WAHA_API_KEY = os.environ.get('WAHA_API_KEY', 'sigma2026')

# Initialize clients
db = firestore.Client(project=FIREBASE_PROJECT)

# Initialize Vertex AI
try:
    vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    VERTEX_AI_ENABLED = True
except Exception as e:
    print(f"Vertex AI init error: {e}")
    VERTEX_AI_ENABLED = False

def get_group_name_from_waha(group_id):
    """Fetch group name from Waha API"""
    headers = {'X-Api-Key': WAHA_API_KEY} if WAHA_API_KEY else {}
    
    try:
        # Try to get group info from Waha
        url = f"{WAHA_API_URL}/api/default/groups/{group_id}"
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            group_name = data.get('subject') or data.get('name') or data.get('id', {}).get('user', '')
            print(f"Waha API returned group name: {group_name}")
            return group_name
    except Exception as e:
        print(f"Error fetching group from Waha: {e}")
    
    # Fallback: try chats endpoint
    try:
        url = f"{WAHA_API_URL}/api/default/chats/{group_id}"
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            group_name = data.get('name') or data.get('subject') or ''
            print(f"Waha chats API returned: {group_name}")
            return group_name
    except Exception as e:
        print(f"Error fetching chat from Waha: {e}")
    
    return None

def get_cached_group_name(group_id):
    """Get cached group name from Firestore"""
    try:
        # Check if we have this group cached
        docs = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_groups').where('group_id', '==', group_id).stream()
        for doc in docs:
            data = doc.to_dict()
            name = data.get('name', '')
            # Only return if it's a real name (not just the ID)
            if name and not name.replace('@g.us', '').isdigit():
                return name
    except Exception as e:
        print(f"Error getting cached group: {e}")
    return None

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
            group_id = data.get('group_id', '')
            if group_name:
                mappings[group_name.lower()] = {
                    'project': data.get('project'),
                    'type': data.get('type', 'internal'),
                    'priority': data.get('priority', 'medium'),
                    'autoExtractTasks': data.get('autoExtractTasks', True)
                }
            # Also map by group_id
            if group_id:
                mappings[group_id.lower()] = {
                    'project': data.get('project'),
                    'type': data.get('type', 'internal'),
                    'priority': data.get('priority', 'medium'),
                    'autoExtractTasks': data.get('autoExtractTasks', True),
                    'name': group_name
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

def auto_add_group(group_name, group_id):
    """Auto-add new group to mappings"""
    try:
        # Use group_id as document ID to avoid duplicates
        group_doc_id = re.sub(r'[^a-zA-Z0-9]', '_', group_id)[:50]
        group_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_groups').document(group_doc_id)
        
        existing = group_ref.get()
        if not existing.exists:
            group_ref.set({
                'name': group_name,
                'group_id': group_id,
                'project': None,
                'type': 'internal',
                'priority': 'medium',
                'autoExtractTasks': True,
                'createdAt': datetime.now(timezone.utc).isoformat()
            })
            print(f"Auto-added group: {group_name} ({group_id})")
        else:
            # Update name if we got a better one (not just ID)
            existing_data = existing.to_dict()
            existing_name = existing_data.get('name', '')
            if group_name and not group_name.replace('@g.us', '').isdigit() and existing_name.replace('@g.us', '').isdigit():
                group_ref.update({'name': group_name})
                print(f"Updated group name: {existing_name} -> {group_name}")
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
            'status': 'WhatsApp Webhook v2.4 - Fixed Waha URL',
            'features': ['group_mapping', 'command_group', 'waha_api_lookup'],
            'waha_url': WAHA_API_URL,
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
            
            # Extract sender name
            _data = payload.get('_data', {})
            sender_name = _data.get('notifyName', '') or payload.get('from', '').split('@')[0]
            sender = payload.get('from', '')
            
            # Get group name - Waha webhook doesn't include it, so we need to fetch it
            group_name = ''
            if is_group:
                # 1. Check cache first
                group_name = get_cached_group_name(chat_id)
                print(f"Cached group name for {chat_id}: {group_name}")
                
                # 2. If not cached or just ID, fetch from Waha API
                if not group_name or group_name.replace('@g.us', '').isdigit():
                    waha_name = get_group_name_from_waha(chat_id)
                    if waha_name:
                        group_name = waha_name
                        print(f"Got group name from Waha: {group_name}")
                
                # 3. Fallback to group ID
                if not group_name:
                    group_name = chat_id.replace('@g.us', '')
                    print(f"Using fallback group name: {group_name}")
            
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
            
            # Auto-add/update group
            if is_group and group_name:
                auto_add_group(group_name, chat_id)
            
            # Get mappings - now also checks by group_id
            group_mappings = get_group_mappings()
            group_config = group_mappings.get(group_name.lower()) or group_mappings.get(chat_id.lower())
            
            # If we have a stored name from mapping, use it
            if group_config and group_config.get('name'):
                stored_name = group_config.get('name')
                if stored_name and not stored_name.replace('@g.us', '').isdigit():
                    group_name = stored_name
                    message_data['group_name'] = group_name
            
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
