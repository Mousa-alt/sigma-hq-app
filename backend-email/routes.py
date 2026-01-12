# Email Backend HTTP Routes
from flask import jsonify, request, Response
from config import GCS_BUCKET, FIREBASE_PROJECT, APP_ID, IMAP_SERVER, IMAP_PORT, EMAIL_USER, EMAIL_PASS, PROJECT_ALIASES
from utils.imap import connect_imap, fetch_emails
from utils.gcs import save_email_to_gcs, detect_folder_structure
from services.classifier import classify_email_to_project, get_projects_from_firestore
from google.cloud import firestore
import vertexai
from vertexai.generative_models import GenerativeModel

db = firestore.Client(project=FIREBASE_PROJECT)

try:
    vertexai.init(project='sigma-hq-technical-office', location='europe-west1')
    ai_model = GenerativeModel('gemini-2.0-flash-exp')
    VERTEX_AI_ENABLED = True
except:
    ai_model = None
    VERTEX_AI_ENABLED = False

def register_routes(app):
    """Register all HTTP routes"""
    
    @app.route('/', methods=['GET'])
    def health():
        return jsonify({'status': 'ok', 'service': 'sigma-email-sync', 'version': '4.0-modular', 'ai_enabled': VERTEX_AI_ENABLED})
    
    @app.route('/fetch', methods=['POST', 'OPTIONS'])
    def fetch():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        data = request.get_json() or {}
        limit = data.get('limit', 50)
        folder = data.get('folder', 'INBOX')
        
        if not EMAIL_USER or not EMAIL_PASS:
            return _json_response({'error': 'Email credentials not configured'}, 500)
        
        try:
            mail = connect_imap(IMAP_SERVER, IMAP_PORT, EMAIL_USER, EMAIL_PASS)
            emails = fetch_emails(mail, folder, limit)
            mail.logout()
            return _json_response({'emails': emails, 'count': len(emails)})
        except Exception as e:
            return _json_response({'error': str(e)}, 500)
    
    @app.route('/classify', methods=['POST', 'OPTIONS'])
    def classify():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        data = request.get_json() or {}
        email_data = data.get('email', {})
        
        if not email_data:
            return _json_response({'error': 'Email data required'}, 400)
        
        projects = get_projects_from_firestore(db, APP_ID)
        result = classify_email_to_project(email_data, projects, PROJECT_ALIASES, ai_model if VERTEX_AI_ENABLED else None)
        
        return _json_response(result)
    
    @app.route('/process', methods=['POST', 'OPTIONS'])
    def process():
        """Fetch, classify, and save emails"""
        if request.method == 'OPTIONS':
            return _cors_response()
        
        data = request.get_json() or {}
        limit = data.get('limit', 20)
        save = data.get('save', True)
        
        if not EMAIL_USER or not EMAIL_PASS:
            return _json_response({'error': 'Email credentials not configured'}, 500)
        
        try:
            # Fetch emails
            mail = connect_imap(IMAP_SERVER, IMAP_PORT, EMAIL_USER, EMAIL_PASS)
            emails = fetch_emails(mail, 'INBOX', limit)
            mail.logout()
            
            # Get projects
            projects = get_projects_from_firestore(db, APP_ID)
            
            results = []
            classified_count = 0
            saved_count = 0
            
            for email_data in emails:
                # Classify
                classification = classify_email_to_project(email_data, projects, PROJECT_ALIASES, ai_model if VERTEX_AI_ENABLED else None)
                
                result = {
                    'subject': email_data.get('subject'),
                    'sender': email_data.get('sender'),
                    'date': email_data.get('date'),
                    'classification': classification
                }
                
                if classification['project']:
                    classified_count += 1
                    
                    # Save to GCS
                    if save and classification.get('gcsFolderName'):
                        try:
                            path = save_email_to_gcs(GCS_BUCKET, classification['gcsFolderName'], email_data)
                            result['saved_path'] = path
                            saved_count += 1
                        except Exception as e:
                            result['save_error'] = str(e)
                
                results.append(result)
            
            return _json_response({
                'processed': len(emails),
                'classified': classified_count,
                'saved': saved_count,
                'results': results
            })
            
        except Exception as e:
            return _json_response({'error': str(e)}, 500)
    
    @app.route('/projects', methods=['GET', 'OPTIONS'])
    def list_projects():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        projects = get_projects_from_firestore(db, APP_ID)
        return _json_response({'projects': [{'id': p['id'], 'name': p.get('name'), 'code': p.get('code')} for p in projects]})


def _cors_response():
    response = Response()
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

def _json_response(data, status=200):
    response = jsonify(data)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.status_code = status
    return response
