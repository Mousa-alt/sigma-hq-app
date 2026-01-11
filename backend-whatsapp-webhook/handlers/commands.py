# Command Handler - All WhatsApp command processing

import re
from datetime import datetime, timezone, timedelta

from services.waha_api import send_whatsapp_message
from services.firestore_ops import (
    get_project_stats, get_project_pending_items, get_project_recent_activity,
    get_all_pending_items, get_urgent_items, get_today_items, get_overdue_items,
    mark_item_done, assign_item, set_item_urgency,
    save_search_results, get_last_search_results
)
from services.vertex_search import search_documents
from services.file_delivery import send_whatsapp_file
from utils.revision_parser import extract_revision_score


def match_project(hint, projects):
    """Fuzzy match project name from hint"""
    hint_lower = hint.lower().strip()
    for p in projects:
        if hint_lower == p['name'].lower():
            return p
        if hint_lower in p['name'].lower():
            return p
        for kw in p.get('keywords', []):
            if hint_lower in kw.lower():
                return p
    return None


def generate_daily_digest():
    """Generate daily digest message"""
    overdue = get_overdue_items()
    urgent = get_urgent_items()
    today = get_today_items()
    pending = get_all_pending_items(limit=50)
    
    yesterday_start = (datetime.now(timezone.utc) - timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    yesterday_end = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    
    new_yesterday = [p for p in pending if yesterday_start <= p.get('created', '') < yesterday_end]
    
    date_str = datetime.now(timezone.utc).strftime('%b %d')
    
    digest = f"☀️ *Good Morning - {date_str}*\n"
    
    if overdue:
        digest += f"\n🔴 *Overdue ({len(overdue)}):*\n"
        for item in overdue[:5]:
            digest += f"• {item['project']}: {item['summary'][:30]}\n"
    
    if urgent:
        digest += f"\n⚠️ *Urgent ({len(urgent)}):*\n"
        for item in urgent[:5]:
            digest += f"• {item['project']}: {item['summary'][:30]}\n"
    
    if today:
        digest += f"\n📅 *New Today ({len(today)}):*\n"
        for item in today[:5]:
            digest += f"• {item['project']}: {item['summary'][:30]}\n"
    
    digest += f"\n📊 *Summary:*\n"
    digest += f"• Total Pending: {len(pending)}\n"
    digest += f"• New Yesterday: {len(new_yesterday)}\n"
    
    digest += "\n_Type `u` for urgent, `p` for pending_"
    
    return digest


def handle_command(message_text, sender, projects, chat_id):
    """Handle Command Group messages with smart responses
    
    Args:
        message_text: The command text
        sender: Sender identifier
        projects: List of registered projects
        chat_id: Chat ID to send response to
    
    Returns:
        dict: Classification result
    """
    text = message_text.strip()
    lower_text = text.lower()
    
    response_message = None
    classification = {
        'project_name': None,
        'is_actionable': False,
        'action_type': 'query',
        'summary': '',
        'urgency': 'low',
        'is_command': True,
        'command_type': None,
        'channel_type': 'command'
    }
    
    # =========================================================================
    # SHORTCUTS - Single letter commands
    # =========================================================================
    if lower_text == 's':
        lower_text = 'summary'
    elif lower_text == 'u':
        lower_text = 'urgent'
    elif lower_text == 'p':
        lower_text = 'pending'
    elif lower_text == 't':
        lower_text = 'today'
    elif lower_text == 'h':
        lower_text = 'help'
    elif lower_text == 'd':
        lower_text = 'digest'
    
    # l project = list project
    shortcut_list = re.match(r'^l\s+(.+)$', lower_text)
    if shortcut_list:
        lower_text = f"list {shortcut_list.group(1)}"
    
    # a project = activity project
    shortcut_activity = re.match(r'^a\s+(.+)$', lower_text)
    if shortcut_activity:
        lower_text = f"activity {shortcut_activity.group(1)}"
    
    # f query = find query
    shortcut_find = re.match(r'^f\s+(.+)$', lower_text)
    if shortcut_find:
        lower_text = f"find {shortcut_find.group(1)}"
    
    # g N = get file N from last search
    shortcut_get = re.match(r'^g\s+(\d+)$', lower_text)
    if shortcut_get:
        lower_text = f"get {shortcut_get.group(1)}"
    
    # =========================================================================
    # GET FILE - Download file from last search
    # =========================================================================
    get_match = re.match(r'^get\s+(\d+)$', lower_text)
    if get_match:
        file_num = int(get_match.group(1))
        
        # Get last search results for this chat
        results = get_last_search_results(chat_id)
        
        if not results:
            response_message = "❌ No recent search results.\n\nUse `f keyword` to search first."
        elif file_num < 1 or file_num > len(results):
            response_message = f"❌ Invalid number. Enter 1-{len(results)}"
        else:
            doc = results[file_num - 1]
            gcs_path = doc.get('gcs_path', '')
            filename = doc.get('name', 'document')
            
            if not gcs_path:
                response_message = "❌ File path not available."
            else:
                # Send file (will send view link in free mode)
                success, msg = send_whatsapp_file(chat_id, gcs_path, filename)
                
                if success:
                    response_message = None  # Message already sent
                else:
                    response_message = f"❌ Could not get file: {msg}"
        
        classification['command_type'] = 'get_file'
        classification['summary'] = f"Get file #{file_num}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # DOCUMENT SEARCH - find: query or find query
    # =========================================================================
    find_match = re.match(r'^(?:find|search|doc|docs)[:\s]+(.+)$', lower_text, re.IGNORECASE)
    if find_match:
        search_query = find_match.group(1).strip()
        
        # Check if project is specified
        project_name = None
        for p in projects:
            if p['name'].lower() in search_query.lower():
                project_name = p['name']
                # Remove project name from search
                search_query = re.sub(re.escape(p['name']), '', search_query, flags=re.IGNORECASE).strip()
                break
        
        results = search_documents(search_query, project_name, limit=5)
        
        # Save results for `get` command
        if results:
            save_search_results(chat_id, results)
        
        if results:
            lines = [f"📄 *Found {len(results)} documents* _(latest first)_\n"]
            for i, doc in enumerate(results, 1):
                name = doc['name'][:40] if doc['name'] else 'Unnamed'
                folder = doc['path'] if doc['path'] else ''
                
                # Show revision indicator if detected
                rev_score = extract_revision_score(doc['name'])
                rev_indicator = ""
                if rev_score > 0:
                    rev_match = re.search(r'(REV[_\s\-\.]*\d+|REV[_\s\-\.]*[A-Z]|V\d+|R\d+)', doc['name'].upper())
                    if rev_match:
                        rev_indicator = f" 🔄{rev_match.group(1)}"
                
                lines.append(f"{i}. *{name}*{rev_indicator}")
                if folder:
                    lines.append(f"   📁 {folder}")
            
            lines.append(f"\n_Type `g 1` to view file_")
            response_message = "\n".join(lines)
        else:
            response_message = f"""📄 *Search: {search_query}*

🔍 No documents found.

Try:
• Different keywords
• Check spelling
• Broader search terms"""
        
        classification['command_type'] = 'find'
        classification['summary'] = f"Search: {search_query}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # DONE - Mark item as complete
    # =========================================================================
    done_match = re.match(r'^done\s+(?:(\S+)\s+)?(\d+)$', lower_text)
    if done_match:
        project_hint = done_match.group(1)
        item_num = int(done_match.group(2))
        
        project_name = None
        if project_hint:
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
        
        success, msg = mark_item_done(project_name, item_num)
        
        if success:
            response_message = f"✅ *Done!* Item #{item_num} marked complete"
        else:
            response_message = f"❌ Error: {msg}"
        
        classification['command_type'] = 'done'
        classification['summary'] = f"Marked item {item_num} done"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # ASSIGN - Assign item to someone
    # =========================================================================
    assign_match = re.match(r'^assign\s+(?:(\S+)\s+)?(\d+)\s+(?:to\s+)?(.+)$', lower_text)
    if assign_match:
        project_hint = assign_match.group(1)
        item_num = int(assign_match.group(2))
        assignee = assign_match.group(3).strip()
        
        project_name = None
        if project_hint:
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
        
        success, msg = assign_item(project_name, item_num, assignee)
        
        if success:
            response_message = f"👤 *Assigned!* Item #{item_num} → {assignee}"
        else:
            response_message = f"❌ Error: {msg}"
        
        classification['command_type'] = 'assign'
        classification['summary'] = f"Assigned item {item_num} to {assignee}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # ESCALATE - Set to high urgency
    # =========================================================================
    escalate_match = re.match(r'^(escalate|high)\s+(?:(\S+)\s+)?(\d+)$', lower_text)
    if escalate_match:
        project_hint = escalate_match.group(2)
        item_num = int(escalate_match.group(3))
        
        project_name = None
        if project_hint:
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
        
        success, msg = set_item_urgency(project_name, item_num, 'high')
        
        if success:
            response_message = f"🔴 *Escalated!* Item #{item_num} is now HIGH priority"
        else:
            response_message = f"❌ Error: {msg}"
        
        classification['command_type'] = 'escalate'
        classification['summary'] = f"Escalated item {item_num}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # DEFER - Set to low urgency
    # =========================================================================
    defer_match = re.match(r'^(defer|low)\s+(?:(\S+)\s+)?(\d+)$', lower_text)
    if defer_match:
        project_hint = defer_match.group(2)
        item_num = int(defer_match.group(3))
        
        project_name = None
        if project_hint:
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
        
        success, msg = set_item_urgency(project_name, item_num, 'low')
        
        if success:
            response_message = f"⚪ *Deferred!* Item #{item_num} is now LOW priority"
        else:
            response_message = f"❌ Error: {msg}"
        
        classification['command_type'] = 'defer'
        classification['summary'] = f"Deferred item {item_num}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # DIGEST - Daily digest
    # =========================================================================
    if lower_text in ['digest', 'morning', 'daily']:
        response_message = generate_daily_digest()
        classification['command_type'] = 'digest'
        classification['summary'] = "Daily digest requested"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # LIST PROJECT ITEMS
    # =========================================================================
    list_match = re.match(r'^list\s+(.+)$', lower_text, re.IGNORECASE)
    if list_match:
        project_hint = list_match.group(1).strip()
        matched = match_project(project_hint, projects)
        
        if matched:
            items = get_project_pending_items(matched['name'], limit=15)
            
            if items:
                lines = [f"📋 *{matched['name']}* - Pending ({len(items)})\n"]
                for i, item in enumerate(items, 1):
                    urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                    assigned = f" → {item['assigned_to']}" if item.get('assigned_to') else ""
                    lines.append(f"{i}. {urgency_icon} {item['summary'][:40]}{assigned}")
                lines.append(f"\n_`done {matched['name'][:5]} 1` to complete_")
                response_message = "\n".join(lines)
            else:
                response_message = f"📋 *{matched['name']}*\n\n✨ No pending items!"
        else:
            response_message = f"❓ Project '{project_hint}' not found."
        
        classification['command_type'] = 'list_project'
        classification['project_name'] = matched['name'] if matched else None
        classification['summary'] = f"List items for {project_hint}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # ACTIVITY
    # =========================================================================
    activity_match = re.match(r'^activity\s+(.+)$', lower_text, re.IGNORECASE)
    if activity_match:
        project_hint = activity_match.group(1).strip()
        matched = match_project(project_hint, projects)
        
        if matched:
            items = get_project_recent_activity(matched['name'], limit=10)
            
            if items:
                lines = [f"📊 *{matched['name']}* - Last 24h ({len(items)})\n"]
                for item in items:
                    action_icon = "⚡" if item['actionable'] else "💬"
                    lines.append(f"{action_icon} {item['sender'][:12]}: {item['summary'][:30]}")
                response_message = "\n".join(lines)
            else:
                response_message = f"📊 *{matched['name']}*\n\n🔇 No activity in 24h"
        else:
            response_message = f"❓ Project '{project_hint}' not found."
        
        classification['command_type'] = 'activity'
        classification['project_name'] = matched['name'] if matched else None
        classification['summary'] = f"Activity for {project_hint}"
        
        if response_message and chat_id:
            send_whatsapp_message(chat_id, response_message)
        return classification
    
    # =========================================================================
    # QUICK STATUS - Just project name
    # =========================================================================
    matched_project = match_project(lower_text, projects)
    
    if matched_project and len(lower_text.split()) <= 3:
        stats = get_project_stats(matched_project['name'])
        
        status_emoji = "🟢" if stats['pending_tasks'] == 0 else "🟡" if stats['pending_tasks'] < 5 else "🔴"
        
        response_message = f"""📊 *{matched_project['name']}* {status_emoji}

📍 {matched_project.get('venue') or matched_project.get('location', 'N/A')} | 👤 {matched_project.get('client', 'N/A')}

📋 Pending: {stats['pending_tasks']} | 🔴 Urgent: {stats['high_urgency']}
💬 Messages (24h): {stats['recent_messages']}

_`l {matched_project['name'][:6]}` for items | `f {matched_project['name'][:6]} drawing` to search docs_"""
        
        classification['command_type'] = 'project_status'
        classification['project_name'] = matched_project['name']
        classification['summary'] = f"Status for {matched_project['name']}"
    
    # =========================================================================
    # TODAY
    # =========================================================================
    elif lower_text in ['today', 'اليوم', "what's today", 'whats today']:
        items = get_today_items()
        
        if items:
            lines = [f"📅 *Today* ({len(items)})\n"]
            for i, item in enumerate(items[:10], 1):
                urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                status_icon = "✅" if item['status'] == 'done' else "⏳"
                lines.append(f"{i}. {urgency_icon}{status_icon} *{item['project']}*: {item['summary'][:35]}")
            response_message = "\n".join(lines)
        else:
            response_message = "📅 *Today*\n\n✨ No actionable items today!"
        
        classification['command_type'] = 'today'
        classification['summary'] = "Today's items"
    
    # =========================================================================
    # URGENT
    # =========================================================================
    elif lower_text in ['urgent', 'عاجل', 'high priority', 'critical']:
        items = get_urgent_items()
        
        if items:
            lines = [f"🔴 *Urgent* ({len(items)})\n"]
            for i, item in enumerate(items[:10], 1):
                lines.append(f"{i}. *{item['project']}*: {item['summary'][:35]}")
            lines.append(f"\n_`done 1` to complete_")
            response_message = "\n".join(lines)
        else:
            response_message = "🔴 *Urgent*\n\n✨ No urgent items!"
        
        classification['command_type'] = 'urgent'
        classification['summary'] = "Urgent items"
    
    # =========================================================================
    # PENDING
    # =========================================================================
    elif lower_text in ['pending', 'معلق', 'open', 'tasks', 'مهام']:
        items = get_all_pending_items()
        
        if items:
            by_project = {}
            for item in items:
                proj = item['project'] or 'Unassigned'
                if proj not in by_project:
                    by_project[proj] = []
                by_project[proj].append(item)
            
            lines = [f"📋 *Pending* ({len(items)})\n"]
            for proj, proj_items in list(by_project.items())[:5]:
                lines.append(f"\n*{proj}* ({len(proj_items)})")
                for item in proj_items[:3]:
                    urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                    lines.append(f"  {urgency_icon} {item['summary'][:30]}")
            
            lines.append(f"\n_`l ProjectName` for full list_")
            response_message = "\n".join(lines)
        else:
            response_message = "📋 *Pending*\n\n✨ All clear!"
        
        classification['command_type'] = 'pending'
        classification['summary'] = "Pending items"
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    elif lower_text in ['summary', 'summarize', 'ملخص', 'report']:
        pending = get_all_pending_items()
        urgent = get_urgent_items()
        today = get_today_items()
        
        response_message = f"""📊 *Summary*
        
🔴 Urgent: {len(urgent)}
📋 Pending: {len(pending)}
📅 Today: {len(today)}

Top Items:"""
        
        for item in urgent[:3]:
            response_message += f"\n• *{item['project']}*: {item['summary'][:25]}"
        
        if not urgent:
            response_message += "\n✨ No urgent items!"
        
        classification['command_type'] = 'summary'
        classification['summary'] = "Summary"
    
    # =========================================================================
    # HELP
    # =========================================================================
    elif lower_text in ['help', 'مساعدة', 'commands', '?']:
        response_message = """🤖 *Commands*

*Quick:*
`s` summary | `u` urgent | `p` pending
`t` today | `d` digest | `h` help

*Projects:*
`Agora` - status
`l agora` - list items
`a agora` - activity

*Documents:*
`f agora floor drawing` - search
`find: shop drawing` - search all
`g 1` - view file #1

*Actions:*
`done 1` - complete #1
`done agora 1` - complete Agora #1
`assign 1 to Ahmed` - assign
`escalate 1` - make urgent
`defer 1` - make low priority

*Create:*
`task: Agora - Description`
`note: Agora - Info`"""
        
        classification['command_type'] = 'help'
        classification['summary'] = "Help"
    
    # =========================================================================
    # TASK CREATION
    # =========================================================================
    elif lower_text.startswith('task:'):
        task_match = re.match(r'task:\s*(.+?)\s*-\s*(.+)', text, re.IGNORECASE)
        if task_match:
            project_hint = task_match.group(1).strip()
            task_desc = task_match.group(2).strip()
            
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
            
            classification['project_name'] = project_name
            classification['is_actionable'] = True
            classification['action_type'] = 'task'
            classification['summary'] = task_desc
            classification['urgency'] = 'medium'
            classification['command_type'] = 'create_task'
            
            response_message = f"✅ *Task Created*\n\n📁 {project_name or 'Unassigned'}\n📝 {task_desc}"
    
    # =========================================================================
    # NOTE
    # =========================================================================
    elif lower_text.startswith('note:'):
        note_match = re.match(r'note:\s*(.+?)\s*-\s*(.+)', text, re.IGNORECASE)
        if note_match:
            project_hint = note_match.group(1).strip()
            note_text = note_match.group(2).strip()
            
            matched = match_project(project_hint, projects)
            project_name = matched['name'] if matched else None
            
            classification['project_name'] = project_name
            classification['is_actionable'] = False
            classification['action_type'] = 'note'
            classification['summary'] = note_text
            classification['command_type'] = 'create_note'
            
            response_message = f"📝 *Note Logged*\n\n📁 {project_name or 'General'}\n💬 {note_text}"
    
    # =========================================================================
    # STATUS QUERY
    # =========================================================================
    elif re.search(r"(what'?s?|show|get)\s+(pending|status|open|items)\s+(on|for|in)\s+(.+)", lower_text):
        query_match = re.search(r"(what'?s?|show|get)\s+(pending|status|open|items)\s+(on|for|in)\s+(.+)", lower_text)
        if query_match:
            project_hint = query_match.group(4).strip().rstrip('?')
            matched = match_project(project_hint, projects)
            
            if matched:
                items = get_project_pending_items(matched['name'], limit=10)
                
                if items:
                    lines = [f"📋 *{matched['name']}* ({len(items)})\n"]
                    for i, item in enumerate(items, 1):
                        urgency_icon = "🔴" if item['urgency'] == 'high' else "🟡" if item['urgency'] == 'medium' else "⚪"
                        lines.append(f"{i}. {urgency_icon} {item['summary'][:35]}")
                    lines.append(f"\n_`done {matched['name'][:5]} 1` to complete_")
                    response_message = "\n".join(lines)
                else:
                    response_message = f"📋 *{matched['name']}*\n\n✨ No pending items!"
            else:
                response_message = f"❓ '{project_hint}' not found."
            
            classification['command_type'] = 'query_status'
            classification['project_name'] = matched['name'] if matched else None
            classification['summary'] = f"Query for {project_hint}"
    
    # =========================================================================
    # FALLBACK
    # =========================================================================
    else:
        classification['is_command'] = False
        classification['action_type'] = 'info'
        classification['summary'] = text[:100]
    
    if response_message and chat_id:
        send_whatsapp_message(chat_id, response_message)
    
    return classification
