# Services package - Core business logic and external integrations

from services.firestore_ops import (
    get_cached_group_name,
    get_group_mappings,
    auto_add_group,
    get_registered_projects,
    get_project_stats,
    get_project_pending_items,
    get_project_recent_activity,
    get_all_pending_items,
    get_urgent_items,
    get_today_items,
    get_overdue_items,
    mark_item_done,
    assign_item,
    set_item_urgency,
    save_search_results,
    get_last_search_results,
    save_short_url,
    get_short_url_data,
    save_message
)

from services.waha_api import (
    get_group_name_from_waha,
    check_waha_session,
    send_whatsapp_message,
    send_whatsapp_file_direct
)

from services.vertex_search import search_documents

from services.file_delivery import (
    generate_signed_url,
    create_short_url,
    get_short_url_redirect,
    send_whatsapp_file
)

__all__ = [
    # Firestore
    'get_cached_group_name', 'get_group_mappings', 'auto_add_group',
    'get_registered_projects', 'get_project_stats', 'get_project_pending_items',
    'get_project_recent_activity', 'get_all_pending_items', 'get_urgent_items',
    'get_today_items', 'get_overdue_items', 'mark_item_done', 'assign_item',
    'set_item_urgency', 'save_search_results', 'get_last_search_results',
    'save_short_url', 'get_short_url_data', 'save_message',
    # WAHA
    'get_group_name_from_waha', 'check_waha_session', 'send_whatsapp_message',
    'send_whatsapp_file_direct',
    # Vertex Search
    'search_documents',
    # File Delivery
    'generate_signed_url', 'create_short_url', 'get_short_url_redirect',
    'send_whatsapp_file'
]
