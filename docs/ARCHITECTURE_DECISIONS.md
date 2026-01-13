# Architecture Decisions Record

This document records WHY certain technical decisions were made for Sigma HQ.
**Claude MUST read this before making any architectural changes.**

---

## Core Architecture

### Decision: Modular Backend Structure
**Date:** January 2026  
**Status:** Implemented

**Context:** Original main.py was 2000+ lines, making it hard to maintain.

**Decision:** Split into:
```
backend/
├── main.py          # Entry point only
├── config.py        # All configuration
├── clients.py       # GCS, Firestore, Drive clients (singleton)
├── routes.py        # HTTP route handlers
├── services/        # Business logic
└── utils/           # Helper functions
```

**Consequences:**
- ✅ Easier to maintain and test
- ✅ Can modify one service without affecting others
- ⚠️ MUST ensure routes.py accepts both GET and POST for frontend compatibility

---

### Decision: Frontend Sends POST for Data Endpoints
**Date:** January 2026  
**Status:** CRITICAL - DO NOT CHANGE

**Context:** Vault.jsx, FolderPopup.jsx send POST requests with JSON body to `/files`, `/folders`, `/latest`.

**Decision:** Backend MUST accept POST method with JSON body containing:
- `projectName` or `project`
- `folderPath` or `path`

**Why Not GET?** Project names have spaces and special characters. Encoding in URL query params is error-prone.

**Consequences:**
- ⚠️ If backend is changed to GET-only, Vault will show 0 documents
- ⚠️ This caused a production outage on 2026-01-13

---

### Decision: Dual Field Names for WhatsApp Groups
**Date:** January 2026  
**Status:** Implemented (legacy support)

**Context:** Field was renamed from `group_id` to `wahaId` but existing records weren't migrated.

**Decision:** Support BOTH field names:
- Backend checks `wahaId` first, falls back to `group_id`
- When saving, populate BOTH fields

**Consequences:**
- ✅ Backwards compatible with old data
- ⚠️ New code should prefer `wahaId`

---

### Decision: GCS Folder Name Mapping
**Date:** January 2026  
**Status:** Implemented

**Context:** Project names in Firestore don't always match GCS bucket folder names.

**Decision:** Projects can have a `gcsFolderName` field that overrides `name` for GCS lookups.

**Mapping Examples:**
| Project Name | GCS Folder |
|-------------|-----------|
| Amin Fattouh | Amin_Fattouh |
| Agora | Agora-GEM |
| Ecolab | CFC-Ecolab |

**Consequences:**
- ✅ Flexible naming
- ⚠️ If gcsFolderName is wrong, Vault shows no documents

---

## Frontend Architecture

### Decision: D3-Hierarchy for OrgChart
**Date:** January 2026  
**Status:** Implemented

**Context:** Need hierarchical org chart with export to PNG.

**Decision:** Use d3-hierarchy for layout, pure SVG for rendering, save-svg-as-png for export.

**Consequences:**
- ✅ Professional tree layout
- ✅ Clean PNG export
- ⚠️ Must guard against circular references (A reports to B, B reports to A)

---

### Decision: Firestore Real-time Listeners
**Date:** 2025  
**Status:** Core architecture

**Context:** Need real-time updates across Cairo/Riyadh offices.

**Decision:** Use Firestore `onSnapshot` listeners in React components.

**Document Structure:**
```
artifacts/
└── sigma-hq-production/
    └── public/
        └── data/
            ├── projects/
            ├── whatsapp_groups/
            ├── tasks/
            └── team/
```

**Consequences:**
- ✅ Real-time sync
- ⚠️ Can create high read costs if not paginated

---

## Deployment Architecture

### Decision: Three Separate Backends
**Date:** January 2026  
**Status:** Implemented

**Services:**
1. `sigma-sync-worker` - GCS operations, file sync, search
2. `sigma-whatsapp` - WhatsApp webhook, WAHA integration
3. `sigma-email-sync` - Email classification

**Why Separate?**
- Different scaling needs
- WhatsApp needs always-on webhook
- Email sync runs periodically

**Consequences:**
- ✅ Independent scaling and deployment
- ⚠️ Must maintain consistent data contracts between services

---

## Rules for AI (Claude)

1. **NEVER change HTTP methods** without updating frontend
2. **NEVER rename Firestore fields** without migration script
3. **ALWAYS test Vault after backend changes**
4. **ALWAYS update this document** when making architectural changes
5. **RUN tests** before considering any deployment complete

---

## Incidents Log

### 2026-01-13: Vault Showing 0 Documents
**Cause:** Backend refactored to GET-only, frontend sends POST  
**Fix:** Backend now accepts both GET and POST  
**Prevention:** Added E2E tests, documented in this file

### 2026-01-13: Duplicate WhatsApp Groups
**Cause:** Field renamed from group_id to wahaId, existing data not migrated  
**Fix:** Check both fields, populate both when saving  
**Prevention:** Added to this document, created admin cleanup endpoint
