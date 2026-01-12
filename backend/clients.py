# Shared Clients - Initialized once, reused across requests
from google.auth import default
from google.cloud import storage
from google.cloud import firestore
from googleapiclient.discovery import build
import google.generativeai as genai
import os

from config import FIREBASE_PROJECT, GEMINI_API_KEY, GCS_BUCKET

# Google Auth credentials
credentials, _ = default(scopes=[
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/cloud-platform'
])

# Drive Service
drive_service = build('drive', 'v3', credentials=credentials)

# Storage Client
storage_client = storage.Client(credentials=credentials)

# GCS Bucket
def get_bucket():
    return storage_client.bucket(GCS_BUCKET)

# Firestore Client
try:
    firestore_client = firestore.Client(project=FIREBASE_PROJECT)
    FIRESTORE_ENABLED = True
except Exception as e:
    print(f"Firestore init error: {e}")
    firestore_client = None
    FIRESTORE_ENABLED = False

# Gemini Client
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    GEMINI_ENABLED = True
else:
    GEMINI_ENABLED = False
