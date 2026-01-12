# Shared Clients for Email Backend
from google.cloud import storage
from google.cloud import firestore
import vertexai
from vertexai.generative_models import GenerativeModel

from config import FIREBASE_PROJECT, GCP_PROJECT, GCP_LOCATION

# Storage Client
storage_client = storage.Client()

# Firestore Client
db = firestore.Client(project=FIREBASE_PROJECT)

# Vertex AI / Gemini
try:
    vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    ai_model = GenerativeModel('gemini-2.0-flash-exp')
    VERTEX_AI_ENABLED = True
except Exception as e:
    print(f"Vertex AI init error: {e}")
    ai_model = None
    VERTEX_AI_ENABLED = False
