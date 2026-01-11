# Waha API - WhatsApp API operations via Waha server

import requests

from config import WAHA_API_URL, WAHA_API_KEY


def get_group_name_from_waha(group_id):
    """Fetch group name from Waha API"""
    headers = {'X-Api-Key': WAHA_API_KEY} if WAHA_API_KEY else {}
    
    # Try groups endpoint first
    try:
        url = f"{WAHA_API_URL}/api/default/groups/{group_id}"
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            group_name = data.get('subject') or data.get('name') or \
                         data.get('id', {}).get('user', '')
            return group_name
    except Exception as e:
        print(f"Error fetching group from Waha: {e}")
    
    # Fallback to chats endpoint
    try:
        url = f"{WAHA_API_URL}/api/default/chats/{group_id}"
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get('name') or data.get('subject') or ''
    except Exception as e:
        print(f"Error fetching chat from Waha: {e}")
    
    return None


def check_waha_session():
    """Check if Waha session is connected"""
    headers = {'X-Api-Key': WAHA_API_KEY} if WAHA_API_KEY else {}
    try:
        response = requests.get(
            f"{WAHA_API_URL}/api/sessions/default", 
            headers=headers, 
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            status = data.get('status', '').upper()
            return status in ['WORKING', 'CONNECTED', 'AUTHENTICATED']
    except Exception as e:
        print(f"Session check error: {e}")
    return False


def send_whatsapp_message(chat_id, message):
    """Send a text message via Waha API"""
    headers = {
        'X-Api-Key': WAHA_API_KEY,
        'Content-Type': 'application/json'
    }
    
    try:
        url = f"{WAHA_API_URL}/api/sendText"
        payload = {
            'session': 'default',
            'chatId': chat_id,
            'text': message
        }
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code in [200, 201]:
            print(f"Message sent to {chat_id}")
            return True
        else:
            print(f"Failed to send message: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error sending message: {e}")
    
    return False


def send_whatsapp_file_direct(chat_id, file_data, filename, mime_type):
    """Send a file directly via Waha API (Waha Plus only)
    
    Args:
        chat_id: WhatsApp chat ID
        file_data: Either base64 string or URL
        filename: Name of the file
        mime_type: MIME type of the file
    
    Returns:
        tuple: (success: bool, message: str)
    """
    headers = {
        'X-Api-Key': WAHA_API_KEY,
        'Content-Type': 'application/json'
    }
    
    try:
        # Determine if file_data is base64 or URL
        if file_data.startswith('http'):
            payload = {
                'session': 'default',
                'chatId': chat_id,
                'file': {
                    'url': file_data,
                    'filename': filename,
                    'mimetype': mime_type
                }
            }
        else:
            payload = {
                'session': 'default',
                'chatId': chat_id,
                'file': {
                    'mimetype': mime_type,
                    'filename': filename,
                    'data': file_data
                }
            }
        
        url = f"{WAHA_API_URL}/api/sendFile"
        response = requests.post(url, headers=headers, json=payload, timeout=180)
        
        if response.status_code == 200:
            return True, "File sent"
        else:
            print(f"sendFile failed: {response.status_code} - {response.text}")
            return False, f"Send failed: {response.status_code}"
            
    except Exception as e:
        print(f"Error sending file: {e}")
        return False, str(e)
