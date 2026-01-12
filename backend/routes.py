# HTTP Routes
from flask import jsonify, request, Response
from services.sync import sync_folder, get_project_stats, get_drive_folder_id
from services.search import search_documents, search_with_ai
from services.email import classify_email, get_project_emails
from utils.document import detect_document_type, get_document_priority, is_approved_folder, DOCUMENT_HIERARCHY
from utils.gcs import get_bucket, list_blobs, list_folders, get_folder_stats, detect_folder_structure
from config import GCS_BUCKET, SUPPORTED_EXTENSIONS, ARCHIVE_EXTENSIONS, SKIP_EXTENSIONS, MAX_FILE_SIZE_MB
import json

def register_routes(app):
    """Register all HTTP routes"""
    
    @app.route('/', methods=['GET'])
    def health():
        return jsonify({'status': 'ok', 'service': 'sigma-sync-worker', 'version': '7.0-modular'})
    
    @app.route('/sync', methods=['POST', 'OPTIONS'])
    def sync():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        data = request.get_json() or {}
        project_name = data.get('project')
        folder_id = data.get('folderId')
        
        if not project_name:
            return _json_response({'error': 'Project name required'}, 400)
        
        if not folder_id:
            folder_id = get_drive_folder_id(project_name)
            if not folder_id:
                return _json_response({'error': f'Folder not found: {project_name}'}, 404)
        
        bucket = get_bucket()
        config = {
            'SUPPORTED_EXTENSIONS': SUPPORTED_EXTENSIONS,
            'ARCHIVE_EXTENSIONS': ARCHIVE_EXTENSIONS,
            'SKIP_EXTENSIONS': SKIP_EXTENSIONS,
            'MAX_FILE_SIZE_MB': MAX_FILE_SIZE_MB
        }
        
        result = sync_folder(project_name, folder_id, bucket, config)
        return _json_response(result)
    
    @app.route('/stats', methods=['GET', 'OPTIONS'])
    def stats():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        project = request.args.get('project')
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        bucket = get_bucket()
        result = get_project_stats(project, bucket)
        return _json_response(result)
    
    @app.route('/folders', methods=['GET', 'OPTIONS'])
    def folders():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        project = request.args.get('project')
        path = request.args.get('path', '')
        
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        prefix = f"{project}/{path}" if path else f"{project}/"
        result = list_folders(prefix)
        return _json_response({'folders': result})
    
    @app.route('/files', methods=['GET', 'OPTIONS'])
    def files():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        project = request.args.get('project')
        path = request.args.get('path', '')
        
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        prefix = f"{project}/{path}" if path else f"{project}/"
        blobs = list_blobs(prefix)
        
        files = []
        for blob in blobs:
            if blob.name.endswith('/'): continue
            name = blob.name.split('/')[-1]
            doc_type = detect_document_type(name, blob.name)
            priority, _ = get_document_priority(name, blob.name)
            files.append({
                'name': name,
                'path': blob.name,
                'size': blob.size,
                'type': doc_type,
                'priority': priority,
                'approved': is_approved_folder(blob.name),
                'updated': blob.updated.isoformat() if blob.updated else None
            })
        
        files.sort(key=lambda x: (-x['priority'], x['name']))
        return _json_response({'files': files})
    
    @app.route('/search', methods=['GET', 'POST', 'OPTIONS'])
    def search():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        if request.method == 'POST':
            data = request.get_json() or {}
            query = data.get('query', '')
            project = data.get('project')
            doc_type = data.get('type')
        else:
            query = request.args.get('q', '')
            project = request.args.get('project')
            doc_type = request.args.get('type')
        
        if not query:
            return _json_response({'error': 'Query required'}, 400)
        
        results = search_documents(query, project, doc_type)
        return _json_response({'results': results})
    
    @app.route('/ai-search', methods=['POST', 'OPTIONS'])
    def ai_search():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        data = request.get_json() or {}
        query = data.get('query', '')
        
        if not query:
            return _json_response({'error': 'Query required'}, 400)
        
        # First get relevant docs
        docs = search_documents(query, page_size=5)
        result = search_with_ai(query, docs)
        return _json_response(result)
    
    @app.route('/emails', methods=['GET', 'OPTIONS'])
    def emails():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        project = request.args.get('project')
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        bucket = get_bucket()
        result = get_project_emails(project, bucket)
        return _json_response({'emails': result})
    
    @app.route('/latest', methods=['GET', 'OPTIONS'])
    def latest():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        project = request.args.get('project')
        doc_type = request.args.get('type')
        limit = int(request.args.get('limit', 10))
        
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        blobs = list_blobs(f"{project}/")
        files = []
        
        for blob in blobs:
            if blob.name.endswith('/'): continue
            name = blob.name.split('/')[-1]
            detected_type = detect_document_type(name, blob.name)
            
            if doc_type and detected_type != doc_type:
                continue
            
            priority, _ = get_document_priority(name, blob.name)
            files.append({
                'name': name,
                'path': blob.name,
                'size': blob.size,
                'type': detected_type,
                'priority': priority,
                'approved': is_approved_folder(blob.name),
                'updated': blob.updated.isoformat() if blob.updated else None
            })
        
        # Sort by priority then date
        files.sort(key=lambda x: (-x['priority'], x.get('updated', '') or ''), reverse=False)
        files.sort(key=lambda x: x.get('updated', '') or '', reverse=True)
        
        return _json_response({'files': files[:limit]})


def _cors_response():
    """Return CORS preflight response"""
    response = Response()
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


def _json_response(data, status=200):
    """Return JSON response with CORS headers"""
    response = jsonify(data)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.status_code = status
    return response
