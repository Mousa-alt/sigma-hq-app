# Handlers package - WhatsApp message and command handling

from handlers.commands import handle_command, match_project, generate_daily_digest
from handlers.classifier import classify_message, fallback_classify, extract_deadline, extract_assignee

__all__ = [
    'handle_command',
    'match_project', 
    'generate_daily_digest',
    'classify_message',
    'fallback_classify',
    'extract_deadline',
    'extract_assignee'
]
