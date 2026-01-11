# WhatsApp Webhook - v4.14 Modular Architecture
# 
# This is the main entry point. All logic is in separate modules:
# - config.py: Environment variables and constants
# - handlers/commands.py: Command processing
# - handlers/classifier.py: AI message classification
# - services/firestore_ops.py: Database operations
# - services/waha_api.py: WhatsApp API calls
# - services/vertex_search.py: Document search
# - services/file_delivery.py: File sending with signed URLs
# - utils/revision_parser.py: Revision sorting

import functions_framework
from flask import jsonify, redirect
import requests

# Import configuration
from config import (
    WAHA_API_URL, WAHA_API_KEY, WAHA_PLUS_ENABLED,
    ENGINE_ID, VERTEX_LOCATION
)

# Import services
from services.waha_api import get_group_name_from_waha, check_waha_session
from services.firestore_ops import (
    get_cached_group_name, get_group_mappings, get_registered_projects,
    auto_add_group, save_message
)
from services.file_delivery import get_short_url_redirect

# Import handlers
from handlers.classifier import classify_message, VERTEX_AI_ENABLED


@functions_framework.http
def whatsapp_webhook(request):
    """Main HTTP handler for WhatsApp webhooks
    
    Endpoints:
    - GET /: Health check
    - GET /v/{code}: Short URL redirect
    - GET /waha/groups: List WhatsApp groups (proxy)
    - POST /waha/groups/create: Create WhatsApp group (proxy)
    - GET /waha/session: Check WAHA session status
    - POST /: Process incoming webhook
    """
    
    # CORS preflight
    if request.method == 'OPTIONS':
        return ('', 204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        })
    
    headers = {'Access-Control-Allow-Origin': '*'}
    path = request.path
    
    # =========================================================================
    # SHORT URL REDIRECT: /v/{code}
    # =========================================================================
    if path.startswith('/v/'):
        short_code = path[3:].upper()
        signed_url, err = get_short_url_redirect(short_code)
        if signed_url:
            return redirect(signed_url, code=302)
        else:
            return (jsonify({'error': err or 'Link not found'}), 404, headers)
    
    # =========================================================================
    # WAHA PROXY: /waha/groups - List all WhatsApp groups
    # =========================================================================
    if path == '/waha/groups' and request.method == 'GET':
        try:
            waha_headers = {'X-Api-Key': WAHA_API_KEY} if WAHA_API_KEY else {}
            response = requests.get(
                f"{WAHA_API_URL}/api/default/groups",
                headers=waha_headers,
                timeout=30
            )
            
            if response.status_code == 200:
                raw_groups = response.json()
                groups = []
                for g in raw_groups:
                    groups.append({
                        'id': g.get('id', {}).get('_serialized', '') if isinstance(g.get('id'), dict) else g.get('id', ''),
                        'name': g.get('subject') or g.get('name', ''),
                        'participants': len(g.get('participants', []))
                    })
                return (jsonify({'groups': groups}), 200, headers)
            else:
                return (jsonify({'error': f'WAHA returned {response.status_code}'}), response.status_code, headers)
        except requests.exceptions.ConnectionError:
            return (jsonify({'error': 'Cannot connect to WhatsApp service. Is WAHA running?'}), 503, headers)
        except requests.exceptions.Timeout:
            return (jsonify({'error': 'WhatsApp service timeout'}), 504, headers)
        except Exception as e:
            print(f"WAHA groups error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    # =========================================================================
    # WAHA PROXY: /waha/groups/create - Create a new WhatsApp group
    # =========================================================================
    if path == '/waha/groups/create' and request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            group_name = data.get('name', '')
            participants = data.get('participants', [])
            
            if not group_name:
                return (jsonify({'error': 'Group name is required'}), 400, headers)
            if not participants:
                return (jsonify({'error': 'At least one participant is required'}), 400, headers)
            
            waha_headers = {
                'X-Api-Key': WAHA_API_KEY,
                'Content-Type': 'application/json'
            }
            
            response = requests.post(
                f"{WAHA_API_URL}/api/default/groups",
                headers=waha_headers,
                json={'name': group_name, 'participants': participants},
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                group_id = result.get('id', {}).get('_serialized', '') if isinstance(result.get('id'), dict) else result.get('id', '')
                return (jsonify({
                    'success': True,
                    'id': group_id,
                    'name': group_name
                }), 200, headers)
            else:
                error_text = response.text[:200] if response.text else 'Unknown error'
                return (jsonify({'error': f'Failed to create group: {error_text}'}), response.status_code, headers)
        except requests.exceptions.ConnectionError:
            return (jsonify({'error': 'Cannot connect to WhatsApp service'}), 503, headers)
        except Exception as e:
            print(f"WAHA create group error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    # =========================================================================
    # WAHA PROXY: /waha/session - Check session status
    # =========================================================================
    if path == '/waha/session' and request.method == 'GET':
        try:
            connected = check_waha_session()
            return (jsonify({
                'connected': connected,
                'waha_url': WAHA_API_URL
            }), 200, headers)
        except Exception as e:
            return (jsonify({'connected': False, 'error': str(e)}), 200, headers)
    
    # =========================================================================
    # HEALTH CHECK: GET /
    # =========================================================================
    if request.method == 'GET':
        return (jsonify({
            'status': 'WhatsApp Webhook v4.14 - Modular',
            'waha_plus': WAHA_PLUS_ENABLED,
            'features': [
                'modular_architecture',
                'done', 'assign', 'escalate', 'defer',
                'shortcuts', 'digest', 'vertex_search',
                'inline_view', 'revision_sort', 'short_urls', 'waha_proxy'
            ],
            'waha_url': WAHA_API_URL,
            'vertex_ai': VERTEX_AI_ENABLED,
            'search_engine': ENGINE_ID
        }), 200, headers)
    
    # =========================================================================
    # WEBHOOK HANDLER: POST /
    # =========================================================================
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            
            event = data.get('event', '')
            payload = data.get('payload', {})
            
            # Only process message events
            if event != 'message':
                return (jsonify({'status': 'ignored', 'event': event}), 200, headers)
            
            # Extract chat info
            chat_id = payload.get('chatId', '') or payload.get('from', '')
            is_group = '@g.us' in chat_id
            
            # Extract sender info
            _data = payload.get('_data', {})
            sender_name = _data.get('notifyName', '') or payload.get('from', '').split('@')[0]
            sender = payload.get('from', '')
            
            # Skip own messages
            if payload.get('fromMe', False):
                return (jsonify({'status': 'skipped', 'reason': 'own message'}), 200, headers)
            
            # Get group name
            group_name = ''
            if is_group:
                # Try cached first, then Waha API
                group_name = get_cached_group_name(chat_id)
                if not group_name or group_name.replace('@g.us', '').isdigit():
                    waha_name = get_group_name_from_waha(chat_id)
                    if waha_name:
                        group_name = waha_name
                if not group_name:
                    group_name = chat_id.replace('@g.us', '')
            
            # Build message data
            message_data = {
                'id': payload.get('id', {}).get('id', '') if isinstance(payload.get('id'), dict) else payload.get('id', ''),
                'text': payload.get('body', ''),
                'sender': sender,
                'sender_name': sender_name,
                'group_name': group_name,
                'group_id': chat_id,
                'timestamp': payload.get('timestamp', '')
            }
            
            # Skip empty messages
            if not message_data['text']:
                return (jsonify({'status': 'skipped', 'reason': 'no text'}), 200, headers)
            
            # Auto-add new groups to mappings
            if is_group and group_name:
                auto_add_group(group_name, chat_id)
            
            # Get group configuration
            group_mappings = get_group_mappings()
            group_config = group_mappings.get(group_name.lower()) or group_mappings.get(chat_id.lower())
            
            # Update group name from stored config if better
            if group_config and group_config.get('name'):
                stored_name = group_config.get('name')
                if stored_name and not stored_name.replace('@g.us', '').isdigit():
                    group_name = stored_name
                    message_data['group_name'] = group_name
            
            # Get registered projects for classification
            projects = get_registered_projects()
            
            # Classify the message
            classification = classify_message(
                message_data['text'],
                message_data['sender'],
                message_data['group_name'],
                projects,
                group_config,
                chat_id
            )
            
            # Save to Firestore
            save_message(message_data, classification)
            
            return (jsonify({
                'status': 'processed',
                'group': group_name,
                'project': classification.get('project_name'),
                'actionable': classification.get('is_actionable'),
                'command': classification.get('command_type'),
                'summary': classification.get('summary', '')[:50]
            }), 200, headers)
            
        except Exception as e:
            print(f"Webhook error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
