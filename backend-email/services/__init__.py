# Email Backend Services Package
from services.classifier import classify_email_to_project, get_projects_from_firestore

__all__ = [
    'classify_email_to_project',
    'get_projects_from_firestore'
]
