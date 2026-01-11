# WhatsApp Webhook - Main HTTP Handler
# v4.13 - Modular Architecture
#
# This file is now slim (~150 lines) - all logic is in modules:
# - config.py: Environment variables
# - utils/: Helper functions (revision_parser, date_utils)
# - services/: External services (firestore_ops, waha_api, file_delivery, vertex_search)
# - handlers/: Business logic (commands, classification)

import functions_framework
from flask import jsonify, redirect

from config import WAHA_API_URL, WAHA_PLUS_ENABLED, ENGINE_ID

from services.firestore_ops import (
    get_cached_group_name, get_group_mappings, get_registered_projects,
    auto_add_group, save_message
)
from services.waha_api import get_group_name_from_waha
from services.file_delivery import get_short_url_redirect
from handlers.classification import classify_message, VERTEX_AI_ENABLED


@functions_framework.http
def whatsapp_webhook(request):
    """Handle incoming WhatsApp webhooks
    
    Endpoints:
    - GET /: Health check
    - GET /v/{code}: Short URL redirect
    - POST /webhook: Incoming message handler
    """
    
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return ('', 204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type'
        })
    
    headers = {'Access-Control-Allow-Origin': '*'}
    
    # ==========================================================================
    # SHORT URL REDIRECT: /v/{code}
    # ==========================================================================
    path = request.path
    if path.startswith('/v/'):
        short_code = path[3:].upper()
        signed_url, err = get_short_url_redirect(short_code)
        if signed_url:
            return redirect(signed_url, code=302)
        else:
            return (jsonify({'error': err or 'Link not found'}), 404, headers)
    
    # ==========================================================================
    # HEALTH CHECK: GET /
    # ==========================================================================
    if request.method == 'GET':
        return (jsonify({
            'status': 'WhatsApp Webhook v4.13 - Modular',
            'waha_plus': WAHA_PLUS_ENABLED,
            'features': [
                'modular_architecture',
                'done', 'assign', 'escalate', 'defer', 
                'shortcuts', 'digest', 'vertex_search', 
                'inline_view', 'revision_sort', 'short_urls'
            ],
            'waha_url': WAHA_API_URL,
            'vertex_ai': VERTEX_AI_ENABLED,
            'search_engine': ENGINE_ID
        }), 200, headers)
    
    # ==========================================================================
    # WEBHOOK HANDLER: POST /
    # ==========================================================================
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            
            # Only process message events
            event = data.get('event', '')
            payload = data.get('payload', {})
            
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
                # Try cache first
                group_name = get_cached_group_name(chat_id)
                
                # Fallback to Waha API if cache has numeric name
                if not group_name or group_name.replace('@g.us', '').isdigit():
                    waha_name = get_group_name_from_waha(chat_id)
                    if waha_name:
                        group_name = waha_name
                
                # Final fallback to chat ID
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
            
            # Auto-add new groups
            if is_group and group_name:
                auto_add_group(group_name, chat_id)
            
            # Get group configuration
            group_mappings = get_group_mappings()
            group_config = group_mappings.get(group_name.lower()) or group_mappings.get(chat_id.lower())
            
            # Update group name from config if available
            if group_config and group_config.get('name'):
                stored_name = group_config.get('name')
                if stored_name and not stored_name.replace('@g.us', '').isdigit():
                    group_name = stored_name
                    message_data['group_name'] = group_name
            
            # Get projects for classification
            projects = get_registered_projects()
            
            # Classify message (handles commands and AI classification)
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
            import traceback
            traceback.print_exc()
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
