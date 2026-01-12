# GCS Utilities for Email Backend
import json
import re
from datetime import datetime
from google.cloud import storage

storage_client = storage.Client()

def detect_folder_structure(bucket_name, folder_name):
    """Detect if project uses OLD or NEW folder structure"""
    bucket = storage_client.bucket(bucket_name)
    
    # Check NEW folders
    new_folders = ['01.Correspondence/', '04.Shop-Drawings/', '07.Submittals/']
    for folder in new_folders:
        prefix = f"{folder_name}/{folder}"
        blobs = list(bucket.list_blobs(prefix=prefix, max_results=1))
        if blobs:
            return 'new'
    
    # Check OLD folders
    old_folders = ['09-Correspondence/', '01.drawings/', '10.submittal/']
    for folder in old_folders:
        prefix = f"{folder_name}/{folder}"
        blobs = list(bucket.list_blobs(prefix=prefix, max_results=1))
        if blobs:
            return 'old'
    
    return 'new'  # Default for new projects

def save_email_to_gcs(bucket_name, folder_name, email_data, doc_type='correspondence'):
    """Save email to GCS in correct folder structure"""
    bucket = storage_client.bucket(bucket_name)
    structure = detect_folder_structure(bucket_name, folder_name)
    
    # Sanitize subject for filename
    subject = email_data.get('subject', 'no-subject')
    safe_subject = re.sub(r'[^\w\s-]', '', subject)[:50].strip().replace(' ', '_')
    date_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Determine path based on structure
    if structure == 'new':
        path = f"{folder_name}/01.Correspondence/Client/{doc_type.upper()}/{date_str}_{safe_subject}.json"
    else:
        path = f"{folder_name}/09-Correspondence/{doc_type.upper()}/{date_str}_{safe_subject}.json"
    
    blob = bucket.blob(path)
    blob.upload_from_string(json.dumps(email_data, ensure_ascii=False), content_type='application/json')
    
    return path
