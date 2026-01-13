# Pre-Deployment Testing Checklist

**IMPORTANT:** Run through this checklist before pushing ANY changes to main branch.

---

## Quick Verification (Every Push)

### Dashboard Access
- [ ] Password gate shows and accepts correct password
- [ ] Dashboard loads after authentication
- [ ] Sidebar navigation works (Overview, Settings, OrgChart)

### Projects
- [ ] Project list displays correctly
- [ ] Can select a project and view tabs (Home, AI Intel, Vault, Actions, Settings)
- [ ] Project status badges show correctly

---

## Feature-Specific Checklists

### WhatsApp Integration
- [ ] **Scan All Groups** button works
- [ ] Scanned groups appear in "Groups Found" section
- [ ] **NO DUPLICATE GROUPS** after scanning (critical!)
- [ ] Can add a group from "Groups Found"
- [ ] Can assign project to a group
- [ ] Can change group type (Client, Internal, Command, etc.)
- [ ] Can delete a group
- [ ] Live Message Stream shows recent messages
- [ ] Messages correctly map to assigned projects

### Email Integration
- [ ] Email tab loads
- [ ] "Sync New Emails" button works
- [ ] Unclassified emails display
- [ ] Can assign project to an email
- [ ] Can classify an email (moves to correct folder)

### OrgChart
- [ ] OrgChart page loads
- [ ] Can select department filter
- [ ] Can select office filter
- [ ] Chart renders with correct hierarchy
- [ ] **Colors are correct:**
  - Technical Office Head: Black (#000000)
  - Team Leader: Dark Blue (#1e3a8a)
  - Senior TOE: Medium Blue (#2563eb)
  - TOE: Light Blue (#60a5fa)
  - Junior TOE: Dark Green (#166534)
  - Trainee: Darker Green (#15803d)
- [ ] Export button works
- [ ] Exported PNG has correct colors and layout
- [ ] Sigma logo appears in bottom-right (no border)

### Vault (Document Browser)
- [ ] Vault tab loads for selected project
- [ ] Folders display correctly
- [ ] Can navigate into folders
- [ ] Files display with correct icons
- [ ] Can open/download files

### AI Intel (Search)
- [ ] Search tab loads
- [ ] Can enter a query
- [ ] Results return from Vertex AI
- [ ] Source documents are cited

---

## Database Schema Changes

If your change modifies Firestore document structure:

### Before Deploying
- [ ] Document the old schema
- [ ] Document the new schema
- [ ] Write migration script if needed
- [ ] Test migration on a single document first

### Collections to Check
- `artifacts/sigma-hq-production/public/data/projects`
- `artifacts/sigma-hq-production/public/data/whatsapp_groups`
- `artifacts/sigma-hq-production/public/data/whatsapp_messages`

### Field Changes Checklist
- [ ] New fields have default values for existing documents
- [ ] Code handles both old and new field names (backwards compatibility)
- [ ] Queries still work with existing data

---

## Backend Changes

If modifying Python backends:

### Main Backend (sync-worker)
- [ ] `/sync` endpoint works
- [ ] `/search` endpoint works
- [ ] `/unclassified` endpoint works
- [ ] `/classify` endpoint works

### Email Backend
- [ ] `/email-sync` endpoint works
- [ ] IMAP connection succeeds
- [ ] Emails are classified correctly

### WhatsApp Webhook Backend
- [ ] `/webhook` receives messages
- [ ] `/waha/groups` returns group list
- [ ] `/waha/groups/create` creates new group
- [ ] Messages are stored in Firestore
- [ ] Project mapping is applied correctly

---

## Regression Tests

After ANY change, verify these critical flows:

1. **New User Flow**
   - [ ] Enter password → See overview → Create project → Sync files

2. **WhatsApp Flow**
   - [ ] Scan groups → Add group → Assign project → Receive message → See in project

3. **Email Flow**
   - [ ] Sync emails → See unclassified → Assign project → Classify

4. **OrgChart Flow**
   - [ ] Open OrgChart → Filter → Export PNG → Verify colors

---

## Rollback Plan

If something breaks after deployment:

1. **Frontend (Vercel):** Redeploy previous commit from Vercel dashboard
2. **Backend (Cloud Run):** Redeploy previous image from Cloud Console
3. **Database:** Restore from Firestore backup (if available)

### Quick Rollback Commands
```bash
# Revert last commit locally
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-sha>
git push origin main --force  # Use with caution!
```

---

## Sign-Off

Before pushing to main:

- [ ] I have tested all affected features
- [ ] I have checked for regressions in unrelated features
- [ ] I have updated CHANGELOG.md
- [ ] I have documented any database migrations needed

**Tested by:** _______________  
**Date:** _______________  
**Commit:** _______________
