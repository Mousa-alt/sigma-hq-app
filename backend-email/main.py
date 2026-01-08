import os
import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
import json
import re
from datetime import datetime, timezone
from google.cloud import storage
from google.cloud import firestore
import vertexai
from vertexai.generative_models import GenerativeModel
import functions_framework
from flask import jsonify

# Configuration
IMAP_SERVER = os.environ.get('IMAP_SERVER', 'mail.sigmadd-egypt.com')
IMAP_PORT = int(os.environ.get('IMAP_PORT', '993'))
EMAIL_USER = os.environ.get('EMAIL_USER', '')
EMAIL_PASS = os.environ.get('EMAIL_PASS', '')
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'sigma-docs-repository')
GCP_PROJECT = os.environ.get('GCP_PROJECT', 'sigma-hq-technical-office')
GCP_LOCATION = os.environ.get('GCP_LOCATION', 'europe-west1')
FIREBASE_PROJECT = os.environ.get('FIREBASE_PROJECT', 'sigma-hq-38843')
APP_ID = os.environ.get('APP_ID', 'sigma-hq-production')

# Project name aliases for fuzzy matching
PROJECT_ALIASES = {
    'agora-gem': ['agura gem', 'agura-gem', 'agora gem', 'agoragim', 'agora_gem'],
    'hdv-gouna': ['hdv gouna', 'hdv_gouna', 'gouna hdv', 'el gouna'],
}

# Initialize clients
storage_client = storage.Client()
db = firestore.Client(project=FIREBASE_PROJECT)

try:
    vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    VERTEX_AI_ENABLED = True
except Exception as e:
    print(f"Vertex AI init error: {e}")
    VERTEX_AI_ENABLED = False

# =============================================================================
# EMAIL PROCESSING
# =============================================================================

def decode_mime_header(header_value):
    """Decode MIME encoded header"""
    if not header_value:
        return ""
    decoded_parts = []
    for part, charset in decode_header(header_value):
        if isinstance(part, bytes):
            decoded_parts.append(part.decode(charset or 'utf-8', errors='replace'))
        else:
            decoded_parts.append(part)
    return ' '.join(decoded_parts)

def extract_email_body(msg):
    """Extract plain text body from email"""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or 'utf-8'
                    body += payload.decode(charset, errors='replace')
                except:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or 'utf-8'
            body = payload.decode(charset, errors='replace')
        except:
            pass
    return body[:5000]

def extract_attachments(msg):
    """Extract attachment info from email"""
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            content_disposition = str(part.get("Content-Disposition", ""))
            if "attachment" in content_disposition:
                filename = part.get_filename()
                if filename:
                    filename = decode_mime_header(filename)
                    attachments.append({
                        'filename': filename,
                        'content_type': part.get_content_type(),
                        'data': part.get_payload(decode=True)
                    })
    return attachments

def get_registered_projects():
    """Get list of registered projects from Firestore"""
    projects = []
    try:
        docs = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('projects').stream()
        for doc in docs:
            data = doc.to_dict()
            project_name = data.get('name', '')
            
            # Build aliases list
            aliases = list(PROJECT_ALIASES.get(project_name.lower(), []))
            aliases.extend(data.get('keywords', []))
            aliases.append(project_name.lower())
            aliases.append(project_name.lower().replace('-', ' '))
            aliases.append(project_name.lower().replace('-', '_'))
            
            projects.append({
                'id': doc.id,
                'name': project_name,
                'client': data.get('client', ''),
                'keywords': data.get('keywords', []),
                'aliases': aliases
            })
        print(f"📋 Loaded projects: {[p['name'] for p in projects]}")
    except Exception as e:
        print(f"Error loading projects: {e}")
    return projects

def match_project_by_aliases(text, projects):
    """Try to match project by checking aliases in text"""
    text_lower = text.lower()
    for project in projects:
        for alias in project.get('aliases', []):
            if alias in text_lower:
                return project['name']
    return None

def classify_email_with_ai(subject, sender, body, projects):
    """Use Vertex AI Gemini to classify which project and document type"""
    
    # First try alias matching on subject + body (fast, no AI needed)
    combined_text = f"{subject} {body[:2000]}"
    alias_match = match_project_by_aliases(combined_text, projects)
    if alias_match:
        doc_type = detect_doc_type(subject, body)
        print(f"🎯 Alias match: {alias_match}")
        return alias_match, doc_type, 'high'
    
    if not VERTEX_AI_ENABLED:
        print("⚠️ Vertex AI not enabled, using fallback classification")
        return fallback_classify(subject, body, projects)
    
    if not projects:
        print("⚠️ No projects loaded, using fallback classification")
        return fallback_classify(subject, body, projects)
    
    try:
        model = GenerativeModel('gemini-1.5-flash-001')
        
        project_list = "\n".join([
            f"- {p['name']} (Client: {p.get('client', 'N/A')}, Keywords: {', '.join(p.get('aliases', [])[:5])})" 
            for p in projects
        ])
        
        prompt = f"""Classify this email for a construction company's document management system.

REGISTERED PROJECTS:
{project_list}

EMAIL:
From: {sender}
Subject: {subject}
Body: {body[:2500]}

RESPOND IN JSON ONLY:
{{
  "project_name": "exact project name from list above, or null if not related to any project",
  "doc_type": "one of: rfi, approval, vo, submittal, mom, correspondence, invoice, report",
  "confidence": "high, medium, or low",
  "reason": "brief explanation"
}}

CRITICAL RULES:
1. Search the ENTIRE email body for project references, not just the subject
2. Look for project names, codes, site names, client names anywhere in the email
3. Common misspellings should match (AGURA = Agora, etc.)
4. Check attachment filenames for project codes
5. Check email signatures for project references
6. If the email mentions a specific site or location that matches a project, use that
7. doc_type classification:
   - rfi: questions, clarifications, requests for information
   - approval: approvals, rejections, status on submittals, "approved", "rejected"
   - vo: variation orders, change requests, cost changes, extra work
   - submittal: material submittals, shop drawings, samples, technical submittals
   - mom: meeting minutes, meeting notes, MOM
   - invoice: payments, invoices, financial, purchase orders
   - report: progress reports, site reports, daily/weekly reports
   - correspondence: general emails, letters, coordination
"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        print(f"🤖 AI Response: {text[:200]}")
        
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            return result.get('project_name'), result.get('doc_type', 'correspondence'), result.get('confidence', 'low')
    except Exception as e:
        print(f"AI classification error: {e}")
        return fallback_classify(subject, body, projects)
    
    return None, 'correspondence', 'low'

def detect_doc_type(subject, body):
    """Detect document type from subject and body"""
    text = f"{subject} {body[:1000]}".lower()
    
    if any(k in text for k in ['rfi', 'request for information', 'clarification']):
        return 'rfi'
    elif any(k in text for k in ['approved', 'approval', 'rejected', 'status']):
        return 'approval'
    elif any(k in text for k in ['variation', 'vo', 'extra work', 'change order']):
        return 'vo'
    elif any(k in text for k in ['shop drawing', 'submittal', 'material', 'sample']):
        return 'submittal'
    elif any(k in text for k in ['meeting', 'mom', 'minutes']):
        return 'mom'
    elif any(k in text for k in ['invoice', 'payment', 'purchase order', 'po']):
        return 'invoice'
    elif any(k in text for k in ['report', 'progress', 'daily', 'weekly']):
        return 'report'
    return 'correspondence'

def fallback_classify(subject, body, projects):
    """Fallback classification using keyword matching in subject AND body"""
    combined = f"{subject} {body[:2000]}".lower()
    
    for project in projects:
        project_name = project['name'].lower()
        # Check project name and aliases
        if project_name in combined or project_name.replace('-', ' ') in combined:
            return project['name'], detect_doc_type(subject, body), 'medium'
        # Check aliases
        for alias in project.get('aliases', []):
            if alias in combined:
                return project['name'], detect_doc_type(subject, body), 'medium'
    
    return None, 'correspondence', 'low'

def save_email_to_gcs(email_data, project_name, doc_type):
    """Save email content to GCS"""
    bucket = storage_client.bucket(GCS_BUCKET)
    
    date_str = email_data['date'].strftime('%Y%m%d_%H%M') if email_data['date'] else datetime.now().strftime('%Y%m%d_%H%M')
    safe_subject = re.sub(r'[^\w\s-]', '', email_data['subject'])[:50].strip().replace(' ', '_')
    
    if project_name:
        folder_name = project_name.replace(' ', '-')
        path = f"{folder_name}/09-Correspondence/{doc_type.upper()}/{date_str}_{safe_subject}"
    else:
        path = f"_Unclassified_Emails/{date_str}_{safe_subject}"
    
    email_json = {
        'message_id': email_data['message_id'],
        'subject': email_data['subject'],
        'from': email_data['from'],
        'to': email_data.get('to', ''),
        'date': email_data['date'].isoformat() if email_data['date'] else None,
        'body': email_data['body'],
        'attachments': [a['filename'] for a in email_data.get('attachments', [])],
        'classified_project': project_name,
        'classified_type': doc_type,
        'processed_at': datetime.now(timezone.utc).isoformat()
    }
    
    blob = bucket.blob(f"{path}.json")
    blob.upload_from_string(json.dumps(email_json, indent=2), content_type='application/json')
    print(f"✅ Saved email: {path}.json")
    
    for att in email_data.get('attachments', []):
        if att['data']:
            att_path = f"{path}_attachments/{att['filename']}"
            att_blob = bucket.blob(att_path)
            att_blob.upload_from_string(att['data'], content_type=att['content_type'])
            print(f"✅ Saved attachment: {att_path}")
    
    return path

def save_email_to_firestore(email_data, project_name, doc_type, confidence):
    """Save email metadata to Firestore for dashboard display"""
    try:
        email_doc = {
            'message_id': email_data['message_id'],
            'subject': email_data['subject'],
            'from': email_data['from'],
            'to': email_data.get('to', ''),
            'date': email_data['date'].isoformat() if email_data['date'] else None,
            'project_name': project_name,
            'doc_type': doc_type,
            'confidence': confidence,
            'source': 'email',
            'is_read': False,
            'is_actionable': doc_type in ['rfi', 'approval', 'vo', 'submittal'],
            'status': 'new',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'attachments_count': len(email_data.get('attachments', []))
        }
        
        # Use message_id hash as document ID
        doc_id = str(hash(email_data['message_id']))[-12:]
        db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('emails').document(doc_id).set(email_doc)
        print(f"📝 Saved to Firestore: {email_data['subject'][:30]}...")
        return True
    except Exception as e:
        print(f"Error saving to Firestore: {e}")
        return False

def get_last_processed_uid():
    """Get the last processed email UID from Firestore"""
    try:
        doc = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('email_sync').document('state').get()
        if doc.exists:
            return doc.to_dict().get('last_uid', 0)
    except:
        pass
    return 0

def save_last_processed_uid(uid):
    """Save the last processed email UID to Firestore"""
    try:
        db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('email_sync').document('state').set({
            'last_uid': uid,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }, merge=True)
    except Exception as e:
        print(f"Error saving state: {e}")

def reset_processed_state():
    """Reset the last processed UID to reprocess emails"""
    try:
        db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('email_sync').document('state').set({
            'last_uid': 0,
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'reset_reason': 'manual reset'
        })
        return True
    except Exception as e:
        print(f"Error resetting state: {e}")
        return False

def fetch_and_process_emails(since_date=None, limit=50):
    """Fetch new emails from IMAP and process them"""
    if not EMAIL_USER or not EMAIL_PASS:
        return {'error': 'Email credentials not configured'}
    
    results = {'processed': 0, 'skipped': 0, 'errors': 0, 'emails': [], 'vertex_ai': VERTEX_AI_ENABLED}
    
    try:
        print(f"📧 Connecting to {IMAP_SERVER}:{IMAP_PORT}...")
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(EMAIL_USER, EMAIL_PASS)
        mail.select('INBOX')
        
        if since_date:
            search_date = since_date.strftime('%d-%b-%Y')
            _, message_numbers = mail.search(None, f'(SINCE "{search_date}")')
        else:
            today = datetime.now().strftime('%d-%b-%Y')
            _, message_numbers = mail.search(None, f'(SINCE "{today}")')
        
        email_ids = message_numbers[0].split()
        print(f"📬 Found {len(email_ids)} emails")
        
        projects = get_registered_projects()
        results['projects_loaded'] = len(projects)
        
        last_uid = get_last_processed_uid()
        
        for email_id in reversed(email_ids[-limit:]):
            try:
                _, msg_data = mail.fetch(email_id, '(RFC822 UID)')
                
                uid_match = re.search(rb'UID (\d+)', msg_data[0][0] if isinstance(msg_data[0], tuple) else b'')
                uid = int(uid_match.group(1)) if uid_match else int(email_id)
                
                if uid <= last_uid:
                    results['skipped'] += 1
                    continue
                
                raw_email = msg_data[0][1] if isinstance(msg_data[0], tuple) else msg_data[0]
                msg = email.message_from_bytes(raw_email)
                
                subject = decode_mime_header(msg['Subject'])
                sender = decode_mime_header(msg['From'])
                to = decode_mime_header(msg.get('To', ''))
                message_id = msg['Message-ID']
                
                date_str = msg['Date']
                try:
                    email_date = parsedate_to_datetime(date_str)
                except:
                    email_date = datetime.now(timezone.utc)
                
                body = extract_email_body(msg)
                attachments = extract_attachments(msg)
                
                email_data = {
                    'message_id': message_id,
                    'subject': subject,
                    'from': sender,
                    'to': to,
                    'date': email_date,
                    'body': body,
                    'attachments': attachments
                }
                
                # Classify with AI (now checks body too)
                project_name, doc_type, confidence = classify_email_with_ai(subject, sender, body, projects)
                
                # Save to GCS
                saved_path = save_email_to_gcs(email_data, project_name, doc_type)
                
                # Save to Firestore for dashboard
                save_email_to_firestore(email_data, project_name, doc_type, confidence)
                
                results['processed'] += 1
                results['emails'].append({
                    'subject': subject[:100],
                    'from': sender[:50],
                    'project': project_name,
                    'type': doc_type,
                    'confidence': confidence,
                    'path': saved_path
                })
                
                save_last_processed_uid(uid)
                
                print(f"✅ Processed: {subject[:50]}... → {project_name or 'Unclassified'} ({doc_type})")
                
            except Exception as e:
                print(f"❌ Error processing email: {e}")
                results['errors'] += 1
        
        mail.logout()
        
    except Exception as e:
        print(f"❌ IMAP error: {e}")
        results['error'] = str(e)
    
    return results

# =============================================================================
# HTTP HANDLER
# =============================================================================

@functions_framework.http
def email_sync(request):
    """HTTP endpoint for email sync"""
    if request.method == 'OPTIONS':
        return ('', 204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        })
    
    headers = {'Access-Control-Allow-Origin': '*'}
    
    if request.method == 'GET':
        return (jsonify({
            'status': 'Email Sync Worker v3.0 - Smart Detection',
            'imap_server': IMAP_SERVER,
            'email_configured': bool(EMAIL_USER and EMAIL_PASS),
            'vertex_ai_enabled': VERTEX_AI_ENABLED,
            'gcp_project': GCP_PROJECT,
            'firebase_project': FIREBASE_PROJECT,
            'app_id': APP_ID,
            'features': ['alias_matching', 'body_search', 'firestore_sync']
        }), 200, headers)
    
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            limit = data.get('limit', 50)
            
            if data.get('reset'):
                reset_processed_state()
                return (jsonify({'message': 'State reset, will reprocess emails'}), 200, headers)
            
            since_str = data.get('since')
            since_date = None
            if since_str:
                since_date = datetime.fromisoformat(since_str)
            
            results = fetch_and_process_emails(since_date=since_date, limit=limit)
            return (jsonify(results), 200, headers)
            
        except Exception as e:
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
