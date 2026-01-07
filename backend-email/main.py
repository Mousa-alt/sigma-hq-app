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

# Initialize clients
storage_client = storage.Client()
db = firestore.Client()

# Initialize Vertex AI (uses GCP credentials automatically)
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
    return body[:5000]  # Limit body size

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
        docs = db.collection('projects').stream()
        for doc in docs:
            data = doc.to_dict()
            projects.append({
                'id': doc.id,
                'name': data.get('name', ''),
                'client': data.get('client', ''),
                'keywords': data.get('keywords', [])
            })
        print(f"📋 Loaded projects: {[p['name'] for p in projects]}")
    except Exception as e:
        print(f"Error loading projects: {e}")
    return projects

def classify_email_with_ai(subject, sender, body, projects):
    """Use Vertex AI Gemini to classify which project and document type"""
    if not VERTEX_AI_ENABLED:
        print("⚠️ Vertex AI not enabled, using fallback classification")
        return fallback_classify(subject, projects)
    
    try:
        model = GenerativeModel('gemini-1.5-flash-001')
        
        project_list = "\n".join([f"- {p['name']} (Client: {p.get('client', 'N/A')})" for p in projects])
        
        prompt = f"""Classify this email for a construction company's document management system.

REGISTERED PROJECTS:
{project_list}

EMAIL:
From: {sender}
Subject: {subject}
Body (excerpt): {body[:1500]}

RESPOND IN JSON ONLY:
{{
  "project_name": "exact project name from list above, or null if not related to any project",
  "doc_type": "one of: rfi, approval, vo, submittal, mom, correspondence, invoice, report",
  "confidence": "high, medium, or low",
  "reason": "brief explanation"
}}

RULES:
- Match project by name, client name, or context clues in the email
- Look for project names or codes in the subject line
- If unclear which project, set project_name to null
- doc_type based on content:
  - rfi: questions, clarifications needed
  - approval: approvals, rejections, status updates on submittals
  - vo: variation orders, change requests, cost changes
  - submittal: material submittals, shop drawings, samples
  - mom: meeting minutes, meeting notes
  - invoice: payments, invoices, financial
  - report: progress reports, site reports
  - correspondence: general emails, letters
"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        print(f"🤖 AI Response: {text[:200]}")
        
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            return result.get('project_name'), result.get('doc_type', 'correspondence'), result.get('confidence', 'low')
    except Exception as e:
        print(f"AI classification error: {e}")
        return fallback_classify(subject, projects)
    
    return None, 'correspondence', 'low'

def fallback_classify(subject, projects):
    """Fallback classification using keyword matching"""
    subject_lower = subject.lower()
    
    # Try to match project name in subject
    for project in projects:
        project_name = project['name'].lower()
        # Check for project name or parts of it
        if project_name in subject_lower or project_name.replace('-', ' ') in subject_lower:
            # Determine doc type from subject
            doc_type = 'correspondence'
            if 'rfi' in subject_lower:
                doc_type = 'rfi'
            elif 'shop drawing' in subject_lower or 'submittal' in subject_lower:
                doc_type = 'submittal'
            elif 'approval' in subject_lower or 'approved' in subject_lower:
                doc_type = 'approval'
            elif 'invoice' in subject_lower or 'payment' in subject_lower:
                doc_type = 'invoice'
            elif 'meeting' in subject_lower or 'mom' in subject_lower:
                doc_type = 'mom'
            elif 'variation' in subject_lower or 'vo' in subject_lower:
                doc_type = 'vo'
            elif 'report' in subject_lower:
                doc_type = 'report'
            
            return project['name'], doc_type, 'medium'
    
    return None, 'correspondence', 'low'

def save_email_to_gcs(email_data, project_name, doc_type):
    """Save email content to GCS"""
    bucket = storage_client.bucket(GCS_BUCKET)
    
    # Generate filename
    date_str = email_data['date'].strftime('%Y%m%d_%H%M') if email_data['date'] else datetime.now().strftime('%Y%m%d_%H%M')
    safe_subject = re.sub(r'[^\w\s-]', '', email_data['subject'])[:50].strip().replace(' ', '_')
    
    # Determine path
    if project_name:
        folder_name = project_name.replace(' ', '-')
        path = f"{folder_name}/09-Correspondence/{doc_type.upper()}/{date_str}_{safe_subject}"
    else:
        path = f"_Unclassified_Emails/{date_str}_{safe_subject}"
    
    # Save email as JSON (metadata + body)
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
    
    # Save attachments
    for att in email_data.get('attachments', []):
        if att['data']:
            att_path = f"{path}_attachments/{att['filename']}"
            att_blob = bucket.blob(att_path)
            att_blob.upload_from_string(att['data'], content_type=att['content_type'])
            print(f"✅ Saved attachment: {att_path}")
    
    return path

def get_last_processed_uid():
    """Get the last processed email UID from Firestore"""
    try:
        doc = db.collection('email_sync').document('state').get()
        if doc.exists:
            return doc.to_dict().get('last_uid', 0)
    except:
        pass
    return 0

def save_last_processed_uid(uid):
    """Save the last processed email UID to Firestore"""
    try:
        db.collection('email_sync').document('state').set({
            'last_uid': uid,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }, merge=True)
    except Exception as e:
        print(f"Error saving state: {e}")

def reset_processed_state():
    """Reset the last processed UID to reprocess emails"""
    try:
        db.collection('email_sync').document('state').set({
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
        # Connect to IMAP
        print(f"📧 Connecting to {IMAP_SERVER}:{IMAP_PORT}...")
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(EMAIL_USER, EMAIL_PASS)
        mail.select('INBOX')
        
        # Search criteria
        if since_date:
            search_date = since_date.strftime('%d-%b-%Y')
            _, message_numbers = mail.search(None, f'(SINCE "{search_date}")')
        else:
            # Get emails from today
            today = datetime.now().strftime('%d-%b-%Y')
            _, message_numbers = mail.search(None, f'(SINCE "{today}")')
        
        email_ids = message_numbers[0].split()
        print(f"📬 Found {len(email_ids)} emails")
        
        # Get registered projects
        projects = get_registered_projects()
        results['projects_loaded'] = len(projects)
        
        # Get last processed UID
        last_uid = get_last_processed_uid()
        
        # Process emails (newest first, limited)
        for email_id in reversed(email_ids[-limit:]):
            try:
                # Fetch email
                _, msg_data = mail.fetch(email_id, '(RFC822 UID)')
                
                # Extract UID
                uid_match = re.search(rb'UID (\d+)', msg_data[0][0] if isinstance(msg_data[0], tuple) else b'')
                uid = int(uid_match.group(1)) if uid_match else int(email_id)
                
                # Skip if already processed
                if uid <= last_uid:
                    results['skipped'] += 1
                    continue
                
                # Parse email
                raw_email = msg_data[0][1] if isinstance(msg_data[0], tuple) else msg_data[0]
                msg = email.message_from_bytes(raw_email)
                
                # Extract data
                subject = decode_mime_header(msg['Subject'])
                sender = decode_mime_header(msg['From'])
                to = decode_mime_header(msg.get('To', ''))
                message_id = msg['Message-ID']
                
                # Parse date
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
                
                # Classify with AI
                project_name, doc_type, confidence = classify_email_with_ai(subject, sender, body, projects)
                
                # Save to GCS
                saved_path = save_email_to_gcs(email_data, project_name, doc_type)
                
                results['processed'] += 1
                results['emails'].append({
                    'subject': subject[:100],
                    'from': sender[:50],
                    'project': project_name,
                    'type': doc_type,
                    'confidence': confidence,
                    'path': saved_path
                })
                
                # Update last processed UID
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
    
    # Health check
    if request.method == 'GET':
        return (jsonify({
            'status': 'Email Sync Worker v2.0',
            'imap_server': IMAP_SERVER,
            'email_configured': bool(EMAIL_USER and EMAIL_PASS),
            'vertex_ai_enabled': VERTEX_AI_ENABLED,
            'gcp_project': GCP_PROJECT
        }), 200, headers)
    
    # Process emails
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            limit = data.get('limit', 50)
            
            # Reset state if requested
            if data.get('reset'):
                reset_processed_state()
                return (jsonify({'message': 'State reset, will reprocess emails'}), 200, headers)
            
            # Optional: process from specific date
            since_str = data.get('since')
            since_date = None
            if since_str:
                since_date = datetime.fromisoformat(since_str)
            
            results = fetch_and_process_emails(since_date=since_date, limit=limit)
            return (jsonify(results), 200, headers)
            
        except Exception as e:
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
