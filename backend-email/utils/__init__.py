# Email Backend Utils Package
from utils.imap import connect_imap, fetch_emails, decode_mime_header
from utils.gcs import save_email_to_gcs, detect_folder_structure

__all__ = [
    'connect_imap',
    'fetch_emails',
    'decode_mime_header',
    'save_email_to_gcs',
    'detect_folder_structure'
]
