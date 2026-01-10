#!/usr/bin/env python3
"""
WhatsApp Group Sync Script for Sigma HQ
Fetches group names from Waha API and updates Firestore

Run this from any machine that can access both:
- Waha API (http://31.220.107.186:3002)
- Firebase/Firestore

Usage:
  python sync-whatsapp-groups.py

Requirements:
  pip install requests firebase-admin
"""

import requests
import json
from datetime import datetime

# Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials, firestore

# Configuration
WAHA_API_URL = "http://31.220.107.186:3002"
FIREBASE_PROJECT = "sigma-hq-38843"
APP_ID = "sigma-hq-production"

# Project keyword mapping for auto-classification
PROJECT_KEYWORDS = {
    "agora": {"project": "Agora-GEM", "type": "client", "confidence": 0.9},
    "gem": {"project": "Agora-GEM", "type": "client", "confidence": 0.8},
    "ecolab": {"project": "Ecolab", "type": "client", "confidence": 0.9},
    "hdv": {"project": "HDV-Gouna", "type": "client", "confidence": 0.9},
    "gouna": {"project": "HDV-Gouna", "type": "client", "confidence": 0.8},
    "command": {"project": "__general__", "type": "command", "confidence": 0.95},
    "sigma": {"project": "__general__", "type": "internal", "confidence": 0.7},
    "technical": {"project": "__general__", "type": "internal", "confidence": 0.6},
    "hq": {"project": "__general__", "type": "internal", "confidence": 0.6},
}

# Type detection keywords
TYPE_KEYWORDS = {
    "consultant": "consultant",
    "client": "client",
    "contractor": "client",
    "internal": "internal",
    "team": "internal",
    "command": "command",
}


def init_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        # Try to use default credentials (works on GCP or with GOOGLE_APPLICATION_CREDENTIALS)
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        return firestore.client()
    except Exception as e:
        print(f"Firebase init error: {e}")
        print("\nTo fix this, either:")
        print("1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable")
        print("2. Run on a GCP environment with default credentials")
        print("3. Download a service account key from Firebase Console")
        return None


def get_waha_groups():
    """Fetch all groups from Waha API"""
    try:
        # Get all chats
        url = f"{WAHA_API_URL}/api/default/chats"
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            print(f"Waha API error: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return []
        
        chats = response.json()
        
        # Filter only groups (@g.us)
        groups = []
        for chat in chats:
            chat_id = chat.get('id', '')
            if '@g.us' in chat_id:
                groups.append({
                    'id': chat_id,
                    'name': chat.get('name', '') or chat.get('subject', '') or chat_id.replace('@g.us', ''),
                    'timestamp': chat.get('timestamp', 0),
                    'unreadCount': chat.get('unreadCount', 0),
                })
        
        print(f"Found {len(groups)} groups from Waha")
        return groups
        
    except requests.exceptions.ConnectionError:
        print(f"Cannot connect to Waha API at {WAHA_API_URL}")
        print("Make sure you're running this from a machine that can reach the Waha server")
        return []
    except Exception as e:
        print(f"Error fetching groups: {e}")
        return []


def classify_group(group_name):
    """Auto-classify group based on name keywords"""
    lower_name = group_name.lower()
    
    # Check for project keywords
    best_match = None
    best_confidence = 0
    
    for keyword, mapping in PROJECT_KEYWORDS.items():
        if keyword in lower_name and mapping['confidence'] > best_confidence:
            best_match = mapping
            best_confidence = mapping['confidence']
    
    # Check for type keywords
    detected_type = "internal"  # default
    for keyword, group_type in TYPE_KEYWORDS.items():
        if keyword in lower_name:
            detected_type = group_type
            break
    
    if best_match:
        return {
            'project': best_match['project'],
            'type': best_match.get('type', detected_type),
            'confidence': best_match['confidence'],
            'auto_classified': True
        }
    else:
        return {
            'project': None,
            'type': detected_type,
            'confidence': 0,
            'auto_classified': False
        }


def sync_groups_to_firestore(db, groups):
    """Update Firestore with group names and classifications"""
    if not db:
        print("No database connection")
        return
    
    collection_path = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('whatsapp_groups')
    
    updated = 0
    created = 0
    
    for group in groups:
        group_id = group['id']
        group_name = group['name']
        
        # Skip if name is just the numeric ID
        if not group_name or group_name == group_id.replace('@g.us', ''):
            print(f"  Skipping {group_id} - no name available")
            continue
        
        # Create document ID from group_id
        doc_id = group_id.replace('@g.us', '').replace('.', '_')[:50]
        doc_ref = collection_path.document(doc_id)
        
        # Check if exists
        existing = doc_ref.get()
        
        # Auto-classify
        classification = classify_group(group_name)
        
        if existing.exists:
            existing_data = existing.to_dict()
            existing_name = existing_data.get('name', '')
            
            # Only update if current name is numeric or missing
            if not existing_name or existing_name.replace('@g.us', '').isdigit():
                update_data = {
                    'name': group_name,
                    'updatedAt': datetime.utcnow().isoformat(),
                }
                
                # Only update classification if not manually set
                if not existing_data.get('project') and classification['auto_classified']:
                    update_data['project'] = classification['project']
                    update_data['type'] = classification['type']
                    update_data['auto_confidence'] = classification['confidence']
                
                doc_ref.update(update_data)
                print(f"  ✓ Updated: {existing_name} → {group_name}")
                if classification['auto_classified']:
                    print(f"    Auto-classified: {classification['project']} ({classification['type']})")
                updated += 1
            else:
                print(f"  - Exists: {group_name}")
        else:
            # Create new
            doc_data = {
                'name': group_name,
                'group_id': group_id,
                'project': classification['project'] if classification['auto_classified'] else None,
                'type': classification['type'],
                'priority': 'medium',
                'autoExtractTasks': True,
                'auto_confidence': classification['confidence'] if classification['auto_classified'] else 0,
                'createdAt': datetime.utcnow().isoformat(),
            }
            doc_ref.set(doc_data)
            print(f"  + Created: {group_name}")
            if classification['auto_classified']:
                print(f"    Auto-classified: {classification['project']} ({classification['type']})")
            created += 1
    
    print(f"\nSync complete: {created} created, {updated} updated")


def main():
    print("=" * 60)
    print("WhatsApp Group Sync for Sigma HQ")
    print("=" * 60)
    
    # Initialize Firebase
    print("\n1. Connecting to Firebase...")
    db = init_firebase()
    if not db:
        return
    print("   Connected!")
    
    # Fetch groups from Waha
    print("\n2. Fetching groups from Waha API...")
    groups = get_waha_groups()
    if not groups:
        return
    
    # Show what we found
    print("\n3. Groups found:")
    for g in groups:
        classification = classify_group(g['name'])
        status = f"→ {classification['project']} ({classification['type']})" if classification['auto_classified'] else "→ needs manual mapping"
        print(f"   - {g['name']} {status}")
    
    # Sync to Firestore
    print("\n4. Syncing to Firestore...")
    sync_groups_to_firestore(db, groups)
    
    print("\n" + "=" * 60)
    print("Done! Refresh your Sigma HQ dashboard to see the changes.")
    print("=" * 60)


if __name__ == "__main__":
    main()
