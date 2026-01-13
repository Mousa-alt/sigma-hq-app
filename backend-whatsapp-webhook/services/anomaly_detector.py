# Anomaly Detection Service for WhatsApp Messages
# Phase 4.1: Red Flag & Security Monitoring
#
# Monitors for:
# - Session instability (WhatsApp disconnects)
# - Delivery failures
# - Critical operational keywords (construction emergencies)
#
# NOTE: Spam/flood detection REMOVED - internal groups often forward many messages at once

from datetime import datetime
from google.cloud import firestore

from config import FIREBASE_PROJECT, APP_ID

# Initialize Firestore client
try:
    db = firestore.Client(project=FIREBASE_PROJECT)
    FIRESTORE_ENABLED = True
except Exception as e:
    print(f"Firestore init error in anomaly_detector: {e}")
    db = None
    FIRESTORE_ENABLED = False

# Critical keywords for construction safety
RED_FLAG_KEYWORDS = [
    'stop work', 'accident', 'injury', 'emergency', 'collapse',
    'fire', 'evacuation', 'danger', 'unsafe', 'incident',
    'hurt', 'hospital', 'ambulance', 'police', 'death',
    'fallen', 'electrocution', 'gas leak', 'explosion'
]

# Severity levels
SEVERITY_CRITICAL = 'critical'
SEVERITY_HIGH = 'high'
SEVERITY_MEDIUM = 'medium'
SEVERITY_LOW = 'low'


def analyze_message_vitals(message_data, event_type='message'):
    """
    Analyze incoming message for red flags.
    
    Args:
        message_data: Dict with 'sender', 'text', 'group_name', 'group_id', etc.
        event_type: Type of webhook event
    
    Returns:
        List of alert dicts to be saved
    """
    alerts = []
    
    sender = message_data.get('sender', '')
    text = message_data.get('text', '') or message_data.get('body', '')
    group_name = message_data.get('group_name', '')
    chat_id = message_data.get('group_id', '') or message_data.get('chatId', '')
    
    # =========================================================================
    # CRITICAL KEYWORD DETECTION (Construction Safety)
    # =========================================================================
    if text:
        text_lower = text.lower()
        detected_keywords = [kw for kw in RED_FLAG_KEYWORDS if kw in text_lower]
        
        if detected_keywords:
            # Determine severity based on keyword
            is_critical = any(kw in ['accident', 'injury', 'collapse', 'death', 'emergency', 'fire'] for kw in detected_keywords)
            
            alerts.append({
                'type': 'OPERATIONAL_RISK',
                'category': 'critical_keyword',
                'severity': SEVERITY_CRITICAL if is_critical else SEVERITY_HIGH,
                'reason': f"Critical keyword detected: {', '.join(detected_keywords)}",
                'metadata': {
                    'keywords': detected_keywords,
                    'message_preview': text[:200],
                    'sender': sender,
                    'group_name': group_name,
                    'chatId': chat_id
                }
            })
    
    return alerts


def analyze_session_status(status_data):
    """
    Analyze WAHA session status events.
    
    Args:
        status_data: Dict with session status info
    
    Returns:
        List of alert dicts
    """
    alerts = []
    
    status = status_data.get('status', '').upper()
    
    # Alert on any non-connected status
    if status and status != 'CONNECTED':
        severity = SEVERITY_CRITICAL if status in ['DISCONNECTED', 'FAILED', 'LOGOUT'] else SEVERITY_HIGH
        
        alerts.append({
            'type': 'SYSTEM',
            'category': 'session_instability',
            'severity': severity,
            'reason': f"WhatsApp session status: {status}",
            'metadata': {
                'status': status,
                'raw_data': status_data
            }
        })
    
    return alerts


def analyze_delivery_status(ack_data):
    """
    Analyze message delivery acknowledgment events.
    
    Args:
        ack_data: Dict with message ack info
    
    Returns:
        List of alert dicts
    """
    alerts = []
    
    ack_status = ack_data.get('ack', -1)
    message_id = ack_data.get('id', {})
    
    # Ack values: -1=ERROR, 0=PENDING, 1=SERVER, 2=DEVICE, 3=READ, 4=PLAYED
    if ack_status == -1:  # ERROR
        alerts.append({
            'type': 'DELIVERY',
            'category': 'delivery_failure',
            'severity': SEVERITY_MEDIUM,
            'reason': f"Message delivery failed",
            'metadata': {
                'message_id': str(message_id),
                'ack_status': ack_status
            }
        })
    
    return alerts


def save_alerts(alerts):
    """
    Save alerts to Firestore.
    
    Path: artifacts/{APP_ID}/public/data/alerts/{ALERT_ID}
    """
    if not FIRESTORE_ENABLED or not alerts:
        return []
    
    saved_ids = []
    alerts_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('alerts')
    
    for alert in alerts:
        try:
            doc_data = {
                'timestamp': firestore.SERVER_TIMESTAMP,
                'type': alert.get('type', 'UNKNOWN'),
                'category': alert.get('category', 'general'),
                'severity': alert.get('severity', SEVERITY_LOW),
                'reason': alert.get('reason', ''),
                'metadata': alert.get('metadata', {}),
                'status': 'active',
                'acknowledged': False,
                'acknowledgedBy': None,
                'acknowledgedAt': None
            }
            
            doc_ref = alerts_ref.add(doc_data)
            saved_ids.append(doc_ref[1].id)
            
            # Log critical alerts
            if alert.get('severity') in [SEVERITY_CRITICAL, SEVERITY_HIGH]:
                print(f"🚨 ALERT [{alert.get('severity').upper()}]: {alert.get('reason')}")
        
        except Exception as e:
            print(f"Error saving alert: {e}")
    
    return saved_ids


def process_webhook_for_anomalies(event_type, payload):
    """
    Main entry point - process any webhook event for anomalies.
    
    Args:
        event_type: Webhook event type (message, session.status, message.ack, etc.)
        payload: Event payload
    
    Returns:
        List of saved alert IDs
    """
    alerts = []
    
    if event_type == 'message':
        # Build message data from payload
        message_data = {
            'sender': payload.get('from', ''),
            'text': payload.get('body', ''),
            'group_name': payload.get('_data', {}).get('notifyName', ''),
            'group_id': payload.get('chatId', '') or payload.get('from', ''),
            'chatId': payload.get('chatId', '')
        }
        alerts = analyze_message_vitals(message_data, event_type)
    
    elif event_type == 'session.status':
        alerts = analyze_session_status(payload)
    
    elif event_type == 'message.ack':
        alerts = analyze_delivery_status(payload)
    
    # Save any detected alerts
    if alerts:
        saved_ids = save_alerts(alerts)
        return saved_ids
    
    return []


# =========================================================================
# API ENDPOINT HELPERS
# =========================================================================

def get_active_alerts(limit=50):
    """Get active (unacknowledged) alerts"""
    if not FIRESTORE_ENABLED:
        return []
    
    try:
        alerts_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('alerts')
        query = alerts_ref.where('status', '==', 'active').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)
        
        alerts = []
        for doc in query.stream():
            alert = doc.to_dict()
            alert['id'] = doc.id
            alerts.append(alert)
        
        return alerts
    except Exception as e:
        print(f"Error getting alerts: {e}")
        return []


def acknowledge_alert(alert_id, acknowledged_by='system'):
    """Mark an alert as acknowledged"""
    if not FIRESTORE_ENABLED:
        return False
    
    try:
        alert_ref = db.collection('artifacts').document(APP_ID).collection('public').document('data').collection('alerts').document(alert_id)
        alert_ref.update({
            'status': 'acknowledged',
            'acknowledged': True,
            'acknowledgedBy': acknowledged_by,
            'acknowledgedAt': firestore.SERVER_TIMESTAMP
        })
        return True
    except Exception as e:
        print(f"Error acknowledging alert: {e}")
        return False
