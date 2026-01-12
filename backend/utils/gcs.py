# GCS Operations
from clients import get_bucket, storage_client
from config import GCS_BUCKET


def list_blobs(prefix, max_results=None):
    """List blobs with prefix"""
    bucket = get_bucket()
    if max_results:
        return list(bucket.list_blobs(prefix=prefix, max_results=max_results))
    return list(bucket.list_blobs(prefix=prefix))


def upload_blob(blob_name, data, content_type='application/octet-stream'):
    """Upload data to GCS"""
    bucket = get_bucket()
    blob = bucket.blob(blob_name)
    blob.upload_from_string(data, content_type=content_type)
    return blob.public_url


def download_blob(blob_name):
    """Download blob content"""
    bucket = get_bucket()
    blob = bucket.blob(blob_name)
    return blob.download_as_bytes()


def delete_blob(blob_name):
    """Delete a blob"""
    bucket = get_bucket()
    blob = bucket.blob(blob_name)
    blob.delete()


def blob_exists(blob_name):
    """Check if blob exists"""
    bucket = get_bucket()
    blob = bucket.blob(blob_name)
    return blob.exists()


def get_blob_metadata(blob_name):
    """Get blob metadata"""
    bucket = get_bucket()
    blob = bucket.blob(blob_name)
    blob.reload()
    return {
        'name': blob.name,
        'size': blob.size,
        'updated': blob.updated.isoformat() if blob.updated else None,
        'content_type': blob.content_type
    }


def list_folders(prefix):
    """List folders (prefixes) under a path"""
    bucket = get_bucket()
    iterator = bucket.list_blobs(prefix=prefix, delimiter='/')
    
    # Consume iterator to get prefixes
    list(iterator)
    
    folders = []
    if iterator.prefixes:
        for p in iterator.prefixes:
            folder_name = p.rstrip('/').split('/')[-1]
            folders.append({
                'name': folder_name,
                'path': p
            })
    return folders


def get_folder_stats(prefix):
    """Get folder statistics"""
    blobs = list_blobs(prefix)
    total_size = sum(b.size or 0 for b in blobs)
    file_count = len([b for b in blobs if not b.name.endswith('/')])
    return {
        'fileCount': file_count,
        'totalSize': total_size
    }


def detect_folder_structure(folder_name):
    """Detect if project uses OLD or NEW folder structure"""
    bucket = get_bucket()
    
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
