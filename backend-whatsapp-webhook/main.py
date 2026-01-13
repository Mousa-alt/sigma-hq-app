# WhatsApp Webhook - v4.16 with Anomaly Detection (Phase 4.1)
# 
# This is the main entry point. All logic is in separate modules:
# - config.py: Environment variables and constants
# - handlers/commands.py: Command processing
# - handlers/classifier.py: AI message classification
# - services/firestore_ops.py: Database operations
# - services/waha_api.py: WhatsApp API calls
# - services/vertex_search.py: Document search
# - services/file_delivery.py: File sending with signed URLs
# - services/anomaly_detector.py: Red flag & security monitoring (NEW)
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
    auto_add_group, save_message, cleanup_duplicate_groups, sync_group_id_fields
)
from services.file_delivery import get_short_url_redirect
from services.anomaly_detector import (
    process_webhook_for_anomalies,
    get_active_alerts,
    acknowledge_alert
)

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
    - POST /admin/cleanup-groups: Remove duplicate groups
    - POST /admin/sync-group-ids: Sync group_id and wahaId fields
    - GET /alerts: Get active alerts (Phase 4.1)
    - POST /alerts/{id}/acknowledge: Acknowledge an alert (Phase 4.1)
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
    # ALERTS API: GET /alerts - Get active alerts (Phase 4.1)
    # =========================================================================
    if path == '/alerts' and request.method == 'GET':
        try:
            limit = int(request.args.get('limit', 50))
            alerts = get_active_alerts(limit)
            return (jsonify({
                'alerts': alerts,
                'count': len(alerts)
            }), 200, headers)
        except Exception as e:
            print(f"Get alerts error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    # =========================================================================
    # ALERTS API: POST /alerts/{id}/acknowledge - Acknowledge alert (Phase 4.1)
    # =========================================================================
    if path.startswith('/alerts/') and path.endswith('/acknowledge') and request.method == 'POST':
        try:
            alert_id = path.split('/')[2]
            data = request.get_json(silent=True) or {}
            acknowledged_by = data.get('acknowledgedBy', 'user')
            
            success = acknowledge_alert(alert_id, acknowledged_by)
            if success:
                return (jsonify({'success': True, 'alertId': alert_id}), 200, headers)
            else:
                return (jsonify({'error': 'Failed to acknowledge alert'}), 500, headers)
        except Exception as e:
            print(f"Acknowledge alert error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    # =========================================================================
    # ADMIN: /admin/cleanup-groups - Remove duplicate groups
    # =========================================================================
    if path == '/admin/cleanup-groups' and request.method == 'POST':
        try:
            results = cleanup_duplicate_groups()
            return (jsonify({
                'success': True,
                'message': f"Cleaned up {results['duplicates_removed']} duplicate groups",
                **results
            }), 200, headers)
        except Exception as e:
            print(f"Cleanup error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    # =========================================================================
    # ADMIN: /admin/sync-group-ids - Sync group_id and wahaId fields
    # =========================================================================
    if path == '/admin/sync-group-ids' and request.method == 'POST':
        try:
            results = sync_group_id_fields()
            return (jsonify({
                'success': True,
                'message': f"Synced {results['updated']} groups",
                **results
            }), 200, headers)
        except Exception as e:
            print(f"Sync error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
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
            'status': 'ok',
            'service': 'WhatsApp Webhook',
            'version': '4.16-anomaly-detection',
            'waha_plus': WAHA_PLUS_ENABLED,
            'features': [
                'modular_architecture',
                'anomaly_detection',
                'red_flag_alerts',
                'spam_detection',
                'session_monitoring',
                'admin_cleanup',
                'admin_sync_ids',
                'done', 'assign', 'escalate', 'defer',
                'shortcuts', 'digest', 'vertex_search',
                'inline_view', 'revision_sort', 'short_urls', 'waha_proxy'
            ],
            'endpoints': {
                'alerts': 'GET /alerts',
                'acknowledge': 'POST /alerts/{id}/acknowledge',
                'admin_cleanup': 'POST /admin/cleanup-groups',
                'admin_sync': 'POST /admin/sync-group-ids'
            },
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
            
            # =====================================================
            # PHASE 4.1: Process ALL events through anomaly detector
            # =====================================================
            alert_ids = process_webhook_for_anomalies(event, payload)
            if alert_ids:
                print(f"🚨 Created {len(alert_ids)} alerts for event: {event}")
            
            # Only fully process message events
            if event != 'message':
                return (jsonify({
                    'status': 'processed',
                    'event': event,
                    'alerts_created': len(alert_ids)
                }), 200, headers)
            
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
                'summary': classification.get('summary', '')[:50],
                'alerts_created': len(alert_ids)
            }), 200, headers)
            
        except Exception as e:
            print(f"Webhook error: {e}")
            return (jsonify({'error': str(e)}), 500, headers)
    
    return (jsonify({'error': 'Invalid request'}), 400, headers)
