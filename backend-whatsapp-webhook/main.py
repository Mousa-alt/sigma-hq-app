# File: main.py

import os
import json
import re
import base64
import requests
import mimetypes
from datetime import datetime, timezone, timedelta
import functions_framework
from flask import jsonify
from google.cloud import firestore
from google.cloud import storage
from google.cloud import discoveryengine_v1 as discoveryengine
import vertexai
from vertexai.generative_models import GenerativeModel
import google.auth
from google.auth.transport import requests as google_requests

# Configuration
GCP_PROJECT = os.environ.get('GCP_PROJECT', 'sigma-hq-technical-office')
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'sigma-docs-repository')
GCP_LOCATION = os.environ.get('GCP_LOCATION', 'us-central1')
FIREBASE_PROJECT = os.environ.get('FIREBASE_PROJECT', 'sigma-hq-38843')
APP_ID = os.environ.get('APP_ID', 'sigma-hq-production')
WAHA_API_URL = os.environ.get('WAHA_API_URL', 'http://34.78.137.109:3000')
WAHA_API_KEY = os.environ.get('WAHA_API_KEY', 'sigma2026')
COMMAND_GROUP_ID = os.environ.get('COMMAND_GROUP_ID', '')

# Waha Plus License - Set to True when you buy premium
WAHA_PLUS_ENABLED = os.environ.get('WAHA_PLUS_ENABLED', 'false').lower() == 'true'

# Vertex AI Search Config
VERTEX_LOCATION = "global"
ENGINE_ID = "sigma-search_1767650825639"

# Initialize clients
db = firestore.Client(project=FIREBASE_PROJECT)
storage_client = storage.Client()

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
            return group_name
    except Exception as e:
        print(f"Error fetching group from Waha: {e}")
    
    try:
        url = f"{WAHA_API_URL}/api/default/chats/{group_id}"
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get('name') or data.get('subject') or ''
    except Exception as e:
        print(f"Error fetching chat from Waha: {e}")
    
    return None


def check_waha_session():
    """Check if Waha session is connected"""
    headers = {'X-Api-Key': WAHA_API_KEY} if WAHA_API_KEY else {}
    try:
        response = requests.get(f"{WAHA_API_URL}/api/sessions/default", headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            status = data.get('status', '').upper()
            return status in ['WORKING', 'CONNECTED', 'AUTHENTICATED']
    except Exception as e:
        print(f"Session check error: {e}")
    return False


def send_whatsapp_message(chat_id, message):
    """Send a message via Waha API"""
    headers = {
        'X-Api-Key': WAHA_API_KEY,
        'Content-Type': 'application/json'
    }
    
    try:
        url = f"{WAHA_API_URL}/api/sendText"
        payload = {
            'session': 'default',
            'chatId': chat_id,
            'text': message
        }
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code in [200, 201]:
            print(f"Message sent to {chat_id}")
            return True
        else:
            print(f"Failed to send message: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error sending message: {e}")
    
    return False


def generate_signed_url(gcs_path, expiration_minutes=60):
    """Generate a signed URL using IAM signBlob API (no private key needed)
    
    This works in Cloud Run without a service account key file by using
    the IAM Credentials API to sign the URL server-side.
    
    Requires: roles/iam.serviceAccountTokenCreator on the service account
    """
    try:
        bucket = storage_client.bucket(GCS_BUCKET)
        blob = bucket.blob(gcs_path)
        
        if not blob.exists():
            return None, "File not found in GCS"
        
        # Get default credentials and refresh to obtain access token
        credentials, project = google.auth.default()
        credentials.refresh(google_requests.Request())
        
        # Generate signed URL using IAM signBlob API
        # Passing service_account_email and access_token triggers the
        # IAM Credentials API instead of local signing
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="GET",
            service_account_email=credentials.service_account_email,
            access_token=credentials.token
        )
        return url, None
    except Exception as e:
        print(f"Signed URL error: {e}")
        return None, str(e)


def get_file_size_mb(gcs_path):
    """Get file size in MB"""
    try:
        bucket = storage_client.bucket(GCS_BUCKET)
        blob = bucket.blob(gcs_path)
        if blob.exists():
            blob.reload()
            return blob.size / (1024 * 1024)
    except:
        pass
    return 0


def send_whatsapp_file(chat_id, gcs_path, filename):
    """Send a file from GCS via WhatsApp
    
    v4.10 Strategy:
    - Free Waha: Always send signed download link (sendFile not available)
    - Waha Plus: Use sendFile API with base64/URL (when WAHA_PLUS_ENABLED=true)
    
    To enable Waha Plus file sending, set environment variable:
    WAHA_PLUS_ENABLED=true
    """
    
    # Check session first
    if not check_waha_session():
        print("Waha session not connected")
        return False, "Technical Office is offline. Try again in 5 minutes."
    
    # Check if file exists
    bucket = storage_client.bucket(GCS_BUCKET)
    blob = bucket.blob(gcs_path)
    
    if not blob.exists():
        print(f"File not found in GCS: {gcs_path}")
        return False, "File not found"
    
    # Get file size for display
    blob.reload()
    file_size_mb = blob.size / (1024 * 1024)
    
    # ==========================================================================
    # FREE WAHA: Send download link
    # ==========================================================================
    if not WAHA_PLUS_ENABLED:
        print(f"Free Waha mode: Sending download link for {filename}")
        
        # Generate signed URL (valid for 60 minutes)
        signed_url, err = generate_signed_url(gcs_path, expiration_minutes=60)
        
        if not signed_url:
            return False, f"Could not generate download link: {err}"
        
        # Format nice message with file info
        size_str = f"{file_size_mb:.1f}MB" if file_size_mb >= 1 else f"{int(file_size_mb * 1024)}KB"
        
        download_msg = f"""📁 *{filename}*
📊 Size: {size_str}

🔗 *Download Link* (valid 1 hour):
{signed_url}

_Tap link to download directly_"""
        
        if send_whatsapp_message(chat_id, download_msg):
            return True, "Download link sent"
        else:
            return False, "Failed to send message"
    
    # ==========================================================================
    # WAHA PLUS: Use sendFile API (when you upgrade)
    # ==========================================================================
    else:
        print(f"Waha Plus mode: Sending file {filename}")
        
        headers = {
            'X-Api-Key': WAHA_API_KEY,
            'Content-Type': 'application/json'
        }
        
        # Get MIME type
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            ext = os.path.splitext(filename.lower())[1]
            mime_fallbacks = {
                '.pdf': 'application/pdf',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.xls': 'application/vnd.ms-excel',
                '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.dwg': 'application/acad',
                '.zip': 'application/zip',
            }
            mime_type = mime_fallbacks.get(ext, 'application/octet-stream')
        
        try:
            # Files > 64MB: Send link only (WhatsApp limit)
            if blob.size > 64 * 1024 * 1024:
                signed_url, _ = generate_signed_url(gcs_path, 60)
                if signed_url:
                    msg = f"📁 *{filename}*\n\n⚠️ File too large ({file_size_mb:.1f}MB)\n\n🔗 Download:\n{signed_url}"
                    send_whatsapp_message(chat_id, msg)
                    return True, "Sent as link (file too large)"
                return False, "File too large"
            
            # Files <= 15MB: Use base64
            if blob.size <= 15 * 1024 * 1024:
                file_content = blob.download_as_bytes()
                file_base64 = base64.b64encode(file_content).decode('utf-8')
                
                payload = {
                    'session': 'default',
                    'chatId': chat_id,
                    'file': {
                        'mimetype': mime_type,
                        'filename': filename,
                        'data': file_base64
                    }
                }
            else:
                # Files 15-64MB: Use signed URL
                signed_url, err = generate_signed_url(gcs_path, 10)
                if not signed_url:
                    return False, f"URL error: {err}"
                
                payload = {
                    'session': 'default',
                    'chatId': chat_id,
                    'file': {
                        'url': signed_url,
                        'filename': filename,
                        'mimetype': mime_type
                    }
                }
            
            url = f"{WAHA_API_URL}/api/sendFile"
            response = requests.post(url, headers=headers, json=payload, timeout=180)
            
            if response.status_code == 200:
                return True, "File sent"
            else:
                print(f"sendFile failed: {response.status_code} - {response.text}")
                # Fallback to download link
                signed_url, _ = generate_signed_url(gcs_path, 30)
                if signed_url:
                    msg = f"📁 *{filename}*\n\n🔗 Download:\n{signed_url}"
                    send_whatsapp_message(chat_id, msg)
                    return True, "Sent as download link"
                return False, f"Send failed: {response.status_code}"
                
        except Exception as e:
            print(f"Error: {e}")
            # Fallback
            signed_url, _ = generate_signed_url(gcs_path, 30)
            if signed_url:
                msg = f"📁 *{filename}*\n\n🔗 Download:\n{signed_url}"
                send_whatsapp_message(chat_id, msg)
                return True, "Sent as download link"
            return False, str(e)


# =============================================================================
# SEARCH RESULTS CACHE (for `get` command)
# =============================================================================

def save_search_results(chat_id, results):
    """Save search results to Firestore for later retrieval"""
    try:
        cache_id = re.sub(r'[^a-zA-Z0-9]', '_', chat_id)[:50]
        db.collection('artifacts').document(APP_ID).collection('public').document('data')\
            .collection('search_cache').document(cache_id).set({
            'chat_id': chat_id,
            'results': results,
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        return True
    except Exception as e:
        print(f"Error saving search results: {e}")
        return False


def get_last_search_results(chat_id):
    """Get last search results for a chat"""
    try:
        cache_id = re.sub(r'[^a-zA-Z0-9]', '_', chat_id)[:50]
        doc = db.collection('artifacts').document(APP_ID).collection('public').document('data')\
            .collection('search_cache').document(cache_id).get()
        if doc.exists:
            data = doc.to_dict()
            return data.get('results', [])
    except Exception as e:
        print(f"Error getting search results: {e}")
    return []


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
                'drive_folder_id': data.get('drive_folder_id', ''),
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
        
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        recent = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('created_at', '>=', yesterday)\
            .stream()
        
        stats['recent_messages'] = sum(1 for _ in recent)
        
        emails = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('emails')\
            .where('project_name', '==', project_name)\
            .where('created_at', '>=', yesterday)\
            .stream()
        
        stats['recent_emails'] = sum(1 for _ in emails)
        
    except Exception as e:
        print(f"Error getting project stats: {e}")
    
    return stats


def get_project_pending_items(project_name, limit=15):
    """Get actual pending items for a specific project with doc IDs"""
    items = []
    try:
        messages = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'doc_id': msg.id,
                'summary': data.get('summary', data.get('text', '')[:50]),
                'urgency': data.get('urgency', 'medium'),
                'type': data.get('action_type', 'task'),
                'sender': data.get('sender_name', 'Unknown'),
                'created': data.get('created_at', ''),
                'group': data.get('group_name', ''),
                'assigned_to': data.get('assigned_to'),
                'deadline': data.get('deadline')
            })
    except Exception as e:
        print(f"Error getting project pending items: {e}")
    
    return items


def get_project_recent_activity(project_name, limit=10):
    """Get recent activity for a project"""
    items = []
    try:
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        
        messages = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('created_at', '>=', yesterday)\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'summary': data.get('summary', data.get('text', '')[:50]),
                'sender': data.get('sender_name', 'Unknown'),
                'type': data.get('action_type', 'info'),
                'actionable': data.get('is_actionable', False),
                'created': data.get('created_at', '')
            })
    except Exception as e:
        print(f"Error getting project activity: {e}")
    
    return items


def get_all_pending_items(limit=20):
    """Get all pending actionable items across all projects with doc IDs"""
    items = []
    try:
        messages = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .order_by('created_at', direction=firestore.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'doc_id': msg.id,
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'urgency': data.get('urgency', 'medium'),
                'type': data.get('action_type', 'task'),
                'created': data.get('created_at', ''),
                'assigned_to': data.get('assigned_to'),
                'deadline': data.get('deadline')
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
                'doc_id': msg.id,
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'type': data.get('action_type', 'task'),
                'created': data.get('created_at', '')
            })
    except Exception as e:
        print(f"Error getting urgent items: {e}")
    
    return items


def get_today_items():
    """Get items created today"""
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
                'doc_id': msg.id,
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'urgency': data.get('urgency', 'medium'),
                'type': data.get('action_type', 'task'),
                'status': data.get('status', 'pending')
            })
    except Exception as e:
        print(f"Error getting today items: {e}")
    
    return items


def get_overdue_items():
    """Get items past their deadline"""
    items = []
    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        messages = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages')\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            deadline = data.get('deadline')
            if deadline and deadline < today:
                items.append({
                    'doc_id': msg.id,
                    'project': data.get('project_name', 'Unknown'),
                    'summary': data.get('summary', data.get('text', '')[:50]),
                    'deadline': deadline,
                    'days_overdue': (datetime.now(timezone.utc) - datetime.fromisoformat(deadline.replace('Z', '+00:00'))).days if 'T' in deadline else 0
                })
    except Exception as e:
        print(f"Error getting overdue items: {e}")
    
    return items


# =============================================================================
# DOCUMENT SEARCH - Using Vertex AI Search
# =============================================================================

def search_documents(query, project_name=None, limit=5):
    """Search for documents using Vertex AI Search (Discovery Engine)"""
    results = []
    
    try:
        client = discoveryengine.SearchServiceClient()
        serving_config = f"projects/{GCP_PROJECT}/locations/{VERTEX_LOCATION}/collections/default_collection/engines/{ENGINE_ID}/servingConfigs/default_search"
        
        # Add project name to query if specified
        search_query = f"{query} {project_name}" if project_name else query
        
        request = discoveryengine.SearchRequest(
            serving_config=serving_config,
            query=search_query,
            page_size=limit,
            content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                    return_snippet=True,
                    max_snippet_count=1
                ),
            ),
        )
        
        response = client.search(request)
        
        for result in response.results:
            doc = result.document
            doc_data = {
                'name': '',
                'path': '',
                'gcs_path': '',
                'project': '',
                'drive_id': '',
                'drive_link': '',
                'snippets': []
            }
            
            if doc.derived_struct_data:
                struct = dict(doc.derived_struct_data)
                link = struct.get('link', '')
                title = struct.get('title', '')
                
                # Extract filename from link or title
                if link:
                    doc_data['drive_link'] = link
                    # Extract path parts
                    gcs_path = link.replace('gs://sigma-docs-repository/', '')
                    doc_data['gcs_path'] = gcs_path
                    parts = gcs_path.split('/')
                    if parts:
                        doc_data['name'] = parts[-1] if parts[-1] else title
                        doc_data['path'] = '/'.join(parts[:-1]) if len(parts) > 1 else ''
                        doc_data['project'] = parts[0] if parts else ''
                else:
                    doc_data['name'] = title
                
                # Get snippets
                for snippet in struct.get('snippets', []):
                    if isinstance(snippet, dict) and snippet.get('snippet'):
                        doc_data['snippets'].append(snippet.get('snippet'))
                
                # Filter by project if specified
                if project_name:
                    project_lower = project_name.lower().replace(' ', '_').replace('-', '_')
                    link_lower = link.lower().replace('-', '_')
                    if project_lower not in link_lower:
                        continue
                
                results.append(doc_data)
        
        print(f"Vertex AI Search returned {len(results)} results for: {search_query}")
        
    except Exception as e:
        print(f"Vertex AI Search error: {e}")
    
    return results


def get_folder_structure(project_name):
    """Get folder structure for a project"""
    folders = [
        "00-Project_Info",
        "01-Contract_Documents", 
        "02-Design_Drawings",
        "03-Specifications",
        "04-Quantity_Surveying",
        "05-Correspondence",
        "06-Site_Reports",
        "07-Quality_Control",
        "08-Health_Safety",
        "09-Shop_Drawings",
        "10-Handover"
    ]
    return folders


# =============================================================================
# ACTION FUNCTIONS
# =============================================================================

def mark_item_done(project_name, item_index, items_cache=None):
    """Mark an item as done by index"""
    try:
        if items_cache and item_index <= len(items_cache):
            doc_id = items_cache[item_index - 1]['doc_id']
        else:
            items = get_project_pending_items(project_name, limit=20) if project_name else get_all_pending_items(limit=20)
            if item_index > len(items):
                return False, "Item number not found"
            doc_id = items[item_index - 1]['doc_id']
        
        doc_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages').document(doc_id)
        doc_ref.update({
            'status': 'done',
            'completed_at': datetime.now(timezone.utc).isoformat()
        })
        return True, "Item marked as done"
    except Exception as e:
        print(f"Error marking item done: {e}")
        return False, str(e)


def assign_item(project_name, item_index, assignee):
    """Assign an item to someone"""
    try:
        items = get_project_pending_items(project_name, limit=20) if project_name else get_all_pending_items(limit=20)
        if item_index > len(items):
            return False, "Item number not found"
        
        doc_id = items[item_index - 1]['doc_id']
        doc_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages').document(doc_id)
        doc_ref.update({
            'assigned_to': assignee,
            'assigned_at': datetime.now(timezone.utc).isoformat()
        })
        return True, f"Assigned to {assignee}"
    except Exception as e:
        print(f"Error assigning item: {e}")
        return False, str(e)


def set_item_urgency(project_name, item_index, urgency):
    """Set urgency level for an item"""
    try:
        items = get_project_pending_items(project_name, limit=20) if project_name else get_all_pending_items(limit=20)
        if item_index > len(items):
            return False, "Item number not found"
        
        doc_id = items[item_index - 1]['doc_id']
        doc_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_messages').document(doc_id)
        doc_ref.update({'urgency': urgency})
        return True, f"Set to {urgency} priority"
    except Exception as e:
        print(f"Error setting urgency: {e}")
        return False, str(e)


# =============================================================================
# DAILY DIGEST
# =============================================================================

def generate_daily_digest():
    """Generate daily digest message"""
    overdue = get_overdue_items()
    urgent = get_urgent_items()
    today = get_today_items()
    pending = get_all_pending_items(limit=50)
    
    yesterday_start = (datetime.now(timezone.utc) - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    yesterday_end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    new_yesterday = [p for p in pending if yesterday_start <= p.get('created', '') < yesterday_end]
    
    date_str = datetime.now(timezone.utc).strftime('%b %d')
    
    digest = f"☀️ *Good Morning - {date_str}*\n"
    
    if overdue:
        digest += f"\n🔴 *Overdue ({len(overdue)}):*\n"
        for item in overdue[:5]:
            digest += f"• {item['project']}: {item['summary'][:30]}\n"
    
    if urgent:
        digest += f"\n⚠️ *Urgent ({len(urgent)}):*\n"
        for item in urgent[:5]:
            digest += f"• {item['project']}: {item['summary'][:30]}\n"
    
    if today:
        digest += f"\n📅 *New Today ({len(today)}):*\n"
        for item in today[:5]:
            digest += f"• {item['project']}: {item['summary'][:30]}\n"
    
    digest += f"\n📊 *Summary:*\n"
    digest += f"• Total Pending: {len(pending)}\n"
    digest += f"• New Yesterday: {len(new_yesterday)}\n"
    
    digest += "\n_Type `u` for urgent, `p` for pending_"
    
    return digest


# =============================================================================
# SMART COMMAND HANDLER
# =============================================================================

def match_project(hint, projects):
    """Fuzzy match project name"""
    hint_lower = hint.lower().strip()
    for p in projects:
        if hint_lower == p['name'].lower():
            return p
        if hint_lower in p['name'].lower():
            return p
        for kw in p.get('keywords', []):
            if hint_lower in kw.lower():
                return p
    return None


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
    # SHORTCUTS - Single letter commands
    # =========================================================================
    if lower_text == 's':
        lower_text = 'summary'
    elif lower_text == 'u':
        lower_text = 'urgent'
    elif lower_text == 'p':
        lower_text = 'pending'
    elif lower_text == 't':
        lower_text = 'today'
    elif lower_text == 'h':
        lower_text = 'help'
    elif lower_text == 'd':
        lower_text = 'digest'
    
    # l project = list project
    shortcut_list = re.match(r'^l\s+(.+)$', lower_text)
    if shortcut_list:
        lower_text = f"list {shortcut_list.group(1)}"
    
    # a project = activity project
    shortcut_activity = re.match(r'^a\s+(.+)$', lower_text)
    if shortcut_activity:
        lower_text = f"activity {shortcut_activity.group(1)}"
    
    # f query = find query
    shortcut_find = re.match(r'^f\s+(.+)$', lower_text)
    if shortcut_find:
        lower_text = f"find {shortcut_find.group(1)}"
    
    # g N = get file N from last search
    shortcut_get = re.match(r'^g\s+(\d+)$', lower_text)
    if shortcut_get:
        lower_text = f"get {shortcut_get.group(1)}"
    
    # =========================================================================
    # GET FILE - Download file from last search
    # =========================================================================
    get_match = re.match(r'^get\s+(\d+)$', lower_text)
    if get_match:
        file_num = int(get_match.group(1))
        
        # Get last search results for this chat
        results = get_last_search_results(chat_id)
        
        if not results:
            response_message = "❌ No recent search results.\n\nUse `f keyword` to search first."
        elif file_num < 1 or file_num > len(results):
            response_message = f"❌ Invalid number. Enter 1-{len(results)}"
        else:
            doc = results[file_num - 1]
            gcs_path = doc.get('gcs_path', '')
            filename = doc.get('name', 'document')
            
            if not gcs_path:
                response_message = "❌ File path not available."
            else:
                # Send file (will send download link in free mode)
                success, msg = send_whatsapp_file(chat_id, gcs_path, filename)
                
                if success:
                    response_message = None  # Message already sent
                else:
                    response_message = f"❌ Could not get file: {msg}"
        
        classification['command_type'] = 'get_file'
        classification['summary'] = f"Get file #{file_num}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # DOCUMENT SEARCH - find: query or find query (Using Vertex AI)
    # =========================================================================
    find_match = re.match(r'^(?:find|search|doc|docs)[:\s]+(.+)$', lower_text, re.IGNORECASE)
    if find_match:
        search_query = find_match.group(1).strip()
        
        # Check if project is specified
        project_name = None
        for p in projects:
            if p['name'].lower() in search_query.lower():
                project_name = p['name']
                # Remove project name from search
                search_query = re.sub(re.escape(p['name']), '', search_query, flags=re.IGNORECASE).strip()
                break
        
        results = search_documents(search_query, project_name, limit=5)
        
        # Save results for `get` command
        if results:
            save_search_results(chat_id, results)
        
        if results:
            lines = [f"📄 *Found {len(results)} documents*\n"]
            for i, doc in enumerate(results, 1):
                name = doc['name'][:40] if doc['name'] else 'Unnamed'
                folder = doc['path'] if doc['path'] else ''
                
                lines.append(f"{i}. *{name}*")
                if folder:
                    lines.append(f"   📁 {folder}")
            
            lines.append(f"\n_Type `g 1` to get download link_")
            response_message = "\n".join(lines)
        else:
            response_message = f"""📄 *Search: {search_query}*

🔍 No documents found.

Try:
• Different keywords
• Check spelling
• Broader search terms"""
        
        classification['command_type'] = 'find'
        classification['summary'] = f"Search: {search_query}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # DONE - Mark item as complete
    # =========================================================================
    done_match = re.match(r'^done\s+(?:(\S+)\s+)?(\d+)$', lower_text)
    if done_match:
        project_hint = done_match.group(1)
        item_num = int(done_match.group(2))
        
        project_name = None
        if project_hint:
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
        
        success, msg = mark_item_done(project_name, item_num)
        
        if success:
            response_message = f"✅ *Done!* Item #{item_num} marked complete"
        else:
            response_message = f"❌ Error: {msg}"
        
        classification['command_type'] = 'done'
        classification['summary'] = f"Marked item {item_num} done"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # ASSIGN - Assign item to someone
    # =========================================================================
    assign_match = re.match(r'^assign\s+(?:(\S+)\s+)?(\d+)\s+(?:to\s+)?(.+)$', lower_text)
    if assign_match:
        project_hint = assign_match.group(1)
        item_num = int(assign_match.group(2))
        assignee = assign_match.group(3).strip()
        
        project_name = None
        if project_hint:
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
        
        success, msg = assign_item(project_name, item_num, assignee)
        
        if success:
            response_message = f"👤 *Assigned!* Item #{item_num} → {assignee}"
        else:
            response_message = f"❌ Error: {msg}"
        
        classification['command_type'] = 'assign'
        classification['summary'] = f"Assigned item {item_num} to {assignee}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # ESCALATE - Set to high urgency
    # =========================================================================
    escalate_match = re.match(r'^(escalate|high)\s+(?:(\S+)\s+)?(\d+)$', lower_text)
    if escalate_match:
        project_hint = escalate_match.group(2)
        item_num = int(escalate_match.group(3))
        
        project_name = None
        if project_hint:
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
        
        success, msg = set_item_urgency(project_name, item_num, 'high')
        
        if success:
            response_message = f"🔴 *Escalated!* Item #{item_num} is now HIGH priority"
        else:
            response_message = f"❌ Error: {msg}"
        
        classification['command_type'] = 'escalate'
        classification['summary'] = f"Escalated item {item_num}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # DEFER - Set to low urgency
    # =========================================================================
    defer_match = re.match(r'^(defer|low)\s+(?:(\S+)\s+)?(\d+)$', lower_text)
    if defer_match:
        project_hint = defer_match.group(2)
        item_num = int(defer_match.group(3))
        
        project_name = None
        if project_hint:
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
        
        success, msg = set_item_urgency(project_name, item_num, 'low')
        
        if success:
            response_message = f"⚪ *Deferred!* Item #{item_num} is now LOW priority"
        else:
            response_message = f"❌ Error: {msg}"
        
        classification['command_type'] = 'defer'
        classification['summary'] = f"Deferred item {item_num}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # DIGEST - Daily digest
    # =========================================================================
    if lower_text in ['digest', 'morning', 'daily']:
        response_message = generate_daily_digest()
        classification['command_type'] = 'digest'
        classification['summary'] = "Daily digest requested"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # LIST PROJECT ITEMS
    # =========================================================================
    list_match = re.match(r'^list\s+(.+)$', lower_text, re.IGNORECASE)
    if list_match:
        project_hint = list_match.group(1).strip()
        matched = match_project(project_hint, projects)
        
        if matched:
            items = get_project_pending_items(matched['name'], limit=15)
            
            if items:
                lines = [f"📋 *{matched['name']}* - Pending ({len(items)})\n"]
                for i, item in enumerate(items, 1):
                    urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                    assigned = f" → {item['assigned_to']}" if item.get('assigned_to') else ""
                    lines.append(f"{i}. {urgency_icon} {item['summary'][:40]}{assigned}")
                lines.append(f"\n_`done {matched['name'][:5]} 1` to complete_")
                response_message = "\n".join(lines)
            else:
                response_message = f"📋 *{matched['name']}*\n\n✨ No pending items!"
        else:
            response_message = f"❓ Project '{project_hint}' not found."
        
        classification['command_type'] = 'list_project'
        classification['project_name'] = matched['name'] if matched else None
        classification['summary'] = f"List items for {project_hint}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # ACTIVITY
    # =========================================================================
    activity_match = re.match(r'^activity\s+(.+)$', lower_text, re.IGNORECASE)
    if activity_match:
        project_hint = activity_match.group(1).strip()
        matched = match_project(project_hint, projects)
        
        if matched:
            items = get_project_recent_activity(matched['name'], limit=10)
            
            if items:
                lines = [f"📊 *{matched['name']}* - Last 24h ({len(items)})\n"]
                for item in items:
                    action_icon = "⚡" if item['actionable'] else "💬"
                    lines.append(f"{action_icon} {item['sender'][:12]}: {item['summary'][:30]}")
                response_message = "\n".join(lines)
            else:
                response_message = f"📊 *{matched['name']}*\n\n🔇 No activity in 24h"
        else:
            response_message = f"❓ Project '{project_hint}' not found."
        
        classification['command_type'] = 'activity'
        classification['project_name'] = matched['name'] if matched else None
        classification['summary'] = f"Activity for {project_hint}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # QUICK STATUS - Just project name
    # =========================================================================
    matched_project = match_project(lower_text, projects)
    
    if matched_project and len(lower_text.split()) <= 3:
        stats = get_project_stats(matched_project['name'])
        
        status_emoji = "🟢" if stats['pending_tasks'] == 0 else "🟡" if stats['pending_tasks'] < 5 else "🔴"
        
        response_message = f"""📊 *{matched_project['name']}* {status_emoji}

📍 {matched_project.get('location', 'N/A')} | 👤 {matched_project.get('client', 'N/A')}

📋 Pending: {stats['pending_tasks']} | 🔴 Urgent: {stats['high_urgency']}
💬 Messages (24h): {stats['recent_messages']}

_`l {matched_project['name'][:6]}` for items | `f {matched_project['name'][:6]} drawing` to search docs_"""
        
        classification['command_type'] = 'project_status'
        classification['project_name'] = matched_project['name']
        classification['summary'] = f"Status for {matched_project['name']}"
    
    # =========================================================================
    # TODAY
    # =========================================================================
    elif lower_text in ['today', 'اليوم', "what's today", 'whats today']:
        items = get_today_items()
        
        if items:
            lines = [f"📅 *Today* ({len(items)})\n"]
            for i, item in enumerate(items[:10], 1):
                urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                status_icon = "✅" if item['status'] == 'done' else "⏳"
                lines.append(f"{i}. {urgency_icon}{status_icon} *{item['project']}*: {item['summary'][:35]}")
            response_message = "\n".join(lines)
        else:
            response_message = "📅 *Today*\n\n✨ No actionable items today!"
        
        classification['command_type'] = 'today'
        classification['summary'] = "Today's items"
    
    # =========================================================================
    # URGENT
    # =========================================================================
    elif lower_text in ['urgent', 'عاجل', 'high priority', 'critical']:
        items = get_urgent_items()
        
        if items:
            lines = [f"🔴 *Urgent* ({len(items)})\n"]
            for i, item in enumerate(items[:10], 1):
                lines.append(f"{i}. *{item['project']}*: {item['summary'][:35]}")
            lines.append(f"\n_`done 1` to complete_")
            response_message = "\n".join(lines)
        else:
            response_message = "🔴 *Urgent*\n\n✨ No urgent items!"
        
        classification['command_type'] = 'urgent'
        classification['summary'] = "Urgent items"
    
    # =========================================================================
    # PENDING
    # =========================================================================
    elif lower_text in ['pending', 'معلق', 'open', 'tasks', 'مهام']:
        items = get_all_pending_items()
        
        if items:
            by_project = {}
            for item in items:
                proj = item['project'] or 'Unassigned'
                if proj not in by_project:
                    by_project[proj] = []
                by_project[proj].append(item)
            
            lines = [f"📋 *Pending* ({len(items)})\n"]
            for proj, proj_items in list(by_project.items())[:5]:
                lines.append(f"\n*{proj}* ({len(proj_items)})")
                for item in proj_items[:3]:
                    urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                    lines.append(f"  {urgency_icon} {item['summary'][:30]}")
            
            lines.append(f"\n_`l ProjectName` for full list_")
            response_message = "\n".join(lines)
        else:
            response_message = "📋 *Pending*\n\n✨ All clear!"
        
        classification['command_type'] = 'pending'
        classification['summary'] = "Pending items"
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    elif lower_text in ['summary', 'summarize', 'ملخص', 'report']:
        pending = get_all_pending_items()
        urgent = get_urgent_items()
        today = get_today_items()
        
        response_message = f"""📊 *Summary*
        
🔴 Urgent: {len(urgent)}
📋 Pending: {len(pending)}
📅 Today: {len(today)}

Top Items:"""
        
        for item in urgent[:3]:
            response_message += f"\n• *{item['project']}*: {item['summary'][:25]}"
        
        if not urgent:
            response_message += "\n✨ No urgent items!"
        
        classification['command_type'] = 'summary'
        classification['summary'] = "Summary"
    
    # =========================================================================
    # HELP
    # =========================================================================
    elif lower_text in ['help', 'مساعدة', 'commands', '?']:
        response_message = """🤖 *Commands*

*Quick:*
`s` summary | `u` urgent | `p` pending
`t` today | `d` digest | `h` help

*Projects:*
`Agora` - status
`l agora` - list items
`a agora` - activity

*Documents:*
`f agora floor drawing` - search
`find: shop drawing` - search all
`g 1` - get download link #1

*Actions:*
`done 1` - complete #1
`done agora 1` - complete Agora #1
`assign 1 to Ahmed` - assign
`escalate 1` - make urgent
`defer 1` - make low priority

*Create:*
`task: Agora - Description`
`note: Agora - Info`"""
        
        classification['command_type'] = 'help'
        classification['summary'] = "Help"
    
    # =========================================================================
    # TASK CREATION
    # =========================================================================
    elif lower_text.startswith('task:'):
        task_match = re.match(r'task:\s*(.+?)\s*-\s*(.+)', text, re.IGNORECASE)
        if task_match:
            project_hint = task_match.group(1).strip()
            task_desc = task_match.group(2).strip()
            
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
            
            classification['project_name'] = project_name
            classification['is_actionable'] = True
            classification['action_type'] = 'task'
            classification['summary'] = task_desc
            classification['urgency'] = 'medium'
            classification['command_type'] = 'create_task'
            
            response_message = f"✅ *Task Created*\n\n📁 {project_name or 'Unassigned'}\n📝 {task_desc}"
    
    # =========================================================================
    # NOTE
    # =========================================================================
    elif lower_text.startswith('note:'):
        note_match = re.match(r'note:\s*(.+?)\s*-\s*(.+)', text, re.IGNORECASE)
        if note_match:
            project_hint = note_match.group(1).strip()
            note_text = note_match.group(2).strip()
            
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
            
            classification['project_name'] = project_name
            classification['is_actionable'] = False
            classification['action_type'] = 'note'
            classification['summary'] = note_text
            classification['command_type'] = 'create_note'
            
            response_message = f"📝 *Note Logged*\n\n📁 {project_name or 'General'}\n💬 {note_text}"
    
    # =========================================================================
    # STATUS QUERY
    # =========================================================================
    elif re.search(r"(what'?s?|show|get)\s+(pending|status|open|items)\s+(on|for|in)\s+(.+)", lower_text):
        query_match = re.search(r"(what'?s?|show|get)\s+(pending|status|open|items)\s+(on|for|in)\s+(.+)", lower_text)
        if query_match:
            project_hint = query_match.group(4).strip().rstrip('?')
            matched = match_project(project_hint, projects)
            
            if matched:
                items = get_project_pending_items(matched['name'], limit=10)
                
                if items:
                    lines = [f"📋 *{matched['name']}* ({len(items)})\n"]
                    for i, item in enumerate(items, 1):
                        urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                        lines.append(f"{i}. {urgency_icon} {item['summary'][:35]}")
                    lines.append(f"\n_`done {matched['name'][:5]} 1` to complete_")
                    response_message = "\n".join(lines)
                else:
                    response_message = f"📋 *{matched['name']}*\n\n✨ No pending items!"
            else:
                response_message = f"❓ '{project_hint}' not found."
            
            classification['command_type'] = 'query_status'
            classification['project_name'] = matched['name'] if matched else None
            classification['summary'] = f"Query for {project_hint}"
    
    # =========================================================================
    # FALLBACK
    # =========================================================================
    else:
        classification['is_command'] = False
        classification['action_type'] = 'info'
        classification['summary'] = text[:100]
    
    if response_message and chat_id:
        send_whatsapp_message(chat_id, response_message)
    
    return classification


# =============================================================================
# MESSAGE CLASSIFICATION
# =============================================================================

def extract_deadline(text):
    """Extract deadline from message text"""
    lower = text.lower()
    today = datetime.now(timezone.utc)
    
    if 'today' in lower or 'اليوم' in lower:
        return today.strftime('%Y-%m-%d')
    if 'tomorrow' in lower or 'بكره' in lower or 'غدا' in lower:
        return (today + timedelta(days=1)).strftime('%Y-%m-%d')
    
    days = {'sunday': 6, 'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4, 'saturday': 5,
            'الأحد': 6, 'الاثنين': 0, 'الثلاثاء': 1, 'الأربعاء': 2, 'الخميس': 3, 'الجمعة': 4, 'السبت': 5}
    for day, num in days.items():
        if day in lower:
            days_ahead = num - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')
    
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
    """Extract assigned person from message"""
    mention = re.search(r'@(\w+)', text)
    if mention:
        return mention.group(1)
    
    assign_match = re.search(r'(?:to|for|assign(?:ed)?(?:\s+to)?)\s+([A-Z][a-z]+)', text)
    if assign_match:
        return assign_match.group(1)
    
    return None


def classify_message(message_text, sender, group_name, projects, group_config, chat_id=None):
    """Use Vertex AI to classify WhatsApp message"""
    mapped_project = group_config.get('project') if group_config else None
    group_type = group_config.get('type', 'internal') if group_config else 'internal'
    group_priority = group_config.get('priority', 'medium') if group_config else 'medium'
    
    if group_type == 'command':
        return handle_command(message_text, sender, projects, chat_id)
    
    deadline = extract_deadline(message_text)
    assignee = extract_assignee(message_text)
    
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
        
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            result = json.loads(json_match.group())
            if not result.get('project_name') and mapped_project and mapped_project != '__general__':
                result['project_name'] = mapped_project
            result['channel_type'] = group_type
            if deadline and not result.get('deadline'):
                result['deadline'] = deadline
            if assignee and not result.get('assigned_to'):
                result['assigned_to'] = assignee
            return result
    except Exception as e:
        print(f"AI classification error: {e}")
    
    result = fallback_classify(message_text, group_name, projects, mapped_project, group_type, group_priority)
    if deadline:
        result['deadline'] = deadline
    if assignee:
        result['assigned_to'] = assignee
    return result


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
    if any(kw in lower_text for kw in ['urgent', 'asap', 'immediately', 'today', 'عاجل']):
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
# SAVE & AUTO-ADD
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
        print(f"Saved: {doc_data['summary'][:50]}")
        return True
    except Exception as e:
        print(f"Error saving: {e}")
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
            print(f"Auto-added group: {group_name}")
        else:
            existing_data = existing.to_dict()
            existing_name = existing_data.get('name', '')
            if group_name and not group_name.replace('@g.us', '').isdigit() and existing_name.replace('@g.us', '').isdigit():
                group_ref.update({'name': group_name})
    except Exception as e:
        print(f"Error auto-adding group: {e}")


# =============================================================================
# HTTP HANDLER
# =============================================================================

@functions_framework.http
def whatsapp_webhook(request):
    """Handle incoming WhatsApp webhooks"""
    if request.method == 'OPTIONS':
        return ('', 204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        })
    
    headers = {'Access-Control-Allow-Origin': '*'}
    
    if request.method == 'GET':
        return (jsonify({
            'status': 'WhatsApp Webhook v4.10 - IAM SignBlob Fix',
            'waha_plus': WAHA_PLUS_ENABLED,
            'features': ['done', 'assign', 'escalate', 'defer', 'shortcuts', 'digest', 'vertex_search', 'download_links', 'iam_signblob'],
            'waha_url': WAHA_API_URL,
            'vertex_ai': VERTEX_AI_ENABLED,
            'search_engine': ENGINE_ID
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
            
            if payload.get('fromMe', False):
                return (jsonify({'status': 'skipped', 'reason': 'own message'}), 200, headers)
            
            group_name = ''
            if is_group:
                group_name = get_cached_group_name(chat_id)
                if not group_name or group_name.replace('@g.us', '').isdigit():
                    waha_name = get_group_name_from_waha(chat_id)
                    if waha_name:
                        group_name = waha_name
                if not group_name:
                    group_name = chat_id.replace('@g.us', '')
            
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
                chat_id
            )
            
            save_message(message_data, classification)
            
            return (jsonify({
                'status': 'processed',
                'group': group_name,
                'project': classification.get('project_name'),
                'actionable': classification.get('is_actionable'),
                'command': classification.get('command_type'),
                'summary': classification.get('summary', '')[:50]
            }), 200, headers)
            
        except Exception as e:
            print(f"Webhook error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
