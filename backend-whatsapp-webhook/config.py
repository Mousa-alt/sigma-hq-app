# Configuration - All environment variables and constants

import os

# =============================================================================
# GOOGLE CLOUD
# =============================================================================
GCP_PROJECT = os.environ.get('GCP_PROJECT', 'sigma-hq-technical-office')
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'sigma-docs-repository')
GCP_LOCATION = os.environ.get('GCP_LOCATION', 'us-central1')

# =============================================================================
# FIREBASE
# =============================================================================
FIREBASE_PROJECT = os.environ.get('FIREBASE_PROJECT', 'sigma-hq-38843')
APP_ID = os.environ.get('APP_ID', 'sigma-hq-production')

# =============================================================================
# WAHA (WhatsApp)
# =============================================================================
WAHA_API_URL = os.environ.get('WAHA_API_URL', 'http://34.78.137.109:3000')
WAHA_API_KEY = os.environ.get('WAHA_API_KEY', 'sigma2026')
COMMAND_GROUP_ID = os.environ.get('COMMAND_GROUP_ID', '')

# Waha Plus License - Set to True when you buy premium
WAHA_PLUS_ENABLED = os.environ.get('WAHA_PLUS_ENABLED', 'false').lower() == 'true'

# =============================================================================
# VERTEX AI SEARCH
# =============================================================================
VERTEX_LOCATION = "global"
ENGINE_ID = "sigma-search_1767650825639"

# =============================================================================
# SHORT URLS
# =============================================================================
SHORT_URL_BASE = os.environ.get('SHORT_URL_BASE', '')

# =============================================================================
# FIRESTORE PATHS (helper function)
# =============================================================================
def get_data_path(db):
    """Get the base data path in Firestore"""
    return db.collection('artifacts').document(APP_ID).collection('public').document('data')
