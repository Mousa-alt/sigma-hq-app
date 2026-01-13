# HTTP Routes
from flask import jsonify, request, Response
from datetime import datetime

# Absolute imports from root
from config import GCS_BUCKET, APP_ID
from clients import get_bucket, firestore_client, FIRESTORE_ENABLED
from services.sync import sync_folder, get_project_stats, get_drive_folder_id
from services.search import search_documents, search_with_ai
from services.email import get_project_emails
from utils.document import detect_document_type, get_document_priority, is_approved_folder
from utils.gcs import list_blobs, list_folders

# Version - UPDATE THIS ON EVERY CHANGE
SERVICE_VERSION = '7.4-status-api'


def register_routes(app):
    """Register all HTTP routes"""
    
    @app.route('/', methods=['GET'])
    def health():
        return jsonify({
            'status': 'ok',
            'service': 'sigma-sync-worker',
            'version': SERVICE_VERSION,
            'firestore': FIRESTORE_ENABLED
        })
    
    @app.route('/status', methods=['GET'])
    def status():
        """Standardized status endpoint for AI agents and monitoring"""
        health_checks = {}
        
        # Check Firestore
        try:
            if FIRESTORE_ENABLED and firestore_client:
                # Light check - just verify connection
                firestore_client.collection('artifacts').document(APP_ID).get()
                health_checks['firestore'] = 'connected'
            else:
                health_checks['firestore'] = 'disabled'
        except Exception as e:
            health_checks['firestore'] = f'error: {str(e)[:50]}'
        
        # Check GCS
        try:
            bucket = get_bucket()
            if bucket:
                # Light check - just verify bucket exists
                bucket.exists()
                health_checks['gcs'] = 'connected'
            else:
                health_checks['gcs'] = 'not configured'
        except Exception as e:
            health_checks['gcs'] = f'error: {str(e)[:50]}'
        
        # Determine overall status
        all_healthy = all(v in ['connected', 'disabled'] for v in health_checks.values())
        
        return jsonify({
            'service': 'sigma-sync-worker',
            'version': SERVICE_VERSION,
            'status': 'healthy' if all_healthy else 'degraded',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'environment': 'production',
            'capabilities': ['sync', 'files', 'search', 'ai-search', 'emails'],
            'health_checks': health_checks
        })
    
    @app.route('/sync', methods=['POST', 'OPTIONS'])
    def sync():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        data = request.get_json() or {}
        project_name = data.get('project') or data.get('projectName')
        folder_id = data.get('folderId')
        
        if not project_name:
            return _json_response({'error': 'Project name required'}, 400)
        
        if not folder_id:
            folder_id = get_drive_folder_id(project_name)
            if not folder_id:
                return _json_response({'error': f'Folder not found: {project_name}'}, 404)
        
        result = sync_folder(project_name, folder_id)
        return _json_response(result)
    
    @app.route('/stats', methods=['GET', 'POST', 'OPTIONS'])
    def stats():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        # Support both GET query params and POST JSON body
        if request.method == 'POST':
            data = request.get_json() or {}
            project = data.get('project') or data.get('projectName')
        else:
            project = request.args.get('project')
        
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        result = get_project_stats(project)
        return _json_response(result)
    
    @app.route('/folders', methods=['GET', 'POST', 'OPTIONS'])
    def folders():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        # Support both GET query params and POST JSON body
        if request.method == 'POST':
            data = request.get_json() or {}
            project = data.get('project') or data.get('projectName')
            path = data.get('path') or data.get('folderPath', '')
        else:
            project = request.args.get('project')
            path = request.args.get('path', '')
        
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        prefix = f"{project}/{path}" if path else f"{project}/"
        result = list_folders(prefix)
        return _json_response({'folders': result})
    
    @app.route('/files', methods=['GET', 'POST', 'OPTIONS'])
    def files():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        # Support both GET query params and POST JSON body
        if request.method == 'POST':
            data = request.get_json() or {}
            project = data.get('project') or data.get('projectName')
            path = data.get('path') or data.get('folderPath', '')
        else:
            project = request.args.get('project')
            path = request.args.get('path', '')
        
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        prefix = f"{project}/{path}" if path else f"{project}/"
        blobs = list_blobs(prefix)
        
        # Separate folders and files
        folders = []
        files = []
        seen_folders = set()
        
        for blob in blobs:
            # Get the relative path after the prefix
            rel_path = blob.name[len(prefix):] if blob.name.startswith(prefix) else blob.name
            
            # Check if this is a subfolder
            if '/' in rel_path:
                folder_name = rel_path.split('/')[0]
                if folder_name and folder_name not in seen_folders:
                    seen_folders.add(folder_name)
                    folders.append({
                        'name': folder_name,
                        'path': f"{prefix}{folder_name}/",
                        'type': 'folder'
                    })
            elif rel_path and not blob.name.endswith('/'):
                # It's a file in the current directory
                name = rel_path
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
        
        # Sort folders alphabetically, files by priority then name
        folders.sort(key=lambda x: x['name'].lower())
        files.sort(key=lambda x: (-x.get('priority', 0), x['name'].lower()))
        
        # Return combined list with folders first
        return _json_response({'files': folders + files})
    
    @app.route('/search', methods=['GET', 'POST', 'OPTIONS'])
    def search():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        if request.method == 'POST':
            data = request.get_json() or {}
            query = data.get('query', '')
            project = data.get('project') or data.get('projectName')
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
    
    @app.route('/emails', methods=['GET', 'POST', 'OPTIONS'])
    def emails():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        # Support both GET query params and POST JSON body
        if request.method == 'POST':
            data = request.get_json() or {}
            project = data.get('project') or data.get('projectName')
        else:
            project = request.args.get('project')
        
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        result = get_project_emails(project)
        return _json_response({'emails': result})
    
    @app.route('/latest', methods=['GET', 'POST', 'OPTIONS'])
    def latest():
        if request.method == 'OPTIONS':
            return _cors_response()
        
        # Support both GET query params and POST JSON body
        if request.method == 'POST':
            data = request.get_json() or {}
            project = data.get('project') or data.get('projectName')
            doc_type = data.get('type')
            limit = int(data.get('limit', 10))
        else:
            project = request.args.get('project')
            doc_type = request.args.get('type')
            limit = int(request.args.get('limit', 10))
        
        if not project:
            return _json_response({'error': 'Project required'}, 400)
        
        blobs = list_blobs(f"{project}/")
        
        approved = []
        recent = []
        
        for blob in blobs:
            if blob.name.endswith('/'):
                continue
            name = blob.name.split('/')[-1]
            detected_type = detect_document_type(name, blob.name)
            
            if doc_type and detected_type != doc_type:
                continue
            
            priority, _ = get_document_priority(name, blob.name)
            
            # Extract subject and revision from filename
            subject = 'general'
            revision_str = ''
            name_lower = name.lower()
            
            # Try to detect subject
            subjects = ['flooring', 'kitchen', 'bathroom', 'ceiling', 'wall', 'door', 
                       'window', 'electrical', 'mechanical', 'plumbing', 'fire', 
                       'furniture', 'signage', 'landscape', 'structure', 'architectural',
                       'mep', 'interior', 'lighting']
            for s in subjects:
                if s in name_lower:
                    subject = s
                    break
            
            # Try to extract revision
            import re
            rev_match = re.search(r'[_\-\s]?[Rr](?:ev)?\.?\s*(\d+)', name)
            if rev_match:
                revision_str = f"R{rev_match.group(1)}"
            
            file_data = {
                'name': name,
                'path': blob.name.replace(f"{project}/", ''),
                'size': blob.size,
                'type': detected_type,
                'subject': subject,
                'revisionStr': revision_str,
                'priority': priority,
                'approved': is_approved_folder(blob.name),
                'updated': blob.updated.isoformat() if blob.updated else None
            }
            
            if is_approved_folder(blob.name):
                approved.append(file_data)
            else:
                recent.append(file_data)
        
        # Sort by date descending
        approved.sort(key=lambda x: x.get('updated') or '', reverse=True)
        recent.sort(key=lambda x: x.get('updated') or '', reverse=True)
        
        return _json_response({
            'approved': approved[:limit],
            'recent': recent[:limit]
        })
    
    @app.route('/unclassified', methods=['GET', 'OPTIONS'])
    def unclassified():
        """Get unclassified emails from GCS"""
        if request.method == 'OPTIONS':
            return _cors_response()
        
        try:
            blobs = list_blobs("_unclassified/")
            emails = []
            
            for blob in blobs:
                if blob.name.endswith('/'):
                    continue
                name = blob.name.split('/')[-1]
                
                # Parse email metadata from filename or content
                emails.append({
                    'id': blob.name.replace('/', '_'),
                    'name': name,
                    'path': blob.name,
                    'subject': name.replace('.eml', '').replace('_', ' ')[:50],
                    'from': 'Unknown',
                    'date': blob.updated.isoformat() if blob.updated else None,
                    'type': 'correspondence',
                    'typeLabel': 'General',
                    'hasAttachments': False
                })
            
            emails.sort(key=lambda x: x.get('date') or '', reverse=True)
            return _json_response({'emails': emails})
        except Exception as e:
            print(f"Error getting unclassified: {e}")
            return _json_response({'emails': [], 'error': str(e)})
    
    @app.route('/classify', methods=['POST', 'OPTIONS'])
    def classify():
        """Classify/move an email to a project folder"""
        if request.method == 'OPTIONS':
            return _cors_response()
        
        data = request.get_json() or {}
        path = data.get('path')
        project = data.get('project')
        doc_type = data.get('type', 'correspondence')
        
        if not path or not project:
            return _json_response({'error': 'Path and project required'}, 400)
        
        try:
            bucket = get_bucket()
            source_blob = bucket.blob(path)
            
            if not source_blob.exists():
                return _json_response({'error': 'File not found'}, 404)
            
            # Determine destination path
            filename = path.split('/')[-1]
            dest_path = f"{project}/09-Correspondence/{filename}"
            
            # Copy to new location
            dest_blob = bucket.blob(dest_path)
            dest_blob.rewrite(source_blob)
            
            # Delete original
            source_blob.delete()
            
            return _json_response({'success': True, 'newPath': dest_path})
        except Exception as e:
            print(f"Error classifying: {e}")
            return _json_response({'error': str(e)}, 500)
    
    # ============ ADMIN ENDPOINTS ============
    
    @app.route('/admin/fix-gcs-mapping', methods=['POST', 'OPTIONS'])
    def fix_gcs_mapping():
        """Fix gcsFolderName mapping for all projects"""
        if request.method == 'OPTIONS':
            return _cors_response()
        
        if not FIRESTORE_ENABLED:
            return _json_response({'error': 'Firestore not available'}, 500)
        
        # Mapping: Dashboard project name -> GCS folder name
        mapping = {
            'Agora': 'Agora-GEM',
            'Amin Fattouh': 'AFV-LV',
            'Ecolab': 'Ecolab',
            'Springfield': 'Springfield',
            'Eichholtz': 'Eichholtz',
            'Bahra': 'Bahra'
        }
        
        try:
            # Get all projects from Firestore
            projects_ref = firestore_client.collection('artifacts').document(APP_ID).collection('public').document('data').collection('projects')
            docs = projects_ref.stream()
            
            updated = []
            for doc in docs:
                data = doc.to_dict()
                project_name = data.get('name', '')
                
                # Check if we have a mapping for this project
                if project_name in mapping:
                    gcs_folder = mapping[project_name]
                    current_gcs = data.get('gcsFolderName', '')
                    
                    # Update if different
                    if current_gcs != gcs_folder:
                        doc.reference.update({'gcsFolderName': gcs_folder})
                        updated.append({
                            'id': doc.id,
                            'name': project_name,
                            'old': current_gcs,
                            'new': gcs_folder
                        })
            
            return _json_response({
                'success': True,
                'updated': len(updated),
                'projects': updated
            })
        except Exception as e:
            print(f"Error fixing GCS mapping: {e}")
            return _json_response({'error': str(e)}, 500)
    
    @app.route('/admin/list-gcs-folders', methods=['GET', 'OPTIONS'])
    def list_gcs_folders():
        """List all root folders in GCS bucket"""
        if request.method == 'OPTIONS':
            return _cors_response()
        
        try:
            bucket = get_bucket()
            blobs = bucket.list_blobs(delimiter='/')
            
            # Get prefixes (folders)
            folders = []
            # Need to iterate to trigger the prefixes
            list(blobs)
            for prefix in blobs.prefixes:
                folder_name = prefix.rstrip('/')
                folders.append(folder_name)
            
            return _json_response({'folders': sorted(folders)})
        except Exception as e:
            print(f"Error listing GCS folders: {e}")
            return _json_response({'error': str(e)}, 500)
    
    @app.route('/admin/list-projects', methods=['GET', 'OPTIONS'])
    def list_projects():
        """List all projects from Firestore with their gcsFolderName"""
        if request.method == 'OPTIONS':
            return _cors_response()
        
        if not FIRESTORE_ENABLED:
            return _json_response({'error': 'Firestore not available'}, 500)
        
        try:
            projects_ref = firestore_client.collection('artifacts').document(APP_ID).collection('public').document('data').collection('projects')
            docs = projects_ref.stream()
            
            projects = []
            for doc in docs:
                data = doc.to_dict()
                projects.append({
                    'id': doc.id,
                    'name': data.get('name', ''),
                    'gcsFolderName': data.get('gcsFolderName', ''),
                    'status': data.get('status', '')
                })
            
            return _json_response({'projects': projects})
        except Exception as e:
            print(f"Error listing projects: {e}")
            return _json_response({'error': str(e)}, 500)


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
