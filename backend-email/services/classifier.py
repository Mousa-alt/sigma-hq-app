# Email Classification Service
import re
from google.cloud import firestore
import vertexai
from vertexai.generative_models import GenerativeModel

def get_projects_from_firestore(db, app_id):
    """Get all projects from Firestore"""
    projects_ref = db.collection('artifacts').document(app_id).collection('public').document('data').collection('projects')
    docs = projects_ref.stream()
    return [{'id': d.id, **d.to_dict()} for d in docs]

def classify_email_to_project(email_data, projects, aliases=None, ai_model=None):
    """Classify email to project using rules + AI fallback"""
    subject = email_data.get('subject', '').lower()
    body = email_data.get('body', '').lower()
    sender = email_data.get('sender', '').lower()
    text = f"{subject} {body} {sender}"
    
    # Rule-based matching
    for project in projects:
        code = (project.get('code') or '').lower()
        name = (project.get('name') or '').lower()
        
        # Match by project code (highest priority)
        if code and len(code) >= 3:
            if re.search(rf'\b{re.escape(code)}\b', text):
                return {'project': project['name'], 'confidence': 0.95, 'method': 'code', 'gcsFolderName': project.get('gcsFolderName')}
        
        # Match by project name
        if name and len(name) >= 4:
            if re.search(rf'\b{re.escape(name)}\b', text):
                return {'project': project['name'], 'confidence': 0.85, 'method': 'name', 'gcsFolderName': project.get('gcsFolderName')}
    
    # Check aliases
    if aliases:
        for project_key, alias_list in aliases.items():
            for alias in alias_list:
                if alias.lower() in text:
                    # Find matching project
                    for project in projects:
                        if project.get('name', '').lower().replace(' ', '-') == project_key:
                            return {'project': project['name'], 'confidence': 0.8, 'method': 'alias', 'gcsFolderName': project.get('gcsFolderName')}
    
    # AI fallback
    if ai_model:
        try:
            project_list = ', '.join([p['name'] for p in projects])
            prompt = f"""Classify this email to one of these projects: {project_list}
Return ONLY the project name or 'unclassified'.

Subject: {email_data.get('subject', '')}
From: {email_data.get('sender', '')}
Body: {email_data.get('body', '')[:500]}"""
            
            response = ai_model.generate_content(prompt)
            result = response.text.strip()
            
            if result != 'unclassified':
                for project in projects:
                    if project['name'].lower() == result.lower():
                        return {'project': project['name'], 'confidence': 0.7, 'method': 'ai', 'gcsFolderName': project.get('gcsFolderName')}
        except:
            pass
    
    return {'project': None, 'confidence': 0, 'method': 'none', 'gcsFolderName': None}
