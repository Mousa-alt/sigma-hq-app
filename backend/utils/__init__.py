# Utils package
from utils.document import (
    detect_document_type,
    detect_email_type,
    get_document_priority,
    extract_revision,
    extract_subject,
    is_valid_document,
    is_approved_folder,
    is_email_folder,
    DOCUMENT_HIERARCHY
)

from utils.gcs import (
    list_blobs,
    upload_blob,
    download_blob,
    delete_blob,
    blob_exists,
    get_blob_metadata,
    list_folders,
    get_folder_stats,
    detect_folder_structure
)

__all__ = [
    'detect_document_type',
    'detect_email_type',
    'get_document_priority',
    'extract_revision',
    'extract_subject',
    'is_valid_document',
    'is_approved_folder',
    'is_email_folder',
    'DOCUMENT_HIERARCHY',
    'list_blobs',
    'upload_blob',
    'download_blob',
    'delete_blob',
    'blob_exists',
    'get_blob_metadata',
    'list_folders',
    'get_folder_stats',
    'detect_folder_structure'
]
