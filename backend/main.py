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

# Initialize clients
credentials, _ = default(scopes=[
    'https://www.googleapis.com/auth/drive.readonly', 
    'https://www.googleapis.com/auth/cloud-platform'
])
drive_service = build('drive', 'v3', credentials=credentials)
storage_client = storage.Client(credentials=credentials)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# =============================================================================
# DOCUMENT HIERARCHY SYSTEM
# =============================================================================

DOCUMENT_HIERARCHY = {
    'cvi': {'priority': 100, 'label': 'CVI', 'description': 'Consultant Variation Instruction'},
    'vo': {'priority': 95, 'label': 'VO', 'description': 'Variation Order'},
    'approval': {'priority': 90, 'label': 'Approval', 'description': 'Material/Shop Drawing Approval'},
    'shop_drawing': {'priority': 80, 'label': 'Shop Drawing', 'description': 'Approved Shop Drawing'},
    'rfi': {'priority': 70, 'label': 'RFI', 'description': 'Request for Information Response'},
    'mom': {'priority': 60, 'label': 'MOM', 'description': 'Minutes of Meeting'},
    'submittal': {'priority': 55, 'label': 'Submittal', 'description': 'Material Submittal'},
    'specification': {'priority': 50, 'label': 'Spec', 'description': 'Technical Specification'},
    'boq': {'priority': 45, 'label': 'BOQ', 'description': 'Bill of Quantities'},
    'contract': {'priority': 40, 'label': 'Contract', 'description': 'Contract Document'},
    'correspondence': {'priority': 35, 'label': 'Letter', 'description': 'Correspondence'},
    'report': {'priority': 30, 'label': 'Report', 'description': 'Site/Progress Report'},
    'drawing': {'priority': 25, 'label': 'Drawing', 'description': 'Design Drawing'},
    'invoice': {'priority': 20, 'label': 'Invoice', 'description': 'Invoice/Payment'},
    'other': {'priority': 10, 'label': 'Document', 'description': 'General Document'},
}

def detect_document_type(filename, path):
    lower_name = filename.lower()
    lower_path = path.lower()
    
    if re.search(r'\bcvi\b|variation.?instruction', lower_name): return 'cvi'
    if re.search(r'\bvo\b|variation.?order', lower_name): return 'vo'
    if re.search(r'approv|approved', lower_name): return 'approval'
    if re.search(r'shop.?draw|sd[-_]|\bsd\d', lower_name): return 'shop_drawing'
    if re.search(r'\brfi\b|request.?for.?info', lower_name): return 'rfi'
    if re.search(r'\bmom\b|minute|meeting', lower_name): return 'mom'
    if re.search(r'submittal|submission', lower_name): return 'submittal'
    if re.search(r'spec|specification', lower_name): return 'specification'
    if re.search(r'\bboq\b|bill.?of.?quant|quantity', lower_name): return 'boq'
    if re.search(r'contract|agreement', lower_name): return 'contract'
    if re.search(r'letter|correspondence|ltr', lower_name): return 'correspondence'
    if re.search(r'report|progress|daily|weekly', lower_name): return 'report'
    if re.search(r'invoice|inv[-_]|payment|claim', lower_name): return 'invoice'
    if re.search(r'drawing|dwg|plan|elevation|section', lower_name): return 'drawing'
    
    if 'cvi' in lower_path or 'variation' in lower_path: return 'cvi'
    if 'shop' in lower_path and 'draw' in lower_path: return 'shop_drawing'
    if 'rfi' in lower_path: return 'rfi'
    if 'mom' in lower_path or 'meeting' in lower_path: return 'mom'
    if 'spec' in lower_path: return 'specification'
    if 'boq' in lower_path or 'quantity' in lower_path: return 'boq'
    if 'contract' in lower_path: return 'contract'
    if 'correspondence' in lower_path or 'letter' in lower_path: return 'correspondence'
    if 'invoice' in lower_path or 'payment' in lower_path: return 'invoice'
    
    return 'other'

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
    
    print(f"\U0001F680 Starting sync: {project_name}")
    drive_files = list_drive_files(extract_folder_id(drive_url))
    print(f"\U0001F4CB Found {len(drive_files)} files in Drive")
    gcs_files = list_gcs_files(bucket, prefix)
    print(f"\U0001F4CB Found {len(gcs_files)} files in GCS")
    
    stats = {'added': 0, 'updated': 0, 'deleted': 0, 'skipped': 0, 'error': None}

    try:
        for path in list(gcs_files.keys()):
            if path not in drive_files and '_extracted/' not in path:
                bucket.blob(f"{prefix}{path}").delete()
                print(f"\U0001F5D1 Deleted: {path}")
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
                print(f"\U0001F4E5 Processing: {info['name']}")
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
                print(f"\u2705 {'Updated' if is_update else 'Uploaded'}: {path}")

        print(f"\U0001F389 DONE! Added:{stats['added']} Updated:{stats['updated']} Deleted:{stats['deleted']} Skipped:{stats['skipped']}")
    except Exception as e:
        stats['error'] = str(e)
        print(f"\u274C Sync error: {e}")
    
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
        print(f"\U0001F5D1 Deleted: {blob.name}")
    print(f"\U0001F389 Deleted {deleted_count} files for project {project_name}")
    return {'deleted': deleted_count, 'project': project_name}

# =============================================================================
# LATEST DOCUMENTS - SMART (by Subject + Revision)
# =============================================================================

def extract_revision(filename):
    """Extract revision number from filename. Returns (rev_number, rev_string)"""
    lower = filename.lower()
    
    # Common patterns: Rev03, Rev.03, Rev-03, R03, Rev 03, Revision 3
    patterns = [
        r'rev[._\-\s]?(\d+)',      # Rev03, Rev.03, Rev-03, Rev 03
        r'revision[._\-\s]?(\d+)', # Revision03
        r'\br(\d+)\b',              # R03 (standalone)
        r'_r(\d+)_',                # _R03_
        r'-r(\d+)-',                # -R03-
        r'v(\d+)(?:\.\d+)?(?:[_\-\s]|$)',  # V03, V3.0
    ]
    
    for pattern in patterns:
        match = re.search(pattern, lower)
        if match:
            rev_num = int(match.group(1))
            return rev_num, f"Rev {str(rev_num).zfill(2)}"
    
    return 0, None

def extract_subject(filename, path):
    """Extract subject/discipline from filename (flooring, kitchen, MEP, etc.)"""
    lower = filename.lower()
    lower_path = path.lower()
    
    # Common construction disciplines/subjects
    subjects = {
        'flooring': ['floor', 'flooring', 'tile', 'carpet', 'vinyl', 'marble', 'granite', 'porcelain'],
        'kitchen': ['kitchen', 'ktc', 'kitch', 'pantry', 'k-'],
        'bathroom': ['bathroom', 'bath', 'toilet', 'wc', 'lavatory', 'washroom', 'restroom'],
        'ceiling': ['ceiling', 'clg', 'gypsum', 'soffit', 'bulkhead'],
        'wall': ['wall', 'partition', 'drywall', 'cladding'],
        'door': ['door', 'dr-', 'entrance', 'gate'],
        'window': ['window', 'glazing', 'curtain wall', 'facade'],
        'electrical': ['electrical', 'elec', 'elect', 'lighting', 'power', 'lv', 'mv', 'db', 'panel'],
        'mechanical': ['mechanical', 'mech', 'hvac', 'ac', 'ahu', 'fcu', 'duct', 'diffuser'],
        'plumbing': ['plumbing', 'plumb', 'drainage', 'sanitary', 'water', 'pipe'],
        'fire': ['fire', 'sprinkler', 'smoke', 'alarm', 'firefighting', 'ff'],
        'furniture': ['furniture', 'furn', 'ff&e', 'ffe', 'joinery', 'millwork', 'casework'],
        'signage': ['signage', 'sign', 'wayfinding', 'graphics'],
        'landscape': ['landscape', 'hardscape', 'softscape', 'irrigation', 'planting'],
        'structure': ['structural', 'struct', 'steel', 'concrete', 'rebar', 'foundation'],
        'architectural': ['architectural', 'arch', 'layout', 'plan', 'section', 'elevation'],
    }
    
    # Check filename first, then path
    for subject, keywords in subjects.items():
        for kw in keywords:
            if kw in lower or kw in lower_path:
                return subject
    
    # Try to extract from filename pattern like SD-FL-001 (FL = flooring)
    code_match = re.search(r'[_\-]([a-z]{2,4})[_\-]', lower)
    if code_match:
        code = code_match.group(1)
        code_map = {
            'fl': 'flooring', 'flr': 'flooring',
            'kt': 'kitchen', 'ktc': 'kitchen', 'k': 'kitchen',
            'bt': 'bathroom', 'wc': 'bathroom',
            'clg': 'ceiling', 'cl': 'ceiling',
            'wl': 'wall', 'wll': 'wall',
            'dr': 'door', 'dor': 'door',
            'el': 'electrical', 'elec': 'electrical',
            'mech': 'mechanical', 'mc': 'mechanical', 'hvac': 'mechanical',
            'pl': 'plumbing', 'plb': 'plumbing',
            'fr': 'furniture', 'frn': 'furniture',
            'ar': 'architectural', 'arch': 'architectural',
            'st': 'structure', 'str': 'structure',
            'mep': 'mep',
        }
        if code in code_map:
            return code_map[code]
    
    return 'general'

def is_valid_document(filename):
    """Filter out non-document files like fonts, system files, etc."""
    lower = filename.lower()
    ext = os.path.splitext(lower)[1]
    
    # Valid document extensions only
    valid_ext = {'.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'}
    if ext not in valid_ext:
        return False
    
    # Skip obvious non-documents
    skip_patterns = [
        'font', 'arial', 'calibri', 'times', 'helvetica',  # Fonts
        'template', 'blank', 'empty',  # Templates
        'backup', 'copy of', 'old_', '~$',  # Backups
        'desktop.ini', 'thumbs.db', '.ds_store',  # System files
    ]
    
    for pattern in skip_patterns:
        if pattern in lower:
            return False
    
    return True

def get_latest_by_type(project_name):
    """Get latest documents - grouped by TYPE and SUBJECT, sorted by REVISION"""
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = f"{project_name}/"
    
    # Collect all valid documents
    all_docs = []
    
    for blob in bucket.list_blobs(prefix=prefix):
        if blob.name.endswith('/') or '_extracted/' in blob.name:
            continue
        
        filename = os.path.basename(blob.name)
        
        # Skip invalid files (fonts, system files, etc.)
        if not is_valid_document(filename):
            continue
        
        rel_path = blob.name[len(prefix):]
        doc_type = detect_document_type(filename, rel_path)
        subject = extract_subject(filename, rel_path)
        rev_num, rev_str = extract_revision(filename)
        
        all_docs.append({
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
        })
    
    # Group by type+subject, keep highest revision
    groups = {}
    for doc in all_docs:
        # Key: type + subject (e.g., "shop_drawing_flooring")
        key = f"{doc['type']}_{doc['subject']}"
        
        if key not in groups:
            groups[key] = doc
        else:
            # Keep the one with higher revision
            if doc['revision'] > groups[key]['revision']:
                groups[key] = doc
            # If same revision, keep more recently updated
            elif doc['revision'] == groups[key]['revision']:
                if doc['updated'] > groups[key]['updated']:
                    groups[key] = doc
    
    # Convert to list and sort by priority (highest first)
    result = list(groups.values())
    result.sort(key=lambda x: (
        DOCUMENT_HIERARCHY.get(x['type'], {}).get('priority', 0),
        x['revision']
    ), reverse=True)
    
    # Return top 12 most important
    return result[:12]

# =============================================================================
# SEARCH - FIXED
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
        print(f"\u274C Vertex AI Search error: {e}")
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
            context_parts.append(f"""
Document {i+1}: {r['title']}
   Type: {doc_info.get('description', 'Document')} (Authority Level: {r['priority']})
   Location: {r['link']}
   Content: {' ... '.join(r['snippets'][:2])}
""")
        
        prompt = f"""You are a Senior Technical Office Engineer AI assistant at Sigma Contractors.
You help engineers quickly find accurate information from project documents.

PROJECT: {project_name or 'All Projects'}
QUESTION: {query}

DOCUMENT AUTHORITY (highest to lowest):
- CVI (Consultant Variation Instruction) - OVERRIDES ALL other documents
- VO (Variation Order) - Changes to contract
- Approved Shop Drawings - Latest revision is authoritative
- RFI Responses - Official clarifications
- MOMs - Recorded decisions
- Specifications & BOQ - Technical requirements
- Contract - Base reference

RETRIEVED DOCUMENTS:
{chr(10).join(context_parts)}

RESPOND IN {lang.upper()}. Follow this exact format:

**Answer:**
Give a direct, specific answer in 1-2 sentences. Include the exact value, dimension, material, or decision found.

**Key Details:**
- List specific facts: dimensions, quantities, dates, revision numbers
- If multiple documents discuss this, state which one takes precedence
- Include any conditions or exceptions

**Source:**
State the most authoritative document used (type + name + revision if available)

IMPORTANT RULES:
1. Be SPECIFIC - give exact values, not vague answers
2. If a CVI or VO exists on this topic, it OVERRIDES everything else
3. Always mention revision numbers when available
4. If documents conflict, explicitly state: "Per [higher authority doc], this supersedes [lower doc]"
5. If information is NOT found, say: "Not found in indexed documents. Check [suggested folder]."
6. Keep response concise - engineers need quick answers
"""

        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"\u274C Gemini error: {e}")
        return None

# =============================================================================
# FILE OPERATIONS
# =============================================================================

def list_folder_files(project_name, folder_path):
    bucket = storage_client.bucket(GCS_BUCKET)
    prefix = f"{project_name}/{folder_path}/" if folder_path else f"{project_name}/"
    print(f"Listing: {prefix}")
    
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
    print(f"Found {len([f for f in files if f['type'] == 'folder'])} folders, {len([f for f in files if f['type'] == 'file'])} files")
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
Format: ## Layout Changes, ## Added Elements, ## Removed Elements, ## Specification Changes, ## Notes & Annotations"""
        
        response = model.generate_content([prompt, {'mime_type': mime1, 'data': base64.standard_b64encode(content1).decode('utf-8')}, {'mime_type': mime2, 'data': base64.standard_b64encode(content2).decode('utf-8')}])
        return {'comparison': response.text, 'file1': file1_name, 'file2': file2_name}
    except Exception as e:
        print(f"Compare error: {e}")
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
        return (jsonify({'status': 'Sigma Sync Worker v5.2', 'capabilities': ['sync', 'search', 'list', 'files', 'view', 'compare', 'stats', 'latest', 'delete'], 'gemini': 'enabled' if GEMINI_API_KEY else 'disabled'}), 200, headers)
    
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
            return (jsonify({'latest': get_latest_by_type(project)}), 200, headers)
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
            print(f"Search: '{query}' in project: {project or 'ALL'}")
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
