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

def classify_message(message_text, sender, group_name, projects):
    """Use Vertex AI to classify WhatsApp message"""
    if not VERTEX_AI_ENABLED or not projects:
        return fallback_classify(message_text, group_name, projects)
    
    try:
        model = GenerativeModel('gemini-1.5-flash-001')
        
        project_list = "\n".join([f"- {p['name']} (Client: {p.get('client', 'N/A')})" for p in projects])
        
        prompt = f"""Classify this WhatsApp message for a construction company.

REGISTERED PROJECTS:
{project_list}

MESSAGE:
Group: {group_name}
From: {sender}
Text: {message_text[:1000]}

RESPOND IN JSON ONLY:
{{
  "project_name": "exact project name from list, or null",
  "is_actionable": true/false,
  "action_type": "decision_needed|approval_request|task|info|question|none",
  "summary": "one line summary",
  "urgency": "high|medium|low"
}}

RULES:
- Match project by group name, client name, or message content
- is_actionable = true if someone needs to do something
- action_type based on content
- Be brief in summary
"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            return result
    except Exception as e:
        print(f"AI classification error: {e}")
    
    return fallback_classify(message_text, group_name, projects)

def fallback_classify(message_text, group_name, projects):
    """Fallback keyword-based classification"""
    lower_text = message_text.lower()
    lower_group = group_name.lower() if group_name else ''
    
    # Try to match project
    matched_project = None
    for project in projects:
        project_name = project['name'].lower()
        if project_name in lower_group or project_name in lower_text:
            matched_project = project['name']
            break
    
    # Detect actionable
    action_keywords = ['please', 'urgent', 'asap', 'need', 'required', 'confirm', 'approve', 'send', 'check', 'review']
    is_actionable = any(kw in lower_text for kw in action_keywords)
    
    return {
        'project_name': matched_project,
        'is_actionable': is_actionable,
        'action_type': 'info',
        'summary': message_text[:100],
        'urgency': 'medium'
    }

def save_message(message_data, classification):
    """Save classified message to Firestore"""
    try:
        collection_path = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')
        
        doc_data = {
            'message_id': message_data.get('id', ''),
            'group_name': message_data.get('group_name', ''),
            'sender': message_data.get('sender', ''),
            'text': message_data.get('text', ''),
            'timestamp': message_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'project_name': classification.get('project_name'),
            'is_actionable': classification.get('is_actionable', False),
            'action_type': classification.get('action_type', 'info'),
            'summary': classification.get('summary', ''),
            'urgency': classification.get('urgency', 'low'),
            'status': 'pending' if classification.get('is_actionable') else 'info',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        collection_path.add(doc_data)
        print(f"Saved message: {doc_data['summary'][:50]}")
        return True
    except Exception as e:
        print(f"Error saving message: {e}")
        return False

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
    
    # Health check
    if request.method == 'GET':
        return (jsonify({
            'status': 'WhatsApp Webhook v1.0',
            'vertex_ai_enabled': VERTEX_AI_ENABLED,
            'firebase_project': FIREBASE_PROJECT
        }), 200, headers)
    
    # Process webhook
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            
            # Waha webhook format
            event = data.get('event', '')
            payload = data.get('payload', {})
            
            # Only process messages
            if event != 'message':
                return (jsonify({'status': 'ignored', 'event': event}), 200, headers)
            
            # Extract message info
            message_data = {
                'id': payload.get('id', ''),
                'text': payload.get('body', ''),
                'sender': payload.get('from', ''),
                'group_name': payload.get('chatId', '').replace('@g.us', ''),
                'timestamp': payload.get('timestamp', '')
            }
            
            # Skip if no text
            if not message_data['text']:
                return (jsonify({'status': 'skipped', 'reason': 'no text'}), 200, headers)
            
            # Get projects and classify
            projects = get_registered_projects()
            classification = classify_message(
                message_data['text'],
                message_data['sender'],
                message_data['group_name'],
                projects
            )
            
            # Save to Firestore
            save_message(message_data, classification)
            
            return (jsonify({
                'status': 'processed',
                'project': classification.get('project_name'),
                'actionable': classification.get('is_actionable'),
                'summary': classification.get('summary', '')[:50]
            }), 200, headers)
            
        except Exception as e:
            print(f"Webhook error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
