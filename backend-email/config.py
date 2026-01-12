# Email Backend Configuration
import os

# IMAP Configuration
IMAP_SERVER = os.environ.get('IMAP_SERVER', 'mail.sigmadd-egypt.com')
IMAP_PORT = int(os.environ.get('IMAP_PORT', '993'))
EMAIL_USER = os.environ.get('EMAIL_USER', '')
EMAIL_PASS = os.environ.get('EMAIL_PASS', '')

# GCS Configuration
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'sigma-docs-repository')

# GCP Configuration
GCP_PROJECT = os.environ.get('GCP_PROJECT', 'sigma-hq-technical-office')
GCP_LOCATION = os.environ.get('GCP_LOCATION', 'europe-west1')

# Firebase Configuration
FIREBASE_PROJECT = os.environ.get('FIREBASE_PROJECT', 'sigma-hq-38843')
APP_ID = os.environ.get('APP_ID', 'sigma-hq-production')

# Project aliases for fuzzy matching
PROJECT_ALIASES = {
    'agora-gem': ['agura gem', 'agura-gem', 'agora gem', 'agoragim', 'agora_gem'],
    'hdv-gouna': ['hdv gouna', 'hdv_gouna', 'gouna hdv', 'el gouna'],
}
