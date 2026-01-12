# Services package
from services.sync import sync_folder, get_project_stats, get_drive_folder_id
from services.search import search_documents, search_with_ai
from services.email import classify_email, get_project_emails

__all__ = [
    'sync_folder',
    'get_project_stats',
    'get_drive_folder_id',
    'search_documents',
    'search_with_ai',
    'classify_email',
    'get_project_emails'
]
