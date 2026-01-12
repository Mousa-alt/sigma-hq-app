# IMAP Utilities
import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

def decode_mime_header(header_value):
    """Decode MIME encoded header"""
    if not header_value:
        return ''
    decoded_parts = []
    for part, encoding in decode_header(header_value):
        if isinstance(part, bytes):
            decoded_parts.append(part.decode(encoding or 'utf-8', errors='ignore'))
        else:
            decoded_parts.append(str(part))
    return ' '.join(decoded_parts)

def connect_imap(server, port, user, password):
    """Connect to IMAP server"""
    mail = imaplib.IMAP4_SSL(server, port)
    mail.login(user, password)
    return mail

def fetch_emails(mail, folder='INBOX', limit=50, since_date=None):
    """Fetch emails from IMAP"""
    mail.select(folder)
    
    search_criteria = 'ALL'
    if since_date:
        date_str = since_date.strftime('%d-%b-%Y')
        search_criteria = f'SINCE {date_str}'
    
    status, messages = mail.search(None, search_criteria)
    if status != 'OK':
        return []
    
    email_ids = messages[0].split()[-limit:] if messages[0] else []
    emails = []
    
    for eid in reversed(email_ids):
        status, msg_data = mail.fetch(eid, '(RFC822)')
        if status != 'OK':
            continue
        
        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])
                
                subject = decode_mime_header(msg.get('Subject', ''))
                sender = decode_mime_header(msg.get('From', ''))
                to = decode_mime_header(msg.get('To', ''))
                date_str = msg.get('Date', '')
                
                try:
                    date = parsedate_to_datetime(date_str) if date_str else datetime.now(timezone.utc)
                except:
                    date = datetime.now(timezone.utc)
                
                body = ''
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == 'text/plain':
                            try:
                                body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                break
                            except:
                                pass
                else:
                    try:
                        body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
                    except:
                        pass
                
                emails.append({
                    'id': eid.decode() if isinstance(eid, bytes) else str(eid),
                    'subject': subject,
                    'sender': sender,
                    'to': to,
                    'date': date.isoformat(),
                    'body': body[:5000]  # Limit body size
                })
    
    return emails
