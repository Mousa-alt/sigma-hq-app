# Email Classification Service
import re
import json
from datetime import datetime

# Absolute imports
from clients import get_bucket
from utils.gcs import detect_folder_structure


def classify_email(subject, body, sender, projects, gemini_model=None):
    """Classify email to project using rules + AI fallback"""
    text = f"{subject} {body} {sender}".lower()
    
    # Rule-based matching first
    for project in projects:
        code = project.get('code', '').lower()
        name = project.get('name', '').lower()
        
        # Match by project code (e.g., ECH-DT)
        if code and code in text:
            return {
                'project': project['name'],
                'confidence': 0.95,
                'method': 'code',
                'gcsFolderName': project.get('gcsFolderName')
            }
        
        # Match by project name
        if name and len(name) > 3 and name in text:
            return {
                'project': project['name'],
                'confidence': 0.85,
                'method': 'name',
                'gcsFolderName': project.get('gcsFolderName')
            }
    
    # AI fallback
    if gemini_model:
        try:
            project_list = ', '.join([p['name'] for p in projects])
            prompt = f"""Classify this email to one of these projects: {project_list}
Or return 'unclassified' if no match.

Subject: {subject}
From: {sender}
Body: {body[:500]}

Return JSON: {{"project": "name or unclassified", "confidence": 0.0-1.0}}"""
            
            response = gemini_model.generate_content(prompt)
            result = json.loads(response.text.strip().strip('```json').strip('```'))
            if result.get('project') != 'unclassified':
                # Find matching project
                for project in projects:
                    if project['name'].lower() == result['project'].lower():
                        return {
                            'project': result['project'],
                            'confidence': result.get('confidence', 0.7),
                            'method': 'ai',
                            'gcsFolderName': project.get('gcsFolderName')
                        }
        except:
            pass
    
    return {'project': None, 'confidence': 0, 'method': 'none', 'gcsFolderName': None}


def get_project_emails(project_name):
    """Get emails for a project from GCS"""
    bucket = get_bucket()
    
    # Check both OLD and NEW correspondence folders
    prefixes = [
        f"{project_name}/01.Correspondence/",  # NEW
        f"{project_name}/09-Correspondence/",  # OLD
    ]
    
    emails = []
    for prefix in prefixes:
        blobs = list(bucket.list_blobs(prefix=prefix))
        for blob in blobs:
            if blob.name.endswith('.json'):
                try:
                    data = json.loads(blob.download_as_text())
                    emails.append(data)
                except:
                    pass
    
    # Sort by date descending
    emails.sort(key=lambda x: x.get('date', ''), reverse=True)
    return emails


def detect_email_type(subject, body=''):
    """Detect email document type"""
    text = f"{subject} {body}".lower()
    
    if re.search(r'\brfi\b|request.?for.?information', text):
        return 'rfi'
    if re.search(r'approv', text):
        return 'approval'
    if re.search(r'shop.?draw', text):
        return 'shop_drawing'
    if re.search(r'submittal', text):
        return 'submittal'
    if re.search(r'\bvo\b|variation', text):
        return 'vo'
    if re.search(r'invoice', text):
        return 'invoice'
    if re.search(r'mom|minute|meeting', text):
        return 'mom'
    if re.search(r'report', text):
        return 'report'
    
    return 'correspondence'
