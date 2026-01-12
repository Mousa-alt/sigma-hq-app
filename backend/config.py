# Backend Configuration
import os

# GCS Configuration
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'sigma-docs-repository')
MAX_FILE_SIZE_MB = int(os.environ.get('MAX_FILE_SIZE_MB', '100'))

# File Extensions
SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.html', '.htm', '.csv'}
ARCHIVE_EXTENSIONS = {'.zip'}
SKIP_EXTENSIONS = {'.dwg', '.dxf', '.dwl', '.dwl2', '.bak', '.tmp', '.rtf'}

# Vertex AI Configuration
PROJECT_ID = "sigma-hq-technical-office"
LOCATION = "global"
ENGINE_ID = "sigma-search_1767650825639"

# Gemini Configuration
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

# Firestore Configuration
FIREBASE_PROJECT = os.environ.get('FIREBASE_PROJECT', 'sigma-hq-38843')
APP_ID = os.environ.get('APP_ID', 'sigma-hq-production')
