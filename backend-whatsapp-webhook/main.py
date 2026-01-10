import os
import json
import re
import requests
from datetime import datetime, timezone, timedelta
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
COMMAND_GROUP_ID = os.environ.get('COMMAND_GROUP_ID', '')

# Initialize clients
db = firestore.Client(project=FIREBASE_PROJECT)

# Initialize Vertex AI
try:
    vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    VERTEX_AI_ENABLED = True
except Exception as e:
    print(f"Vertex AI init error: {e}")
    VERTEX_AI_ENABLED = False


# =============================================================================
# WAHA API FUNCTIONS
# =============================================================================

def get_group_name_from_waha(group_id):
    """Fetch group name from Waha API"""
    headers = {'X-Api-Key': WAHA_API_KEY} if WAHA_API_KEY else {}
    
    try:
        url = f"{WAHA_API_URL}/api/default/groups/{group_id}"
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            group_name = data.get('subject') or data.get('name') or data.get('id', {}).get('user', '')
            print(f"Waha API returned group name: {group_name}")
            return group_name
    except Exception as e:
        print(f"Error fetching group from Waha: {e}")
    
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


def send_whatsapp_message(chat_id, message):
    """Send a message via Waha API"""
    headers = {
        'X-Api-Key': WAHA_API_KEY,
        'Content-Type': 'application/json'
    }
    
    try:
        url = f"{WAHA_API_URL}/api/sendText"
        payload = {
            'chatId': chat_id,
            'text': message,
            'session': 'default'
        }
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            print(f"Message sent to {chat_id}")
            return True
        else:
            print(f"Failed to send message: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error sending message: {e}")
    
    return False


# =============================================================================
# FIRESTORE QUERY FUNCTIONS
# =============================================================================

def get_cached_group_name(group_id):
    """Get cached group name from Firestore"""
    try:
        docs = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_groups').where('group_id', '==', group_id).stream()
        for doc in docs:
            data = doc.to_dict()
            name = data.get('name', '')
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
                'location': data.get('location', ''),
                'status': data.get('status', 'active'),
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


def get_project_stats(project_name):
    """Get statistics for a specific project"""
    stats = {
        'pending_tasks': 0,
        'high_urgency': 0,
        'recent_messages': 0,
        'recent_emails': 0,
        'last_activity': None
    }
    
    try:
        # Count pending actionable messages
        messages = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .stream()
        
        for msg in messages:
            stats['pending_tasks'] += 1
            data = msg.to_dict()
            if data.get('urgency') == 'high':
                stats['high_urgency'] += 1
            
            created = data.get('created_at')
            if created:
                if not stats['last_activity'] or created > stats['last_activity']:
                    stats['last_activity'] = created
        
        # Count recent messages (last 24h)
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        recent = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('created_at', '>=', yesterday)\
            .stream()
        
        stats['recent_messages'] = sum(1 for _ in recent)
        
        # Count recent emails
        emails = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('emails')\
            .where('project_name', '==', project_name)\
            .where('created_at', '>=', yesterday)\
            .stream()
        
        stats['recent_emails'] = sum(1 for _ in emails)
        
    except Exception as e:
        print(f"Error getting project stats: {e}")
    
    return stats


def get_all_pending_items():
    """Get all pending actionable items across all projects"""
    items = []
    try:
        messages = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(20)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'urgency': data.get('urgency', 'medium'),
                'type': data.get('action_type', 'task'),
                'created': data.get('created_at', '')
            })
    except Exception as e:
        print(f"Error getting pending items: {e}")
    
    return items


def get_urgent_items():
    """Get all high urgency items"""
    items = []
    try:
        messages = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('urgency', '==', 'high')\
            .where('status', '==', 'pending')\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(15)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'type': data.get('action_type', 'task'),
                'created': data.get('created_at', '')
            })
    except Exception as e:
        print(f"Error getting urgent items: {e}")
    
    return items


def get_today_items():
    """Get items created today or due today"""
    items = []
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        messages = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('is_actionable', '==', True)\
            .where('created_at', '>=', today_start)\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(20)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'urgency': data.get('urgency', 'medium'),
                'type': data.get('action_type', 'task'),
                'status': data.get('status', 'pending')
            })
    except Exception as e:
        print(f"Error getting today items: {e}")
    
    return items


# =============================================================================
# SMART COMMAND HANDLER
# =============================================================================

def handle_command(message_text, sender, projects, chat_id):
    """Handle Command Group messages with smart responses"""
    text = message_text.strip()
    lower_text = text.lower()
    
    response_message = None
    classification = {
        'project_name': None,
        'is_actionable': False,
        'action_type': 'query',
        'summary': '',
        'urgency': 'low',
        'is_command': True,
        'command_type': None,
        'channel_type': 'command'
    }
    
    # =========================================================================
    # QUICK STATUS - Just project name
    # =========================================================================
    matched_project = None
    for p in projects:
        if p['name'].lower() == lower_text or p['name'].lower() in lower_text:
            matched_project = p
            break
    
    if matched_project and len(lower_text.split()) <= 3:
        stats = get_project_stats(matched_project['name'])
        
        status_emoji = "🟢" if stats['pending_tasks'] == 0 else "🟡" if stats['pending_tasks'] < 5 else "🔴"
        
        response_message = f"""📊 *{matched_project['name']}* {status_emoji}

📍 {matched_project.get('location', 'N/A')} | 👤 {matched_project.get('client', 'N/A')}

📋 *Pending Tasks:* {stats['pending_tasks']}
🔴 *High Urgency:* {stats['high_urgency']}
💬 *Messages (24h):* {stats['recent_messages']}
📧 *Emails (24h):* {stats['recent_emails']}

🕐 Last Activity: {stats['last_activity'][:10] if stats['last_activity'] else 'N/A'}"""
        
        classification['command_type'] = 'project_status'
        classification['project_name'] = matched_project['name']
        classification['summary'] = f"Status query for {matched_project['name']}"
    
    # =========================================================================
    # TODAY - What's happening today
    # =========================================================================
    elif lower_text in ['today', 'اليوم', "what's today", 'whats today']:
        items = get_today_items()
        
        if items:
            lines = [f"📅 *Today's Items* ({len(items)})\n"]
            for item in items[:10]:
                urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                status_icon = "✅" if item['status'] == 'done' else "⏳"
                lines.append(f"{urgency_icon} {status_icon} *{item['project']}*: {item['summary'][:40]}")
            response_message = "\n".join(lines)
        else:
            response_message = "📅 *Today*\n\n✨ No new actionable items today!"
        
        classification['command_type'] = 'today'
        classification['summary'] = "Today's items query"
    
    # =========================================================================
    # URGENT - High priority items
    # =========================================================================
    elif lower_text in ['urgent', 'عاجل', 'high priority', 'critical']:
        items = get_urgent_items()
        
        if items:
            lines = [f"🔴 *Urgent Items* ({len(items)})\n"]
            for item in items[:10]:
                lines.append(f"• *{item['project']}*: {item['summary'][:40]}")
            response_message = "\n".join(lines)
        else:
            response_message = "🔴 *Urgent Items*\n\n✨ No high-urgency items!"
        
        classification['command_type'] = 'urgent'
        classification['summary'] = "Urgent items query"
    
    # =========================================================================
    # PENDING - All pending tasks
    # =========================================================================
    elif lower_text in ['pending', 'معلق', 'open', 'tasks', 'مهام']:
        items = get_all_pending_items()
        
        if items:
            # Group by project
            by_project = {}
            for item in items:
                proj = item['project'] or 'Unassigned'
                if proj not in by_project:
                    by_project[proj] = []
                by_project[proj].append(item)
            
            lines = [f"📋 *Pending Items* ({len(items)})\n"]
            for proj, proj_items in list(by_project.items())[:5]:
                lines.append(f"\n*{proj}* ({len(proj_items)})")
                for item in proj_items[:3]:
                    urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                    lines.append(f"  {urgency_icon} {item['summary'][:35]}")
            
            response_message = "\n".join(lines)
        else:
            response_message = "📋 *Pending Items*\n\n✨ All clear! No pending tasks."
        
        classification['command_type'] = 'pending'
        classification['summary'] = "Pending items query"
    
    # =========================================================================
    # SUMMARY - Weekly/Daily summary
    # =========================================================================
    elif any(kw in lower_text for kw in ['summary', 'summarize', 'ملخص', 'report']):
        pending = get_all_pending_items()
        urgent = get_urgent_items()
        today = get_today_items()
        
        response_message = f"""📊 *Command Center Summary*
        
🔴 Urgent: {len(urgent)}
📋 Pending: {len(pending)}
📅 Today: {len(today)}

Top Priorities:"""
        
        for item in urgent[:3]:
            response_message += f"\n• *{item['project']}*: {item['summary'][:30]}"
        
        if not urgent:
            response_message += "\n✨ No urgent items!"
        
        classification['command_type'] = 'summary'
        classification['summary'] = "Summary requested"
    
    # =========================================================================
    # HELP - Show available commands
    # =========================================================================
    elif lower_text in ['help', 'مساعدة', 'commands', '?']:
        response_message = """🤖 *Command Center Help*

*Quick Status:*
• `ProjectName` - Get project snapshot
• `today` - Today's items
• `urgent` - High priority items
• `pending` - All pending tasks
• `summary` - Overview report

*Create Tasks:*
• `task: ProjectName - Description`
• `note: ProjectName - Info to log`

*Queries:*
• `what's pending on ProjectName?`
• `status ProjectName`

*Coming Soon:*
• Document search
• Team broadcasts
• Daily digest"""
        
        classification['command_type'] = 'help'
        classification['summary'] = "Help requested"
    
    # =========================================================================
    # TASK CREATION - task: Project - Description
    # =========================================================================
    elif lower_text.startswith('task:'):
        task_match = re.match(r'task:\s*(.+?)\s*-\s*(.+)', text, re.IGNORECASE)
        if task_match:
            project_hint = task_match.group(1).strip()
            task_desc = task_match.group(2).strip()
            
            matched = None
            for p in projects:
                if project_hint.lower() in p['name'].lower():
                    matched = p['name']
                    break
            
            classification['project_name'] = matched
            classification['is_actionable'] = True
            classification['action_type'] = 'task'
            classification['summary'] = task_desc
            classification['urgency'] = 'medium'
            classification['command_type'] = 'create_task'
            
            response_message = f"✅ *Task Created*\n\n📁 Project: {matched or 'Unassigned'}\n📝 {task_desc}"
    
    # =========================================================================
    # NOTE - Log information
    # =========================================================================
    elif lower_text.startswith('note:'):
        note_match = re.match(r'note:\s*(.+?)\s*-\s*(.+)', text, re.IGNORECASE)
        if note_match:
            project_hint = note_match.group(1).strip()
            note_text = note_match.group(2).strip()
            
            matched = None
            for p in projects:
                if project_hint.lower() in p['name'].lower():
                    matched = p['name']
                    break
            
            classification['project_name'] = matched
            classification['is_actionable'] = False
            classification['action_type'] = 'note'
            classification['summary'] = note_text
            classification['command_type'] = 'create_note'
            
            response_message = f"📝 *Note Logged*\n\n📁 Project: {matched or 'General'}\n💬 {note_text}"
    
    # =========================================================================
    # STATUS QUERY - what's pending on X
    # =========================================================================
    elif re.search(r"(what'?s?|show|get)\s+(pending|status|open)\s+(on|for|in)\s+(.+)", lower_text):
        query_match = re.search(r"(what'?s?|show|get)\s+(pending|status|open)\s+(on|for|in)\s+(.+)", lower_text)
        if query_match:
            project_hint = query_match.group(4).strip().rstrip('?')
            
            matched = None
            for p in projects:
                if project_hint.lower() in p['name'].lower():
                    matched = p
                    break
            
            if matched:
                stats = get_project_stats(matched['name'])
                response_message = f"📊 *{matched['name']}*\n\n📋 Pending: {stats['pending_tasks']}\n🔴 Urgent: {stats['high_urgency']}"
            else:
                response_message = f"❓ Project '{project_hint}' not found. Try exact name."
            
            classification['command_type'] = 'query_status'
            classification['project_name'] = matched['name'] if matched else None
            classification['summary'] = f"Status query for {project_hint}"
    
    # =========================================================================
    # FALLBACK - Unrecognized command
    # =========================================================================
    else:
        classification['is_command'] = False
        classification['action_type'] = 'info'
        classification['summary'] = text[:100]
    
    # Send response if we have one
    if response_message and chat_id:
        send_whatsapp_message(chat_id, response_message)
    
    return classification


# =============================================================================
# MESSAGE CLASSIFICATION
# =============================================================================

def classify_message(message_text, sender, group_name, projects, group_config, chat_id=None):
    """Use Vertex AI to classify WhatsApp message"""
    mapped_project = group_config.get('project') if group_config else None
    group_type = group_config.get('type', 'internal') if group_config else 'internal'
    group_priority = group_config.get('priority', 'medium') if group_config else 'medium'
    
    # Handle Command Group
    if group_type == 'command':
        return handle_command(message_text, sender, projects, chat_id)
    
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


# =============================================================================
# SAVE & AUTO-ADD FUNCTIONS
# =============================================================================

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
            existing_data = existing.to_dict()
            existing_name = existing_data.get('name', '')
            if group_name and not group_name.replace('@g.us', '').isdigit() and existing_name.replace('@g.us', '').isdigit():
                group_ref.update({'name': group_name})
                print(f"Updated group name: {existing_name} -> {group_name}")
    except Exception as e:
        print(f"Error auto-adding group: {e}")


# =============================================================================
# HTTP HANDLER
# =============================================================================

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
            'status': 'WhatsApp Webhook v3.0 - Smart Command Center',
            'features': ['group_mapping', 'command_group', 'waha_api_lookup', 'auto_reply', 'quick_status', 'today', 'urgent', 'pending'],
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
            
            _data = payload.get('_data', {})
            sender_name = _data.get('notifyName', '') or payload.get('from', '').split('@')[0]
            sender = payload.get('from', '')
            
            # Skip messages from self (the bot)
            if payload.get('fromMe', False):
                return (jsonify({'status': 'skipped', 'reason': 'own message'}), 200, headers)
            
            group_name = ''
            if is_group:
                group_name = get_cached_group_name(chat_id)
                print(f"Cached group name for {chat_id}: {group_name}")
                
                if not group_name or group_name.replace('@g.us', '').isdigit():
                    waha_name = get_group_name_from_waha(chat_id)
                    if waha_name:
                        group_name = waha_name
                        print(f"Got group name from Waha: {group_name}")
                
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
            
            if is_group and group_name:
                auto_add_group(group_name, chat_id)
            
            group_mappings = get_group_mappings()
            group_config = group_mappings.get(group_name.lower()) or group_mappings.get(chat_id.lower())
            
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
                group_config,
                chat_id  # Pass chat_id for auto-reply
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
                'command_type': classification.get('command_type'),
                'summary': classification.get('summary', '')[:50]
            }), 200, headers)
            
        except Exception as e:
            print(f"Webhook error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
