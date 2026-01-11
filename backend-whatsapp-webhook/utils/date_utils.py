# Date Utilities - Deadline extraction and date parsing

import re
from datetime import datetime, timezone, timedelta


def extract_deadline(text):
    """Extract deadline from message text.
    
    Supports:
    - today, tomorrow (English and Arabic)
    - Day names (Sunday, Monday, etc.)
    - Date formats: DD/MM, DD-MM-YYYY, etc.
    """
    lower = text.lower()
    today = datetime.now(timezone.utc)
    
    # Today
    if 'today' in lower or 'اليوم' in lower:
        return today.strftime('%Y-%m-%d')
    
    # Tomorrow
    if 'tomorrow' in lower or 'بكره' in lower or 'غدا' in lower:
        return (today + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Day names (English and Arabic)
    days = {
        'sunday': 6, 'monday': 0, 'tuesday': 1, 'wednesday': 2, 
        'thursday': 3, 'friday': 4, 'saturday': 5,
        'الأحد': 6, 'الاثنين': 0, 'الثلاثاء': 1, 'الأربعاء': 2, 
        'الخميس': 3, 'الجمعة': 4, 'السبت': 5
    }
    
    for day, num in days.items():
        if day in lower:
            days_ahead = num - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return (today + timedelta(days=days_ahead)).strftime('%Y-%m-%d')
    
    # Date patterns: DD/MM or DD-MM-YYYY
    date_match = re.search(r'(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?', text)
    if date_match:
        day = int(date_match.group(1))
        month = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else today.year
        if year < 100:
            year += 2000
        try:
            return f"{year}-{month:02d}-{day:02d}"
        except:
            pass
    
    return None


def extract_assignee(text):
    """Extract assigned person from message.
    
    Supports:
    - @mentions
    - "to/for/assign to Name" patterns
    """
    # Check for @mention
    mention = re.search(r'@(\w+)', text)
    if mention:
        return mention.group(1)
    
    # Check for assignment patterns
    assign_match = re.search(r'(?:to|for|assign(?:ed)?(?:\s+to)?)\s+([A-Z][a-z]+)', text)
    if assign_match:
        return assign_match.group(1)
    
    return None


def format_relative_time(timestamp_str):
    """Format timestamp as relative time (e.g., '2 hours ago')"""
    try:
        if isinstance(timestamp_str, str):
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        else:
            dt = timestamp_str
        
        now = datetime.now(timezone.utc)
        diff = now - dt
        
        if diff.days > 7:
            return dt.strftime('%b %d')
        elif diff.days > 0:
            return f"{diff.days}d ago"
        elif diff.seconds > 3600:
            return f"{diff.seconds // 3600}h ago"
        elif diff.seconds > 60:
            return f"{diff.seconds // 60}m ago"
        else:
            return "just now"
    except:
        return ""


def get_today_start():
    """Get ISO timestamp for start of today (UTC)"""
    return datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()


def get_yesterday_start():
    """Get ISO timestamp for start of yesterday (UTC)"""
    return (datetime.now(timezone.utc) - timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()


def is_overdue(deadline_str):
    """Check if a deadline has passed"""
    if not deadline_str:
        return False
    
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    return deadline_str < today
