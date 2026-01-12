# Drive Sync Service
import os, io, zipfile
from datetime import datetime
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.auth import default
from google.cloud import firestore

credentials, _ = default(scopes=['https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/cloud-platform'])
drive_service = build('drive', 'v3', credentials=credentials)

def get_drive_folder_id(folder_name, parent_id=None):
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id: query += f" and '{parent_id}' in parents"
    results = drive_service.files().list(q=query, fields='files(id, name)').execute()
    files = results.get('files', [])
    return files[0]['id'] if files else None

def list_drive_files(folder_id, recursive=True):
    all_files = []
    def process_folder(fid, path=''):
        query = f"'{fid}' in parents and trashed=false"
        page_token = None
        while True:
            results = drive_service.files().list(q=query, fields='nextPageToken, files(id, name, mimeType, size, modifiedTime)', pageToken=page_token, pageSize=1000).execute()
            for item in results.get('files', []):
                item_path = f"{path}/{item['name']}" if path else item['name']
                if item['mimeType'] == 'application/vnd.google-apps.folder':
                    if recursive: process_folder(item['id'], item_path)
                else:
                    all_files.append({'id': item['id'], 'name': item['name'], 'path': item_path, 'size': int(item.get('size', 0)), 'modified': item.get('modifiedTime')})
            page_token = results.get('nextPageToken')
            if not page_token: break
    process_folder(folder_id)
    return all_files

def download_drive_file(file_id):
    request = drive_service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done: _, done = downloader.next_chunk()
    buffer.seek(0)
    return buffer.read()

def sync_folder(project_name, drive_folder_id, bucket, config):
    from utils.document import detect_document_type, is_valid_document, is_email_folder
    existing_blobs = {b.name: b for b in bucket.list_blobs(prefix=f'{project_name}/')}
    drive_files = list_drive_files(drive_folder_id)
    synced, skipped, errors, deleted = [], [], [], []
    drive_paths = set()
    
    for file in drive_files:
        ext = os.path.splitext(file['name'].lower())[1]
        gcs_path = f"{project_name}/{file['path']}"
        drive_paths.add(gcs_path)
        if ext in config['SKIP_EXTENSIONS']:
            skipped.append({'name': file['name'], 'reason': 'Unsupported'})
            continue
        if ext not in config['SUPPORTED_EXTENSIONS'] and ext not in config['ARCHIVE_EXTENSIONS']:
            skipped.append({'name': file['name'], 'reason': 'Unknown'})
            continue
        if file['size'] > config['MAX_FILE_SIZE_MB'] * 1024 * 1024:
            skipped.append({'name': file['name'], 'reason': 'Too large'})
            continue
        if gcs_path in existing_blobs:
            blob = existing_blobs[gcs_path]
            if blob.updated and file['modified']:
                drive_time = datetime.fromisoformat(file['modified'].replace('Z', '+00:00'))
                if blob.updated >= drive_time:
                    skipped.append({'name': file['name'], 'reason': 'Synced'})
                    continue
        try:
            content = download_drive_file(file['id'])
            if ext in config['ARCHIVE_EXTENSIONS']:
                try:
                    with zipfile.ZipFile(io.BytesIO(content)) as zf:
                        for zi in zf.filelist:
                            if zi.is_dir(): continue
                            ze = os.path.splitext(zi.filename.lower())[1]
                            if ze in config['SUPPORTED_EXTENSIONS']:
                                ep = f"{project_name}/{file['path'].rsplit('.', 1)[0]}/{zi.filename}"
                                bucket.blob(ep).upload_from_string(zf.read(zi.filename))
                                synced.append({'name': zi.filename, 'path': ep})
                except zipfile.BadZipFile:
                    errors.append({'name': file['name'], 'error': 'Bad ZIP'})
            else:
                bucket.blob(gcs_path).upload_from_string(content)
                synced.append({'name': file['name'], 'path': gcs_path})
        except Exception as e:
            errors.append({'name': file['name'], 'error': str(e)})
    
    for gcs_path, blob in existing_blobs.items():
        if gcs_path not in drive_paths and not is_email_folder(gcs_path):
            try: blob.delete(); deleted.append(gcs_path)
            except: pass
    
    return {'synced': len(synced), 'skipped': len(skipped), 'errors': len(errors), 'deleted': len(deleted)}

def get_project_stats(project_name, bucket):
    from utils.document import detect_document_type
    blobs = list(bucket.list_blobs(prefix=f'{project_name}/'))
    total_size, file_count, by_type = 0, 0, {}
    for blob in blobs:
        if blob.name.endswith('/'): continue
        file_count += 1
        total_size += blob.size or 0
        doc_type = detect_document_type(blob.name, blob.name)
        by_type[doc_type] = by_type.get(doc_type, 0) + 1
    return {'fileCount': file_count, 'totalSize': total_size, 'byType': by_type}
