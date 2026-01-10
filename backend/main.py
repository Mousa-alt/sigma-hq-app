import os
import io
import zipfile
import json
import urllib.parse
import base64
import re
from datetime import datetime, timedelta
import functions_framework
from flask import jsonify, Response
from google.auth import default
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.cloud import storage
from google.cloud import firestore
from google.cloud import discoveryengine_v1 as discoveryengine
import google.generativeai as genai

# Configuration
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'sigma-docs-repository')
MAX_FILE_SIZE_MB = int(os.environ.get('MAX_FILE_SIZE_MB', '100'))
SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.html', '.htm', '.csv'}
ARCHIVE_EXTENSIONS = {'.zip'}
SKIP_EXTENSIONS = {'.dwg', '.dxf', '.dwl', '.dwl2', '.bak', '.tmp', '.rtf'}

PROJECT_ID = "sigma-hq-technical-office"
LOCATION = "global"
ENGINE_ID = "sigma-search_1767650825639"

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

# Firestore config for WhatsApp search integration
FIREBASE_PROJECT = os.environ.get('FIREBASE_PROJECT', 'sigma-hq-38843')
APP_ID = os.environ.get('APP_ID', 'sigma-hq-production')

# Initialize clients
credentials, _ = default(scopes=[
    'https://www.googleapis.com/auth/drive.readonly', 
    'https://www.googleapis.com/auth/cloud-platform'
])
drive_service = build('drive', 'v3', credentials=credentials)
storage_client = storage.Client(credentials=credentials)

# Initialize Firestore for file indexing
try:
    firestore_client = firestore.Client(project=FIREBASE_PROJECT)
    FIRESTORE_ENABLED = True
except Exception as e:
    print(f"Firestore init error: {e}")
    firestore_client = None
    FIRESTORE_ENABLED = False

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# =============================================================================
# DOCUMENT HIERARCHY SYSTEM
# =============================================================================

DOCUMENT_HIERARCHY = {
    'shop_drawing': {'priority': 100, 'label': 'Shop Drawing', 'description': 'Shop Drawing'},
    'approval': {'priority': 90, 'label': 'Approval', 'description': 'Material/Shop Drawing Approval'},
    'rfi': {'priority': 85, 'label': 'RFI', 'description': 'Request for Information Response'},
    'mom': {'priority': 80, 'label': 'MOM', 'description': 'Minutes of Meeting'},
    'submittal': {'priority': 75, 'label': 'Submittal', 'description': 'Material Submittal'},
    'specification': {'priority': 70, 'label': 'Spec', 'description': 'Technical Specification'},
    'boq': {'priority': 65, 'label': 'BOQ', 'description': 'Bill of Quantities'},
    'vo': {'priority': 60, 'label': 'VO', 'description': 'Variation Order (Financial)'},
    'contract': {'priority': 55, 'label': 'Contract', 'description': 'Contract Document'},
    'correspondence': {'priority': 50, 'label': 'Letter', 'description': 'Correspondence'},
    'report': {'priority': 45, 'label': 'Report', 'description': 'Site/Progress Report'},
    'drawing': {'priority': 40, 'label': 'Drawing', 'description': 'Design Drawing'},
    'invoice': {'priority': 35, 'label': 'Invoice', 'description': 'Invoice/Payment'},
    'procurement': {'priority': 33, 'label': 'Procurement', 'description': 'Purchase Order / Quotation'},
    'other': {'priority': 10, 'label': 'Document', 'description': 'General Document'},
}

def detect_document_type(filename, path):
    """
    Detect document type based on FOLDER PATH (primary) and filename (secondary).
    Supports both OLD and NEW folder structures.
    """
    lower_name = filename.lower()
    lower_path = path.lower()
    
    # --- Variation Orders (Financial) ---
    if '08.variation' in lower_path or 'extra work' in lower_path:
        return 'vo'
    
    # --- Shop Drawings (Sigma's work) ---
    if '01.drawings' in lower_path and '02.drawings' in lower_path:
        return 'shop_drawing'
    if '04-shop' in lower_path or '04_shop' in lower_path:
        return 'shop_drawing'
    if '/drawings/' in lower_path and 'design' not in lower_path:
        return 'shop_drawing'
    
    # --- Design Drawings (Client's) ---
    if '02.design' in lower_path or '02-design' in lower_path:
        return 'drawing'
    
    # --- MOM ---
    if '01.mom' in lower_path or '/mom/' in lower_path or '06.mom' in lower_path:
        return 'mom'
    
    # --- Reports ---
    if '02.report' in lower_path or '07-site' in lower_path or '/reports/' in lower_path:
        return 'report'
    
    # --- Invoices ---
    if '07.invoice' in lower_path or '/invoices/' in lower_path:
        return 'invoice'
    
    # --- Submittals ---
    if '10.submittal' in lower_path or '/submittal' in lower_path:
        return 'submittal'
    
    # --- BOQ / QS ---
    if '04.qs' in lower_path or '06-quantity' in lower_path or '/qs/' in lower_path:
        return 'boq'
    
    # --- Contract ---
    if '03.loi' in lower_path or '01-contract' in lower_path:
        return 'contract'
    
    # --- Specifications ---
    if '03-spec' in lower_path or '/spec/' in lower_path:
        return 'specification'
    
    # --- RFI ---
    if '/rfi/' in lower_path:
        return 'rfi'
    
    # --- Correspondence ---
    if '09-corr' in lower_path or '/correspondence/' in lower_path:
        return 'correspondence'
    
    # Filename-based fallback
    if re.search(r'\bvo\b|variation', lower_name): return 'vo'
    if re.search(r'\bmom\b|minute.?of.?meeting', lower_name): return 'mom'
    if re.search(r'\brfi\b', lower_name): return 'rfi'
    if re.search(r'invoice|inv[-_]\d', lower_name): return 'invoice'
    if re.search(r'submittal', lower_name): return 'submittal'
    if re.search(r'report', lower_name): return 'report'
    if re.search(r'أمر.?شراء|عرض.?سعر|purchase|quotation|po[-_]', lower_name): return 'procurement'
    
    return 'other'

def detect_email_type(subject, body=''):
    """Detect email document type from subject and body"""
    text = f"{subject} {body}".lower()
    
    if re.search(r'\brfi\b|request.?for.?information', text): return 'rfi'
    if re.search(r'approv|موافقة', text): return 'approval'
    if re.search(r'shop.?draw|شوب', text): return 'shop_drawing'
    if re.search(r'submittal|تقديم', text): return 'submittal'
    if re.search(r'\bvo\b|variation|فارييشن', text): return 'vo'
    if re.search(r'invoice|فاتورة|inv[-_]\d', text): return 'invoice'
    if re.search(r'أمر.?شراء|عرض.?سعر|purchase|quotation|po[-_]|procurement', text): return 'procurement'
    if re.search(r'mom|minute|محضر|اجتماع', text): return 'mom'
    if re.search(r'report|تقرير', text): return 'report'
    
    return 'correspondence'

def get_document_priority(filename, path):
    doc_type = detect_document_type(filename, path)
    base_priority = DOCUMENT_HIERARCHY.get(doc_type, DOCUMENT_HIERARCHY['other'])['priority']
    rev_match = re.search(r'rev[._-]?(\d+)|r(\d+)', filename.lower())
    if rev_match:
        rev_num = int(rev_match.group(1) or rev_match.group(2))
        base_priority += min(rev_num * 2, 10)
    if 'final' in filename.lower() or 'approved' in filename.lower():
        base_priority += 15
    return base_priority, doc_type


# =============================================================================
# FIRESTORE FILE INDEXING (for WhatsApp search)
# =============================================================================

def index_file_to_firestore(project_name, file_path, file_info, drive_id=None):
    """Index a single file to Firestore for WhatsApp search"""
    if not FIRESTORE_ENABLED or not firestore_client:
        return False
    
    try:
        # Create a unique doc ID from path
        doc_id = re.sub(r'[^a-zA-Z0-9]', '_', file_path)[:100]
        
        filename = os.path.basename(file_path)
        doc_type = detect_document_type(filename, file_path)
        
        # Get folder path
        folder_path = os.path.dirname(file_path)
        
        doc_data = {
            'name': filename,
            'path': file_path,
            'folder_path': folder_path,
            'project': project_name,
            'project_name': project_name,
            'drive_id': drive_id or file_info.get('id', ''),
            'drive_link': f"https://drive.google.com/file/d/{drive_id or file_info.get('id', '')}" if (drive_id or file_info.get('id')) else '',
            'doc_type': doc_type,
            'doc_type_label': DOCUMENT_HIERARCHY.get(doc_type, {}).get('label', 'Document'),
            'size': file_info.get('size', 0),
            'modified_time': file_info.get('modifiedTime', ''),
            'indexed_at': datetime.now().isoformat(),
            'source': 'drive_sync'
        }
        
        # Save to Firestore
        firestore_client.collection('artifacts').document(APP_ID)\
            .collection('public').document('data')\
            .collection('synced_files').document(doc_id).set(doc_data, merge=True)
        
        return True
    except Exception as e:
        print(f"Error indexing file to Firestore: {e}")
        return False


def remove_file_from_firestore(project_name, file_path):
    """Remove a file from Firestore index"""
    if not FIRESTORE_ENABLED or not firestore_client:
        return False
    
    try:
        doc_id = re.sub(r'[^a-zA-Z0-9]', '_', file_path)[:100]
        firestore_client.collection('artifacts').document(APP_ID)\
            .collection('public').document('data')\
            .collection('synced_files').document(doc_id).delete()
        return True
    except Exception as e:
        print(f"Error removing file from Firestore: {e}")
        return False


def bulk_index_to_firestore(project_name, files_dict):
    """Bulk index files to Firestore after sync"""
    if not FIRESTORE_ENABLED or not firestore_client:
        print("Firestore not enabled, skipping indexing")
        return 0
    
    indexed = 0
    batch = firestore_client.batch()
    batch_count = 0
    
    for file_path, file_info in files_dict.items():
        try:
            doc_id = re.sub(r'[^a-zA-Z0-9]', '_', f"{project_name}/{file_path}")[:100]
            filename = os.path.basename(file_path)
            doc_type = detect_document_type(filename, file_path)
            folder_path = os.path.dirname(file_path)
            
            doc_ref = firestore_client.collection('artifacts').document(APP_ID)\
                .collection('public').document('data')\
                .collection('synced_files').document(doc_id)
            
            doc_data = {
                'name': filename,
                'path': file_path,
                'full_path': f"{project_name}/{file_path}",
                'folder_path': folder_path,
                'project': project_name,
                'project_name': project_name,
                'drive_id': file_info.get('id', ''),
                'drive_link': f"https://drive.google.com/file/d/{file_info.get('id', '')}" if file_info.get('id') else '',
                'doc_type': doc_type,
                'doc_type_label': DOCUMENT_HIERARCHY.get(doc_type, {}).get('label', 'Document'),
                'size': file_info.get('size', 0),
                'modified_time': file_info.get('modifiedTime', ''),
                'indexed_at': datetime.now().isoformat(),
                'source': 'drive_sync'
            }
            
            batch.set(doc_ref, doc_data, merge=True)
            batch_count += 1
            indexed += 1
            
            # Commit every 400 docs (Firestore limit is 500)
            if batch_count >= 400:
                batch.commit()
                batch = firestore_client.batch()
                batch_count = 0
                
        except Exception as e:
            print(f"Error indexing {file_path}: {e}")
            continue
    
    # Commit remaining
    if batch_count > 0:
        batch.commit()
    
    print(f"Indexed {indexed} files to Firestore")
    return indexed


# =============================================================================
# SYNC FUNCTIONS
# =============================================================================

def extract_folder_id(drive_url):
    if 'folders/' in drive_url:
        return drive_url.split('folders/')[-1].split('?')[0].split('/')[0]
    return drive_url.strip('/')

def list_drive_files(folder_id, path=""):
    files = {}
    page_token = None
    while True:
        results = drive_service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields='nextPageToken, files(id, name, mimeType, modifiedTime, size)',
            pageToken=page_token, pageSize=1000
        ).execute()
        for item in results.get('files', []):
            item_path = f"{path}/{item['name']}" if path else item['name']
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                files.update(list_drive_files(item['id'], item_path))
            else:
                files[item_path] = {
                    'id': item['id'], 'name': item['name'],
                    'modifiedTime': item.get('modifiedTime', ''),
                    'size': int(item.get('size', 0))
                }
        page_token = results.get('nextPageToken')
        if not page_token: break
    return files

def list_gcs_files(bucket, prefix):
    files = {}
    for blob in bucket.list_blobs(prefix=prefix):
        if blob.name.endswith('/'): continue
        rel = blob.name[len(prefix):].lstrip('/')
        if rel: files[rel] = {'name': blob.name, 'updated': blob.updated.isoformat() if blob.updated else ''}
    return files

def sync_project(drive_url, project_name):
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = f"{project_name}/"
    max_size = MAX_FILE_SIZE_MB * 1024 * 1024
    
    print(f"Starting sync: {project_name}")
    drive_files = list_drive_files(extract_folder_id(drive_url))
    print(f"Found {len(drive_files)} files in Drive")
    gcs_files = list_gcs_files(bucket, prefix)
    print(f"Found {len(gcs_files)} files in GCS")
    
    stats = {'added': 0, 'updated': 0, 'deleted': 0, 'skipped': 0, 'protected': 0, 'indexed': 0, 'error': None}

    try:
        for path in list(gcs_files.keys()):
            # Skip deletion for:
            # - Files that exist in Drive (will be handled in sync)
            # - Extracted zip contents (_extracted/)
            # - Emails in 09-Correspondence/ (come from IMAP, not Drive)
            # - Any .json files (likely emails or metadata)
            if path not in drive_files and '_extracted/' not in path:
                if '09-Correspondence/' in path or path.endswith('.json'):
                    stats['protected'] += 1
                    print(f"PROTECTED (email): {path}")
                else:
                    bucket.blob(f"{prefix}{path}").delete()
                    # Also remove from Firestore index
                    remove_file_from_firestore(project_name, path)
                    stats['deleted'] += 1

        for path, info in drive_files.items():
            ext = os.path.splitext(info['name'].lower())[1]
            if ext in SKIP_EXTENSIONS or info['size'] > max_size or (ext not in SUPPORTED_EXTENSIONS and ext not in ARCHIVE_EXTENSIONS):
                stats['skipped'] += 1
                continue
            
            needs_sync, is_update = True, False
            if path in gcs_files:
                try:
                    d_time = datetime.fromisoformat(info['modifiedTime'].replace('Z', '+00:00'))
                    g_time = datetime.fromisoformat(gcs_files[path]['updated'].replace('Z', '+00:00'))
                    if d_time <= g_time: needs_sync = False
                    else: is_update = True
                except: pass
            
            if needs_sync:
                req = drive_service.files().get_media(fileId=info['id'])
                fh = io.BytesIO()
                dl = MediaIoBaseDownload(fh, req)
                done = False
                while not done: _, done = dl.next_chunk()
                content = fh.getvalue()
                bucket.blob(f"{prefix}{path}").upload_from_string(content)
                
                if ext == '.zip':
                    try:
                        with zipfile.ZipFile(io.BytesIO(content)) as zf:
                            for zi in zf.infolist():
                                if not zi.is_dir() and os.path.splitext(zi.filename.lower())[1] in SUPPORTED_EXTENSIONS:
                                    bucket.blob(f"{prefix}{path}_extracted/{zi.filename}").upload_from_string(zf.read(zi))
                    except: pass
                
                if is_update: stats['updated'] += 1
                else: stats['added'] += 1

        # Index all synced files to Firestore for WhatsApp search
        stats['indexed'] = bulk_index_to_firestore(project_name, drive_files)

        print(f"DONE! Added:{stats['added']} Updated:{stats['updated']} Deleted:{stats['deleted']} Protected:{stats['protected']} Skipped:{stats['skipped']} Indexed:{stats['indexed']}")
    except Exception as e:
        stats['error'] = str(e)
        print(f"Sync error: {e}")
    
    return stats

# =============================================================================
# DELETE PROJECT
# =============================================================================

def delete_project_files(project_name):
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = f"{project_name}/"
    deleted_count = 0
    blobs = list(bucket.list_blobs(prefix=prefix))
    for blob in blobs:
        blob.delete()
        deleted_count += 1
    
    # Also clean up Firestore index
    if FIRESTORE_ENABLED and firestore_client:
        try:
            docs = firestore_client.collection('artifacts').document(APP_ID)\
                .collection('public').document('data')\
                .collection('synced_files')\
                .where('project', '==', project_name).stream()
            for doc in docs:
                doc.reference.delete()
        except Exception as e:
            print(f"Error cleaning Firestore index: {e}")
    
    return {'deleted': deleted_count, 'project': project_name}

# =============================================================================
# LATEST DOCUMENTS - APPROVED & RECENT
# =============================================================================

def extract_revision(filename):
    lower = filename.lower()
    patterns = [
        r'rev[._\-\s]?(\d+)',
        r'revision[._\-\s]?(\d+)',
        r'\br(\d+)\b',
        r'_r(\d+)_',
        r'-r(\d+)-',
        r'v(\d+)(?:\.\d+)?(?:[_\-\s]|$)',
    ]
    for pattern in patterns:
        match = re.search(pattern, lower)
        if match:
            rev_num = int(match.group(1))
            return rev_num, f"Rev {str(rev_num).zfill(2)}"
    return 0, None

def extract_subject(filename, path):
    lower = filename.lower()
    lower_path = path.lower()
    
    # Folder-based subject detection
    if '10.architecture' in lower_path or '/architecture/' in lower_path: return 'architectural'
    if '20.electrical' in lower_path or '/electrical/' in lower_path: return 'electrical'
    if '30.air conditioning' in lower_path or '/ac/' in lower_path or 'hvac' in lower_path: return 'mechanical'
    if '40.fire fighting' in lower_path or '/fire' in lower_path: return 'fire'
    if '50.plumbing' in lower_path or '/plumbing/' in lower_path: return 'plumbing'
    if '01.interior' in lower_path: return 'interior'
    if '04.lighting' in lower_path: return 'lighting'
    if '08.floor' in lower_path: return 'flooring'
    if '09.door' in lower_path: return 'door'
    if 'mep' in lower_path or 'x0.mep' in lower_path: return 'mep'
    
    # Filename-based fallback
    subjects = {
        'flooring': ['floor', 'tile', 'carpet', 'vinyl', 'marble', 'granite', 'porcelain'],
        'kitchen': ['kitchen', 'ktc', 'pantry'],
        'bathroom': ['bathroom', 'bath', 'toilet', 'wc', 'lavatory', 'washroom'],
        'ceiling': ['ceiling', 'clg', 'gypsum', 'soffit', 'bulkhead', 'rcp'],
        'wall': ['wall', 'partition', 'drywall', 'cladding'],
        'door': ['door', 'entrance', 'gate', 'shutter'],
        'window': ['window', 'glazing', 'curtain wall', 'facade', 'shop front'],
        'electrical': ['electrical', 'elec', 'lighting', 'power', 'small power', 'db', 'panel'],
        'mechanical': ['mechanical', 'mech', 'hvac', 'ac', 'ahu', 'fcu', 'duct', 'diffuser', 'grill'],
        'plumbing': ['plumbing', 'plumb', 'drainage', 'sanitary', 'water', 'pipe'],
        'fire': ['fire', 'sprinkler', 'smoke', 'alarm', 'firefighting'],
        'furniture': ['furniture', 'furn', 'joinery', 'millwork', 'casework', 'carpentry'],
        'signage': ['signage', 'sign', 'wayfinding', 'graphics'],
        'architectural': ['layout', 'plan', 'elevation', 'section', 'setting out', 'construction'],
    }
    for subject, keywords in subjects.items():
        for kw in keywords:
            if kw in lower or kw in lower_path:
                return subject
    
    code_match = re.search(r'-([aempf])-', lower)
    if code_match:
        code_map = {'a': 'architectural', 'e': 'electrical', 'm': 'mechanical', 'p': 'plumbing', 'f': 'fire'}
        if code_match.group(1) in code_map:
            return code_map[code_match.group(1)]
    
    return 'general'

def is_valid_document(filename):
    lower = filename.lower()
    ext = os.path.splitext(lower)[1]
    valid_ext = {'.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'}
    if ext not in valid_ext: return False
    skip_patterns = ['font', 'arial', 'calibri', 'times', 'helvetica', 'template', 'blank', 'empty', 'backup', 'copy of', 'old_', '~$', 'desktop.ini', 'thumbs.db', '.ds_store']
    for pattern in skip_patterns:
        if pattern in lower: return False
    return True

def get_latest_by_type(project_name):
    """Get latest documents - separated into APPROVED and RECENT sections"""
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = f"{project_name}/"
    
    approved_docs = []
    recent_docs = []
    
    for blob in bucket.list_blobs(prefix=prefix):
        if blob.name.endswith('/') or '_extracted/' in blob.name:
            continue
        
        filename = os.path.basename(blob.name)
        if not is_valid_document(filename):
            continue
        
        rel_path = blob.name[len(prefix):]
        lower_path = rel_path.lower()
        doc_type = detect_document_type(filename, rel_path)
        subject = extract_subject(filename, rel_path)
        rev_num, rev_str = extract_revision(filename)
        
        doc = {
            'name': filename,
            'path': rel_path,
            'fullPath': blob.name,
            'updated': blob.updated.isoformat() if blob.updated else '',
            'size': blob.size,
            'type': doc_type,
            'subject': subject,
            'revision': rev_num,
            'revisionStr': rev_str,
            'typeLabel': DOCUMENT_HIERARCHY.get(doc_type, {}).get('label', 'Document'),
            'typeDescription': DOCUMENT_HIERARCHY.get(doc_type, {}).get('description', 'Document')
        }
        
        # Check if in Approved folder
        if '/approved/' in lower_path or '05-approved' in lower_path or 'approved/' in lower_path:
            approved_docs.append(doc)
        else:
            recent_docs.append(doc)
    
    # Group and keep highest revision
    def group_docs(docs):
        groups = {}
        for doc in docs:
            key = f"{doc['type']}_{doc['subject']}"
            if key not in groups:
                groups[key] = doc
            elif doc['revision'] > groups[key]['revision']:
                groups[key] = doc
            elif doc['revision'] == groups[key]['revision'] and doc['updated'] > groups[key]['updated']:
                groups[key] = doc
        return groups
    
    approved_groups = group_docs(approved_docs)
    recent_groups = group_docs(recent_docs)
    
    def sort_key(x):
        return (DOCUMENT_HIERARCHY.get(x['type'], {}).get('priority', 0), x['revision'])
    
    return {
        'approved': sorted(approved_groups.values(), key=sort_key, reverse=True)[:12],
        'recent': sorted(recent_groups.values(), key=sort_key, reverse=True)[:12]
    }

# =============================================================================
# EMAIL FUNCTIONS
# =============================================================================

def get_project_emails(project_name, limit=10):
    """Get recent emails for a project from GCS"""
    bucket = storage_client.bucket(GCS_BUCKET)
    folder_name = project_name.replace(' ', '-')
    prefix = f"{folder_name}/09-Correspondence/"
    
    emails = []
    
    for blob in bucket.list_blobs(prefix=prefix):
        if not blob.name.endswith('.json'):
            continue
        if '_attachments/' in blob.name:
            continue
        
        try:
            content = blob.download_as_string()
            email_data = json.loads(content)
            emails.append({
                'subject': email_data.get('subject', 'No Subject'),
                'from': email_data.get('from', 'Unknown'),
                'to': email_data.get('to', ''),
                'date': email_data.get('date', ''),
                'type': email_data.get('classified_type', 'correspondence'),
                'path': blob.name,
                'hasAttachments': len(email_data.get('attachments', [])) > 0
            })
        except Exception as e:
            print(f"Error reading email {blob.name}: {e}")
            continue
    
    # Sort by date descending
    emails.sort(key=lambda x: x.get('date', ''), reverse=True)
    
    return emails[:limit]


def get_unclassified_emails():
    """Get all unclassified emails from _Unclassified_Emails folder"""
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = "_Unclassified_Emails/"
    
    emails = []
    
    for blob in bucket.list_blobs(prefix=prefix):
        if not blob.name.endswith('.json'):
            continue
        if '_attachments/' in blob.name:
            continue
        
        try:
            content = blob.download_as_string()
            email_data = json.loads(content)
            
            # Detect email type from subject/body
            subject = email_data.get('subject', '')
            body = email_data.get('body', '')
            doc_type = detect_email_type(subject, body)
            
            emails.append({
                'id': blob.name.replace(prefix, '').replace('.json', ''),
                'subject': subject or 'No Subject',
                'from': email_data.get('from', 'Unknown'),
                'to': email_data.get('to', ''),
                'date': email_data.get('date', ''),
                'type': doc_type,
                'typeLabel': DOCUMENT_HIERARCHY.get(doc_type, {}).get('label', 'Email'),
                'path': blob.name,
                'hasAttachments': len(email_data.get('attachments', [])) > 0,
                'body_preview': (body[:200] + '...') if len(body) > 200 else body
            })
        except Exception as e:
            print(f"Error reading email {blob.name}: {e}")
            continue
    
    # Sort by date descending
    emails.sort(key=lambda x: x.get('date', ''), reverse=True)
    
    return emails


def classify_email(email_path, project_name, doc_type=None):
    """Move an email from unclassified to a project folder"""
    bucket = storage_client.bucket(GCS_BUCKET)
    
    # Get the email blob
    source_blob = bucket.blob(email_path)
    if not source_blob.exists():
        return {'error': f'Email not found: {email_path}'}
    
    try:
        # Read the email data
        content = source_blob.download_as_string()
        email_data = json.loads(content)
        
        # Update the email data with classification
        if doc_type:
            email_data['classified_type'] = doc_type
        email_data['classified_project'] = project_name
        email_data['classified_at'] = datetime.now().isoformat()
        
        # Create destination path
        # Format: ProjectName/09-Correspondence/YYYYMMDD_HHMM_Subject.json
        filename = os.path.basename(email_path)
        dest_folder = f"{project_name}/09-Correspondence"
        dest_path = f"{dest_folder}/{filename}"
        
        # Copy to new location
        dest_blob = bucket.blob(dest_path)
        dest_blob.upload_from_string(json.dumps(email_data, ensure_ascii=False, indent=2))
        
        # Copy attachments if they exist
        attachments_prefix = email_path.replace('.json', '_attachments/')
        for att_blob in bucket.list_blobs(prefix=attachments_prefix):
            att_filename = os.path.basename(att_blob.name)
            att_dest_path = f"{dest_folder}/{filename.replace('.json', '_attachments')}/{att_filename}"
            bucket.copy_blob(att_blob, bucket, att_dest_path)
            att_blob.delete()
        
        # Delete original
        source_blob.delete()
        
        return {
            'success': True,
            'moved_to': dest_path,
            'project': project_name,
            'type': doc_type or email_data.get('classified_type', 'correspondence')
        }
        
    except Exception as e:
        return {'error': str(e)}


def classify_multiple_emails(emails_to_classify):
    """Classify multiple emails at once
    emails_to_classify: list of {path, project, type}
    """
    results = []
    for item in emails_to_classify:
        result = classify_email(
            item.get('path'),
            item.get('project'),
            item.get('type')
        )
        results.append({
            'path': item.get('path'),
            **result
        })
    
    success_count = sum(1 for r in results if r.get('success'))
    error_count = sum(1 for r in results if r.get('error'))
    
    return {
        'results': results,
        'success_count': success_count,
        'error_count': error_count
    }


# =============================================================================
# SEARCH
# =============================================================================

def is_arabic(text):
    return bool(re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+', text))

def search_documents(query, project_name=None):
    client = discoveryengine.SearchServiceClient()
    serving_config = f"projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection/engines/{ENGINE_ID}/servingConfigs/default_search"
    search_query = f"{query} {project_name}" if project_name else query
    
    request = discoveryengine.SearchRequest(
        serving_config=serving_config, query=search_query, page_size=20,
        content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
            snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(return_snippet=True, max_snippet_count=3),
            summary_spec=discoveryengine.SearchRequest.ContentSearchSpec.SummarySpec(summary_result_count=5, include_citations=True),
        ),
    )
    
    try: response = client.search(request)
    except Exception as e:
        return {'summary': f'Search error: {str(e)}', 'results': [], 'total': 0}
    
    results = []
    for result in response.results:
        doc = result.document
        doc_data = {'id': doc.id, 'title': '', 'link': '', 'snippets': [], 'priority': 0, 'docType': 'other', 'docTypeLabel': 'Document'}
        
        if doc.derived_struct_data:
            struct = dict(doc.derived_struct_data)
            doc_data['title'] = struct.get('title', struct.get('link', 'Unknown'))
            doc_data['link'] = struct.get('link', '')
            for snippet in struct.get('snippets', []):
                if isinstance(snippet, dict) and snippet.get('snippet'): doc_data['snippets'].append(snippet.get('snippet'))
            
            if project_name:
                link_lower = doc_data['link'].lower()
                project_lower = project_name.lower().replace(' ', '_').replace('-', '_')
                if project_lower not in link_lower.replace('-', '_'): continue
            
            filename = os.path.basename(doc_data['link'])
            priority, doc_type = get_document_priority(filename, doc_data['link'])
            doc_data['priority'] = priority
            doc_data['docType'] = doc_type
            doc_data['docTypeLabel'] = DOCUMENT_HIERARCHY.get(doc_type, {}).get('label', 'Document')
        
        results.append(doc_data)
    
    results.sort(key=lambda x: x['priority'], reverse=True)
    
    summary = ""
    if response.summary and response.summary.summary_text: summary = response.summary.summary_text
    if GEMINI_API_KEY and results:
        enhanced = generate_enhanced_response(query, results, project_name)
        if enhanced: summary = enhanced
    
    return {'summary': summary, 'results': results[:10], 'total': len(results)}

def generate_enhanced_response(query, results, project_name):
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        lang = "Arabic" if is_arabic(query) else "English"
        
        context_parts = []
        for i, r in enumerate(results[:5]):
            doc_info = DOCUMENT_HIERARCHY.get(r['docType'], {})
            context_parts.append(f"[{i+1}] {r['title']} | {doc_info.get('label', 'Doc')} | {' '.join(r['snippets'][:1])[:200]}")
        
        prompt = f"""You are a Technical Office AI for Sigma Contractors. Be BRIEF and use BULLETS.

PROJECT: {project_name or 'All Projects'}
QUESTION: {query}

DOCUMENTS FOUND:
{chr(10).join(context_parts)}

RESPOND IN {lang.upper()}. USE THIS EXACT FORMAT:

**Answer**
• [Direct answer - one line, specific value/material/dimension]

**History** (if multiple sources exist)
• [Oldest] Source → value/decision
• [Newer] Source → changed to X
• [Latest] Source → current value ✓

**Source**
• Document name (Rev XX) - most recent

RULES:
- Bullets only, no paragraphs
- One line per bullet
- Most recent = most likely truth
- If sources conflict: show both, note "⚠️ Verify which applies"
- If not found: "❌ Not in indexed docs. Check [folder]."
- Skip History section if only one source
"""

        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return None

# =============================================================================
# FILE OPERATIONS
# =============================================================================

def list_folder_files(project_name, folder_path):
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = f"{project_name}/{folder_path}/" if folder_path else f"{project_name}/"
    
    files = []
    blobs = bucket.list_blobs(prefix=prefix, delimiter='/')
    
    for blob in blobs:
        if blob.name == prefix or '_extracted/' in blob.name: continue
        rel_path = blob.name[len(prefix):]
        if not rel_path or '/' in rel_path: continue
        files.append({'name': rel_path, 'type': 'file', 'path': blob.name, 'size': blob.size, 'updated': blob.updated.isoformat() if blob.updated else ''})
    
    for prefix_obj in blobs.prefixes:
        folder_name = prefix_obj[len(prefix):].rstrip('/')
        if folder_name and '_extracted' not in folder_name:
            files.append({'name': folder_name, 'type': 'folder', 'path': prefix_obj})
    
    files.sort(key=lambda x: (0 if x['type'] == 'folder' else 1, x['name'].lower()))
    return files

def list_gcs_project_files(project_name):
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = f"{project_name}/"
    files = []
    for blob in bucket.list_blobs(prefix=prefix):
        if blob.name.endswith('/') or '_extracted/' in blob.name: continue
        rel_path = blob.name[len(prefix):]
        if rel_path: files.append({'name': os.path.basename(blob.name), 'path': rel_path, 'size': blob.size, 'updated': blob.updated.isoformat() if blob.updated else ''})
    return files

def get_project_stats(project_name):
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = f"{project_name}/"
    file_count, total_size, last_modified = 0, 0, None
    for blob in bucket.list_blobs(prefix=prefix):
        if blob.name.endswith('/') or '_extracted/' in blob.name: continue
        file_count += 1
        total_size += blob.size or 0
        if blob.updated and (last_modified is None or blob.updated > last_modified): last_modified = blob.updated
    return {'fileCount': file_count, 'totalSize': total_size, 'lastModified': last_modified.isoformat() if last_modified else None}

def view_file(file_path):
    bucket = storage_client.bucket(GCS_BUCKET)
    blob = bucket.blob(file_path)
    if not blob.exists(): return None, None, f"File not found: {file_path}"
    content = blob.download_as_bytes()
    ext = os.path.splitext(file_path.lower())[1]
    content_types = {'.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.doc': 'application/msword', '.xls': 'application/vnd.ms-excel', '.ppt': 'application/vnd.ms-powerpoint', '.txt': 'text/plain', '.csv': 'text/csv', '.html': 'text/html', '.htm': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif'}
    return content, content_types.get(ext, 'application/octet-stream'), None

def compare_documents(file1_path, file2_path):
    if not GEMINI_API_KEY: return {'error': 'Gemini API key not configured.'}
    bucket = storage_client.bucket(GCS_BUCKET)
    try:
        blob1, blob2 = bucket.blob(file1_path), bucket.blob(file2_path)
        if not blob1.exists(): return {'error': f'File 1 not found: {file1_path}'}
        if not blob2.exists(): return {'error': f'File 2 not found: {file2_path}'}
        content1, content2 = blob1.download_as_bytes(), blob2.download_as_bytes()
        file1_name, file2_name = os.path.basename(file1_path), os.path.basename(file2_path)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        mime_types = {'.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}
        mime1 = mime_types.get(os.path.splitext(file1_path.lower())[1], 'application/pdf')
        mime2 = mime_types.get(os.path.splitext(file2_path.lower())[1], 'application/pdf')
        
        prompt = f"""Compare these two document revisions. File 1 (Older): {file1_name}, File 2 (Newer): {file2_name}
Focus on: Layout changes, Added/removed items, Specification changes, Notes changes.
Use bullets, be brief."""
        
        response = model.generate_content([prompt, {'mime_type': mime1, 'data': base64.standard_b64encode(content1).decode('utf-8')}, {'mime_type': mime2, 'data': base64.standard_b64encode(content2).decode('utf-8')}])
        return {'comparison': response.text, 'file1': file1_name, 'file2': file2_name}
    except Exception as e:
        return {'error': str(e)}

# =============================================================================
# HTTP HANDLER
# =============================================================================

@functions_framework.http
def sync_drive_folder(request):
    if request.method == 'OPTIONS':
        return ('', 204, {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, DELETE', 'Access-Control-Allow-Headers': 'Content-Type'})
    
    headers = {'Access-Control-Allow-Origin': '*'}
    path = request.path
    
    if request.method == 'GET' and (path == '/' or path == '/health'):
        return (jsonify({'status': 'Sigma Sync Worker v5.9 - Firestore Indexing', 'capabilities': ['sync', 'search', 'list', 'files', 'view', 'compare', 'stats', 'latest', 'delete', 'emails', 'unclassified', 'classify', 'firestore_index'], 'gemini': 'enabled' if GEMINI_API_KEY else 'disabled', 'firestore': 'enabled' if FIRESTORE_ENABLED else 'disabled'}), 200, headers)
    
    # === EMAIL ENDPOINTS ===
    
    if request.method == 'GET' and path == '/emails':
        try:
            project = request.args.get('project', '')
            limit = int(request.args.get('limit', '10'))
            if not project: return (jsonify({'error': 'Missing project parameter'}), 400, headers)
            emails = get_project_emails(project, limit)
            return (jsonify({'emails': emails, 'count': len(emails), 'project': project}), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'GET' and path == '/unclassified':
        try:
            emails = get_unclassified_emails()
            return (jsonify({'emails': emails, 'count': len(emails)}), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST' and path == '/classify':
        try:
            data = request.get_json(silent=True) or {}
            
            # Single email classification
            if 'path' in data and 'project' in data:
                result = classify_email(data['path'], data['project'], data.get('type'))
                return (jsonify(result), 200, headers)
            
            # Batch classification
            if 'emails' in data:
                result = classify_multiple_emails(data['emails'])
                return (jsonify(result), 200, headers)
            
            return (jsonify({'error': 'Missing path/project or emails array'}), 400, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    # === OTHER ENDPOINTS ===
    
    if request.method == 'GET' and path == '/view':
        try:
            file_path = urllib.parse.unquote(request.args.get('path', ''))
            if not file_path: return (jsonify({'error': 'Missing path'}), 400, headers)
            content, content_type, error = view_file(file_path)
            if error: return (jsonify({'error': error}), 404, headers)
            return Response(content, mimetype=content_type, headers={'Access-Control-Allow-Origin': '*', 'Content-Disposition': f'inline; filename="{os.path.basename(file_path)}"', 'Cache-Control': 'public, max-age=3600'})
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST' and path == '/delete':
        try:
            data = request.get_json(silent=True) or {}
            project, confirm = data.get('projectName', ''), data.get('confirm', '')
            if not project: return (jsonify({'error': 'Missing projectName'}), 400, headers)
            if confirm != f"DELETE {project}": return (jsonify({'error': f'Confirmation required: "DELETE {project}"'}), 400, headers)
            return (jsonify(delete_project_files(project)), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST' and path == '/latest':
        try:
            data = request.get_json(silent=True) or {}
            project = data.get('projectName', '')
            if not project: return (jsonify({'error': 'Missing projectName'}), 400, headers)
            result = get_latest_by_type(project)
            return (jsonify({'approved': result['approved'], 'recent': result['recent']}), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST' and path == '/stats':
        try:
            data = request.get_json(silent=True) or {}
            project = data.get('projectName', '')
            if not project: return (jsonify({'error': 'Missing projectName'}), 400, headers)
            return (jsonify(get_project_stats(project)), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST' and path == '/files':
        try:
            data = request.get_json(silent=True) or {}
            project, folder = data.get('projectName', ''), data.get('folderPath', '')
            if not project: return (jsonify({'error': 'Missing projectName'}), 400, headers)
            files = list_folder_files(project, folder)
            return (jsonify({'files': files, 'count': len(files), 'path': f"{project}/{folder}"}), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST' and path == '/compare':
        try:
            data = request.get_json(silent=True) or {}
            file1, file2 = data.get('file1', ''), data.get('file2', '')
            if not file1 or not file2: return (jsonify({'error': 'Missing file1 or file2'}), 400, headers)
            if file1.startswith('gs://'): file1 = file1.replace(f'gs://{GCS_BUCKET}/', '')
            if file2.startswith('gs://'): file2 = file2.replace(f'gs://{GCS_BUCKET}/', '')
            return (jsonify(compare_documents(file1, file2)), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST' and path == '/search':
        try:
            data = request.get_json(silent=True) or {}
            query, project = data.get('query', ''), data.get('projectName', None)
            if not query: return (jsonify({'error': 'Missing query'}), 400, headers)
            return (jsonify(search_documents(query, project)), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST' and path == '/list':
        try:
            data = request.get_json(silent=True) or {}
            project = data.get('projectName', '')
            if not project: return (jsonify({'error': 'Missing projectName'}), 400, headers)
            files = list_gcs_project_files(project)
            return (jsonify({'files': files, 'total': len(files)}), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            drive_url, project_name = data.get('driveUrl'), data.get('projectName', 'default').replace(' ', '_')
            if not drive_url: return (jsonify({'error': 'Missing driveUrl'}), 400, headers)
            return (jsonify(sync_project(drive_url, project_name)), 200, headers)
        except Exception as e: return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
