# Firestore Operations - All database read/write operations

import re
from datetime import datetime, timezone, timedelta
import google.cloud.firestore as firestore_module

from config import FIREBASE_PROJECT, APP_ID

# Initialize Firestore client
db = firestore_module.Client(project=FIREBASE_PROJECT)


def get_data_collection(collection_name):
    """Get a reference to a data collection"""
    return db.collection('artifacts').document(APP_ID)\
        .collection('public').document('data')\
        .collection(collection_name)


# =============================================================================
# GROUP OPERATIONS
# =============================================================================

def get_cached_group_name(group_id):
    """Get cached group name from Firestore"""
    try:
        docs = get_data_collection('whatsapp_groups')\
            .where('group_id', '==', group_id).stream()
        for doc in docs:
            data = doc.to_dict()
            name = data.get('name', '')
            if name and not name.replace('@g.us', '').isdigit():
                return name
    except Exception as e:
        print(f"Error getting cached group: {e}")
    return None


def get_group_mappings():
    """Get WhatsApp group mappings from Firestore"""
    mappings = {}
    try:
        docs = get_data_collection('whatsapp_groups').stream()
        for doc in docs:
            data = doc.to_dict()
            group_name = data.get('name', '')
            group_id = data.get('group_id', '')
            
            mapping_data = {
                'project': data.get('project'),
                'type': data.get('type', 'internal'),
                'priority': data.get('priority', 'medium'),
                'autoExtractTasks': data.get('autoExtractTasks', True)
            }
            
            if group_name:
                mappings[group_name.lower()] = mapping_data
            if group_id:
                mappings[group_id.lower()] = {**mapping_data, 'name': group_name}
    except Exception as e:
        print(f"Error loading group mappings: {e}")
    return mappings


def auto_add_group(group_name, group_id):
    """Auto-add new group to mappings"""
    try:
        group_doc_id = re.sub(r'[^a-zA-Z0-9]', '_', group_id)[:50]
        group_ref = get_data_collection('whatsapp_groups').document(group_doc_id)
        
        existing = group_ref.get()
        if not existing.exists:
            group_ref.set({
                'name': group_name,
                'group_id': group_id,
                'project': None,
                'type': 'internal',
                'priority': 'medium',
                'autoExtractTasks': True,
                'createdAt': datetime.now(timezone.utc).isoformat()
            })
            print(f"Auto-added group: {group_name}")
        else:
            # Update name if current name is just numbers
            existing_data = existing.to_dict()
            existing_name = existing_data.get('name', '')
            if group_name and not group_name.replace('@g.us', '').isdigit() \
               and existing_name.replace('@g.us', '').isdigit():
                group_ref.update({'name': group_name})
    except Exception as e:
        print(f"Error auto-adding group: {e}")


# =============================================================================
# PROJECT OPERATIONS
# =============================================================================

def get_registered_projects():
    """Get list of registered projects from Firestore"""
    projects = []
    try:
        docs = get_data_collection('projects').stream()
        for doc in docs:
            data = doc.to_dict()
            projects.append({
                'id': doc.id,
                'name': data.get('name', ''),
                'client': data.get('client', ''),
                'location': data.get('location', ''),
                'venue': data.get('venue', ''),
                'status': data.get('status', 'active'),
                'drive_folder_id': data.get('drive_folder_id', ''),
                'keywords': data.get('keywords', [])
            })
    except Exception as e:
        print(f"Error loading projects: {e}")
    return projects


def get_project_stats(project_name):
    """Get statistics for a specific project"""
    stats = {
        'pending_tasks': 0,
        'high_urgency': 0,
        'recent_messages': 0,
        'recent_emails': 0,
        'last_activity': None
    }
    
    try:
        # Get pending actionable messages
        messages = get_data_collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .stream()
        
        for msg in messages:
            stats['pending_tasks'] += 1
            data = msg.to_dict()
            if data.get('urgency') == 'high':
                stats['high_urgency'] += 1
            
            created = data.get('created_at')
            if created:
                if not stats['last_activity'] or created > stats['last_activity']:
                    stats['last_activity'] = created
        
        # Get recent messages (last 24h)
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        recent = get_data_collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('created_at', '>=', yesterday)\
            .stream()
        stats['recent_messages'] = sum(1 for _ in recent)
        
        # Get recent emails
        emails = get_data_collection('emails')\
            .where('project_name', '==', project_name)\
            .where('created_at', '>=', yesterday)\
            .stream()
        stats['recent_emails'] = sum(1 for _ in emails)
        
    except Exception as e:
        print(f"Error getting project stats: {e}")
    
    return stats


# =============================================================================
# MESSAGE/TASK OPERATIONS
# =============================================================================

def get_project_pending_items(project_name, limit=15):
    """Get actual pending items for a specific project with doc IDs"""
    items = []
    try:
        messages = get_data_collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .order_by('created_at', direction=firestore_module.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'doc_id': msg.id,
                'summary': data.get('summary', data.get('text', '')[:50]),
                'urgency': data.get('urgency', 'medium'),
                'type': data.get('action_type', 'task'),
                'sender': data.get('sender_name', 'Unknown'),
                'created': data.get('created_at', ''),
                'group': data.get('group_name', ''),
                'assigned_to': data.get('assigned_to'),
                'deadline': data.get('deadline')
            })
    except Exception as e:
        print(f"Error getting project pending items: {e}")
    
    return items


def get_project_recent_activity(project_name, limit=10):
    """Get recent activity for a project"""
    items = []
    try:
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        
        messages = get_data_collection('whatsapp_messages')\
            .where('project_name', '==', project_name)\
            .where('created_at', '>=', yesterday)\
            .order_by('created_at', direction=firestore_module.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'summary': data.get('summary', data.get('text', '')[:50]),
                'sender': data.get('sender_name', 'Unknown'),
                'type': data.get('action_type', 'info'),
                'actionable': data.get('is_actionable', False),
                'created': data.get('created_at', '')
            })
    except Exception as e:
        print(f"Error getting project activity: {e}")
    
    return items


def get_all_pending_items(limit=20):
    """Get all pending actionable items across all projects with doc IDs"""
    items = []
    try:
        messages = get_data_collection('whatsapp_messages')\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .order_by('created_at', direction=firestore_module.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'doc_id': msg.id,
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'urgency': data.get('urgency', 'medium'),
                'type': data.get('action_type', 'task'),
                'created': data.get('created_at', ''),
                'assigned_to': data.get('assigned_to'),
                'deadline': data.get('deadline')
            })
    except Exception as e:
        print(f"Error getting pending items: {e}")
    
    return items


def get_urgent_items():
    """Get all high urgency items"""
    items = []
    try:
        messages = get_data_collection('whatsapp_messages')\
            .where('urgency', '==', 'high')\
            .where('status', '==', 'pending')\
            .order_by('created_at', direction=firestore_module.Query.DESCENDING)\
            .limit(15)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'doc_id': msg.id,
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'type': data.get('action_type', 'task'),
                'created': data.get('created_at', '')
            })
    except Exception as e:
        print(f"Error getting urgent items: {e}")
    
    return items


def get_today_items():
    """Get items created today"""
    items = []
    try:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
        
        messages = get_data_collection('whatsapp_messages')\
            .where('is_actionable', '==', True)\
            .where('created_at', '>=', today_start)\
            .order_by('created_at', direction=firestore_module.Query.DESCENDING)\
            .limit(20)\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            items.append({
                'doc_id': msg.id,
                'project': data.get('project_name', 'Unknown'),
                'summary': data.get('summary', data.get('text', '')[:50]),
                'urgency': data.get('urgency', 'medium'),
                'type': data.get('action_type', 'task'),
                'status': data.get('status', 'pending')
            })
    except Exception as e:
        print(f"Error getting today items: {e}")
    
    return items


def get_overdue_items():
    """Get items past their deadline"""
    items = []
    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        messages = get_data_collection('whatsapp_messages')\
            .where('is_actionable', '==', True)\
            .where('status', '==', 'pending')\
            .stream()
        
        for msg in messages:
            data = msg.to_dict()
            deadline = data.get('deadline')
            if deadline and deadline < today:
                items.append({
                    'doc_id': msg.id,
                    'project': data.get('project_name', 'Unknown'),
                    'summary': data.get('summary', data.get('text', '')[:50]),
                    'deadline': deadline,
                    'days_overdue': 0  # Calculate if needed
                })
    except Exception as e:
        print(f"Error getting overdue items: {e}")
    
    return items


# =============================================================================
# ACTION OPERATIONS
# =============================================================================

def mark_item_done(project_name, item_index, items_cache=None):
    """Mark an item as done by index"""
    try:
        if items_cache and item_index <= len(items_cache):
            doc_id = items_cache[item_index - 1]['doc_id']
        else:
            items = get_project_pending_items(project_name, limit=20) if project_name \
                else get_all_pending_items(limit=20)
            if item_index > len(items):
                return False, "Item number not found"
            doc_id = items[item_index - 1]['doc_id']
        
        doc_ref = get_data_collection('whatsapp_messages').document(doc_id)
        doc_ref.update({
            'status': 'done',
            'completed_at': datetime.now(timezone.utc).isoformat()
        })
        return True, "Item marked as done"
    except Exception as e:
        print(f"Error marking item done: {e}")
        return False, str(e)


def assign_item(project_name, item_index, assignee):
    """Assign an item to someone"""
    try:
        items = get_project_pending_items(project_name, limit=20) if project_name \
            else get_all_pending_items(limit=20)
        if item_index > len(items):
            return False, "Item number not found"
        
        doc_id = items[item_index - 1]['doc_id']
        doc_ref = get_data_collection('whatsapp_messages').document(doc_id)
        doc_ref.update({
            'assigned_to': assignee,
            'assigned_at': datetime.now(timezone.utc).isoformat()
        })
        return True, f"Assigned to {assignee}"
    except Exception as e:
        print(f"Error assigning item: {e}")
        return False, str(e)


def set_item_urgency(project_name, item_index, urgency):
    """Set urgency level for an item"""
    try:
        items = get_project_pending_items(project_name, limit=20) if project_name \
            else get_all_pending_items(limit=20)
        if item_index > len(items):
            return False, "Item number not found"
        
        doc_id = items[item_index - 1]['doc_id']
        doc_ref = get_data_collection('whatsapp_messages').document(doc_id)
        doc_ref.update({'urgency': urgency})
        return True, f"Set to {urgency} priority"
    except Exception as e:
        print(f"Error setting urgency: {e}")
        return False, str(e)


# =============================================================================
# SEARCH CACHE
# =============================================================================

def save_search_results(chat_id, results):
    """Save search results to Firestore for later retrieval"""
    try:
        cache_id = re.sub(r'[^a-zA-Z0-9]', '_', chat_id)[:50]
        get_data_collection('search_cache').document(cache_id).set({
            'chat_id': chat_id,
            'results': results,
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        return True
    except Exception as e:
        print(f"Error saving search results: {e}")
        return False


def get_last_search_results(chat_id):
    """Get last search results for a chat"""
    try:
        cache_id = re.sub(r'[^a-zA-Z0-9]', '_', chat_id)[:50]
        doc = get_data_collection('search_cache').document(cache_id).get()
        if doc.exists:
            data = doc.to_dict()
            return data.get('results', [])
    except Exception as e:
        print(f"Error getting search results: {e}")
    return []


# =============================================================================
# SHORT URL STORAGE
# =============================================================================

def save_short_url(short_code, gcs_path, signed_url, expires_at):
    """Save short URL mapping to Firestore"""
    try:
        get_data_collection('short_urls').document(short_code).set({
            'gcs_path': gcs_path,
            'signed_url': signed_url,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'expires_at': expires_at.isoformat()
        })
        return True
    except Exception as e:
        print(f"Error saving short URL: {e}")
        return False


def get_short_url_data(short_code):
    """Get short URL data from Firestore"""
    try:
        doc = get_data_collection('short_urls').document(short_code.upper()).get()
        if doc.exists:
            return doc.to_dict()
    except Exception as e:
        print(f"Error getting short URL: {e}")
    return None


# =============================================================================
# MESSAGE SAVE
# =============================================================================

def save_message(message_data, classification):
    """Save classified message to Firestore"""
    try:
        doc_data = {
            'message_id': message_data.get('id', ''),
            'group_name': message_data.get('group_name', ''),
            'group_id': message_data.get('group_id', ''),
            'sender': message_data.get('sender', ''),
            'sender_name': message_data.get('sender_name', ''),
            'text': message_data.get('text', ''),
            'timestamp': message_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            'project_name': classification.get('project_name'),
            'is_actionable': classification.get('is_actionable', False),
            'action_type': classification.get('action_type', 'info'),
            'summary': classification.get('summary', ''),
            'urgency': classification.get('urgency', 'low'),
            'channel_type': classification.get('channel_type', 'internal'),
            'assigned_to': classification.get('assigned_to'),
            'deadline': classification.get('deadline'),
            'is_command': classification.get('is_command', False),
            'command_type': classification.get('command_type'),
            'status': 'pending' if classification.get('is_actionable') else 'info',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        get_data_collection('whatsapp_messages').add(doc_data)
        print(f"Saved: {doc_data['summary'][:50]}")
        return True
    except Exception as e:
        print(f"Error saving: {e}")
        return False
