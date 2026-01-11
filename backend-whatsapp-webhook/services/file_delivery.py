# File Delivery - Send files via WhatsApp with signed URLs and short URLs

import os
import base64
import hashlib
import mimetypes
from datetime import datetime, timezone, timedelta

from google.cloud import storage
import google.auth
from google.auth.transport import requests as google_requests

from config import GCS_BUCKET, WAHA_PLUS_ENABLED, SHORT_URL_BASE
from services.waha_api import check_waha_session, send_whatsapp_message, send_whatsapp_file_direct
from services.firestore_ops import save_short_url, get_short_url_data

# Initialize storage client
storage_client = storage.Client()


def generate_signed_url(gcs_path, expiration_minutes=60, inline=True):
    """Generate a signed URL using IAM signBlob API (no private key needed)
    
    This works in Cloud Run without a service account key file by using
    the IAM Credentials API to sign the URL server-side.
    
    Args:
        gcs_path: Path to file in GCS bucket
        expiration_minutes: URL validity period
        inline: If True, file opens in browser; if False, forces download
    
    Requires: roles/iam.serviceAccountTokenCreator on the service account
    """
    try:
        bucket = storage_client.bucket(GCS_BUCKET)
        blob = bucket.blob(gcs_path)
        
        if not blob.exists():
            return None, "File not found in GCS"
        
        # Get default credentials and refresh to obtain access token
        credentials, project = google.auth.default()
        credentials.refresh(google_requests.Request())
        
        # Determine content disposition based on inline flag
        filename = gcs_path.split('/')[-1]
        if inline:
            content_disposition = f'inline; filename="{filename}"'
        else:
            content_disposition = f'attachment; filename="{filename}"'
        
        # Generate signed URL using IAM signBlob API
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="GET",
            service_account_email=credentials.service_account_email,
            access_token=credentials.token,
            response_disposition=content_disposition
        )
        return url, None
    except Exception as e:
        print(f"Signed URL error: {e}")
        return None, str(e)


def generate_short_code(gcs_path):
    """Generate a short 6-character code for a file"""
    data = f"{gcs_path}:{datetime.now().timestamp()}"
    hash_obj = hashlib.md5(data.encode())
    return hash_obj.hexdigest()[:6].upper()


def create_short_url(gcs_path, expiration_minutes=60):
    """Create a short URL that redirects to the signed URL"""
    try:
        short_code = generate_short_code(gcs_path)
        
        # Generate the actual signed URL
        signed_url, err = generate_signed_url(gcs_path, expiration_minutes, inline=True)
        if not signed_url:
            return None, err
        
        # Store in Firestore
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiration_minutes)
        save_short_url(short_code, gcs_path, signed_url, expires_at)
        
        return short_code, None
    except Exception as e:
        print(f"Short URL error: {e}")
        return None, str(e)


def get_short_url_redirect(short_code):
    """Get the signed URL for a short code"""
    try:
        data = get_short_url_data(short_code)
        
        if data:
            expires_at = data.get('expires_at', '')
            
            # Check if expired
            if expires_at:
                exp_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > exp_dt:
                    return None, "Link expired"
            
            return data.get('signed_url'), None
        return None, "Link not found"
    except Exception as e:
        return None, str(e)


def get_file_size_mb(gcs_path):
    """Get file size in MB"""
    try:
        bucket = storage_client.bucket(GCS_BUCKET)
        blob = bucket.blob(gcs_path)
        if blob.exists():
            blob.reload()
            return blob.size / (1024 * 1024)
    except:
        pass
    return 0


def get_mime_type(filename):
    """Get MIME type for a file"""
    mime_type, _ = mimetypes.guess_type(filename)
    if not mime_type:
        ext = os.path.splitext(filename.lower())[1]
        mime_fallbacks = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.dwg': 'application/acad',
            '.zip': 'application/zip',
        }
        mime_type = mime_fallbacks.get(ext, 'application/octet-stream')
    return mime_type


def send_whatsapp_file(chat_id, gcs_path, filename, use_short_url=True):
    """Send a file from GCS via WhatsApp
    
    v4.12 Features:
    - Short URLs for cleaner messages
    - Inline view (opens in browser)
    - Results sorted by revision (latest first)
    
    Returns:
        tuple: (success: bool, message: str)
    """
    
    # Check session first
    if not check_waha_session():
        print("Waha session not connected")
        return False, "Technical Office is offline. Try again in 5 minutes."
    
    # Check if file exists
    bucket = storage_client.bucket(GCS_BUCKET)
    blob = bucket.blob(gcs_path)
    
    if not blob.exists():
        print(f"File not found in GCS: {gcs_path}")
        return False, "File not found"
    
    # Get file size for display
    blob.reload()
    file_size_mb = blob.size / (1024 * 1024)
    
    # ==========================================================================
    # FREE WAHA: Send view link (with short URL option)
    # ==========================================================================
    if not WAHA_PLUS_ENABLED:
        print(f"Free Waha mode: Sending view link for {filename}")
        
        # Format file size
        size_str = f"{file_size_mb:.1f}MB" if file_size_mb >= 1 else f"{int(file_size_mb * 1024)}KB"
        
        # Try short URL first if enabled
        if use_short_url and SHORT_URL_BASE:
            short_code, err = create_short_url(gcs_path, expiration_minutes=60)
            if short_code:
                short_url = f"{SHORT_URL_BASE}/v/{short_code}"
                view_msg = f"""📁 *{filename}*
📊 Size: {size_str}

👁️ {short_url}

_Valid 1 hour_"""
                if send_whatsapp_message(chat_id, view_msg):
                    return True, "Short link sent"
        
        # Fallback to full signed URL
        signed_url, err = generate_signed_url(gcs_path, expiration_minutes=60, inline=True)
        
        if not signed_url:
            return False, f"Could not generate link: {err}"
        
        view_msg = f"""📁 *{filename}*
📊 Size: {size_str}

👁️ *View Link* (valid 1 hour):
{signed_url}

_Tap to view in browser_"""
        
        if send_whatsapp_message(chat_id, view_msg):
            return True, "View link sent"
        else:
            return False, "Failed to send message"
    
    # ==========================================================================
    # WAHA PLUS: Use sendFile API (when you upgrade)
    # ==========================================================================
    else:
        print(f"Waha Plus mode: Sending file {filename}")
        
        mime_type = get_mime_type(filename)
        
        try:
            # Files > 64MB: Send link only (WhatsApp limit)
            if blob.size > 64 * 1024 * 1024:
                signed_url, _ = generate_signed_url(gcs_path, 60, inline=True)
                if signed_url:
                    msg = f"📁 *{filename}*\n\n⚠️ File too large ({file_size_mb:.1f}MB)\n\n👁️ View:\n{signed_url}"
                    send_whatsapp_message(chat_id, msg)
                    return True, "Sent as link (file too large)"
                return False, "File too large"
            
            # Files <= 15MB: Use base64
            if blob.size <= 15 * 1024 * 1024:
                file_content = blob.download_as_bytes()
                file_base64 = base64.b64encode(file_content).decode('utf-8')
                success, msg = send_whatsapp_file_direct(chat_id, file_base64, filename, mime_type)
            else:
                # Files 15-64MB: Use signed URL
                signed_url, err = generate_signed_url(gcs_path, 10, inline=False)
                if not signed_url:
                    return False, f"URL error: {err}"
                success, msg = send_whatsapp_file_direct(chat_id, signed_url, filename, mime_type)
            
            if success:
                return True, "File sent"
            else:
                # Fallback to view link
                signed_url, _ = generate_signed_url(gcs_path, 30, inline=True)
                if signed_url:
                    msg = f"📁 *{filename}*\n\n👁️ View:\n{signed_url}"
                    send_whatsapp_message(chat_id, msg)
                    return True, "Sent as view link"
                return False, msg
                
        except Exception as e:
            print(f"Error: {e}")
            # Fallback
            signed_url, _ = generate_signed_url(gcs_path, 30, inline=True)
            if signed_url:
                msg = f"📁 *{filename}*\n\n👁️ View:\n{signed_url}"
                send_whatsapp_message(chat_id, msg)
                return True, "Sent as view link"
            return False, str(e)
