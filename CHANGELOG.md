# Changelog

All notable changes to Sigma HQ will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Pending
- New 10-folder project structure implementation

---

## [2.1.1] - 2026-01-13

### Fixed
- **CRITICAL:** Vault showing 0 documents - backend modularization broke `/files`, `/folders`, `/latest` endpoints
  - Root cause: Routes were changed to GET-only but frontend sends POST requests
  - Fix: Backend now accepts both GET and POST methods
  - Added support for both `project`/`projectName` and `path`/`folderPath` parameter names

### Added
- Smoke test script (`tests/smoke_test.py`) to catch breaking changes before deployment
- Admin endpoints for WhatsApp group maintenance:
  - `POST /admin/cleanup-groups` - Remove duplicate groups
  - `POST /admin/sync-group-ids` - Sync group_id and wahaId fields

### Lessons Learned
- Backend refactoring MUST be tested with frontend before deployment
- Parameter names must be consistent between frontend and backend
- Need automated integration tests, not just documentation

---

## [2.1.0] - 2026-01-13

### Fixed
- **CRITICAL:** WhatsApp group deduplication - groups were being duplicated on scan due to field name mismatch (`group_id` vs `wahaId`)
- OrgChart color palette - applied exact user-specified colors (black head, blue TOEs, green juniors)
- OrgChart logo watermark - removed frame/border around Sigma logo

### Changed
- WhatsApp group matching now checks both `wahaId` and `group_id` fields for backwards compatibility
- Added normalization functions for consistent group name comparison

### Database Migrations Required
- Existing `whatsapp_groups` documents need both `wahaId` and `group_id` fields populated

---

## [2.0.0] - 2026-01-12

### Added
- Password gate protection for dashboard access
- OrgChart component with SVG export using save-svg-as-png
- Venue field for projects
- Project status tracking

### Fixed
- WhatsApp message routing - now uses Group→Project Mapping as single source of truth
- OrgChart export reliability with pure SVG rendering

### Changed
- WhatsApp backend: Group name matching only (removed regex patterns for project extraction)

---

## [1.9.0] - 2026-01-11

### Added
- Backend modularization started
  - `main.py` reduced from 2000+ lines to 1,216 lines
  - `email_handler.py` created (545 lines)
  - `document_classifier.py` created
  - `project_utils.py` created

### Changed
- Cloud Build auto-deployment for all 3 backends (main, email, whatsapp-webhook)

---

## [1.8.0] - 2026-01-10

### Added
- Email sync backend with IMAP integration
- Unclassified emails UI in Channel Settings
- Email classification workflow

---

## [1.7.0] - 2026-01-09

### Added
- WhatsApp webhook backend for message processing
- Command Group feature for task creation via WhatsApp
- Live message stream in Channel Settings

---

## [Previous Versions]

### Core Features (Pre-January 2026)
- Project management with Google Drive sync
- Vertex AI document search (RAG)
- GCS Vault for file browsing
- Real-time Firestore database
- React frontend with Tailwind CSS
- Vercel deployment for dashboard
- Cloud Run deployment for backends

---

## Migration Notes

### v2.0.0 → v2.1.0
**WhatsApp Groups Field Update:**
If you have existing groups that were created before this update, run this Firestore update:
```javascript
// For each document in whatsapp_groups collection:
// If wahaId exists but group_id doesn't: set group_id = wahaId
// If group_id exists but wahaId doesn't: set wahaId = group_id
```

---

## Known Issues Log

### Pattern: Backend changes break frontend
- **2026-01-13:** Backend modularization changed `/files` to GET-only, but frontend sends POST
- **Prevention:** Always test frontend after backend changes. Run `python tests/smoke_test.py`

### Pattern: Field name mismatches
- **2026-01-13:** `group_id` vs `wahaId` caused duplicate WhatsApp groups
- **Prevention:** Document all field names. Check both frontend and backend use same names.

---

## Development Guidelines

### Before Making Changes
1. Run `python tests/smoke_test.py` to verify current state
2. Review TESTING_CHECKLIST.md
3. Create feature branch if change is significant
4. Test locally before pushing to main
5. Document any database schema changes here

### After Deployment
1. Run `python tests/smoke_test.py` again to verify deployment
2. Verify all checklist items pass manually
3. Update this changelog
4. Monitor for errors in Cloud Run logs
