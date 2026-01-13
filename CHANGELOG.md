# Changelog

All notable changes to Sigma HQ will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Pending
- Backend refactoring: Split main.py into modules (in progress)
- New 10-folder project structure implementation

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

## Development Guidelines

### Before Making Changes
1. Review TESTING_CHECKLIST.md
2. Create feature branch if change is significant
3. Test locally before pushing to main
4. Document any database schema changes here

### After Deployment
1. Verify all checklist items pass
2. Update this changelog
3. Monitor for errors in Cloud Run logs
