# Sigma HQ - Project Status

**Last Updated:** 2026-01-15

> This document should be read by any AI agent before starting work.
> Update this file after completing significant changes.
> See also: `.agent/RULES.md` for critical rules.

---

## Current System State

| Component | Version | URL | Status |
|-----------|---------|-----|--------|
| Dashboard | v2.1.1 | https://sigma-hq-app.vercel.app | ✅ Live |
| Sync Worker | v7.4 | https://sigma-sync-worker-71025980302.europe-west1.run.app | ✅ Live |
| WhatsApp Backend | v4.20 | https://sigma-whatsapp-71025980302.europe-west1.run.app | ✅ Live |
| Email Sync | v4.1 | https://sigma-email-sync-71025980302.europe-west1.run.app | ✅ Live |
| WAHA Server | - | http://34.78.137.109:3000 | ✅ Live |

### Quick Health Check
```bash
curl https://sigma-sync-worker-71025980302.europe-west1.run.app/status
curl https://sigma-whatsapp-71025980302.europe-west1.run.app/status
```

---

## CI/CD Pipeline (IMPORTANT)

**Architecture:** GitHub Actions (testing) + Cloud Build (deployment)

```
Feature Branch → PR → Tests Pass → Merge → Cloud Build Deploys
```

| Component | Tool | Trigger |
|-----------|------|---------|
| Testing | GitHub Actions | On Pull Request |
| Deployment | Cloud Build | On merge to main |
| Frontend | Vercel | Auto-deploy on push |

**Why this setup?**
- Cloud Build preserves environment variables (PORT, WAHA_URL, etc.)
- GitHub Actions `gcloud run deploy` wipes env vars - DON'T USE IT FOR DEPLOY
- Branch protection blocks merge if tests fail

**Workflow files:**
- `.github/workflows/deploy.yml` - Tests only (runs on PR)
- Cloud Build triggers configured in GCP Console

**DO NOT:**
- Push directly to main
- Move deployment to GitHub Actions
- Disable Cloud Build triggers

---

## Working Features

- **Dashboard**: Password gate, project cards, pending items
- **Vault**: Browse project documents by folder, recent revisions
- **OrgChart**: Team hierarchy visualization with SVG paths, export to PNG
- **WhatsApp Integration**: Message classification, project routing, channel mapping
- **AI Search**: Vertex AI document search across projects
- **Sync**: Google Drive → GCS synchronization per project
- **Status API**: All backends expose `/status` for health monitoring
- **CI/CD**: Automated testing on PRs, auto-deploy on merge

---

## Architecture

### Frontend (React + Vite)
- Deployed on Vercel (auto-deploy from main branch)
- Key components: `Sidebar.jsx`, `Vault.jsx`, `OrgChart.jsx`, `ProjectHome/`

### Backend Services (Cloud Run)

**Sync Worker** (`backend/`)
- Handles: `/files`, `/latest`, `/sync`, `/search`, `/status`
- Accepts both GET and POST for all endpoints

**WhatsApp Webhook** (`backend-whatsapp-webhook/`)
- Handles: Incoming messages, group management, WAHA proxy
- Endpoints: `/status`, `/waha/groups`, `/waha/session`, `/admin/cleanup-groups`

**Email Sync** (`backend-email/`)
- Handles: Email fetching, classification, GCS storage
- Endpoints: `/status`, `/fetch`, `/classify`, `/process`

### Database
- **Firestore**: Projects, team members, messages, whatsapp_groups
- **Cloud Storage**: Project documents (GCS buckets)
- **Vertex AI**: Document search index

---

## Important Rules (DO NOT BREAK)

1. **Use PR workflow** - Never push directly to main
2. **Never change HTTP methods without updating frontend** - POST→GET broke Vault
3. **Never rename Firestore fields without migration** - Caused duplicate groups
4. **Let tests run** - Don't merge until green checkmark
5. **Don't move deployment to GitHub Actions** - It wipes env vars
6. **Increment SERVICE_VERSION on every code change**

---

## Folder Structure (Projects)

Current structure varies by project. Standard:
```
01.Correspondence
02.Drawings & Designs  
03.LOI & Boq
04.Qs & PO
05.Submittals
06.MOM, Reports, WP, TS, Snags
07.Invoices
08.Variations & Extra Works
09.Contract & Tender Documents
10.Handover
```

---

## WAHA Server Access

- **URL**: http://34.78.137.109:3000
- **Login**: admin / sigma2026
- **API Key**: sigma2026

---

## Testing

```bash
npm test              # Run all Playwright tests
npm run test:ui       # Visual test runner
npx playwright show-report  # View HTML report
```

Tests verify:
- Backend `/status` endpoints return healthy
- Vault POST requests work
- OrgChart renders SVG
- WhatsApp groups endpoint

---

## Recent Changes

| Date | Change | Version |
|------|--------|---------|
| 2026-01-15 | CI/CD pipeline complete (GitHub Actions + Cloud Build hybrid) | - |
| 2026-01-14 | Added /status API to all backends, .agent/RULES.md | v7.4, v4.20, v4.1 |
| 2026-01-14 | Removed unwanted anomaly detection | v4.19 |
| 2026-01-13 | Added Playwright tests, documentation | v2.1.1 |
| 2026-01-13 | Fixed Vault POST/GET issue | v7.1 → v7.3 |
| 2026-01-13 | Fixed duplicate WhatsApp groups | v4.14 |
| 2026-01-12 | Backend modularization complete | v7.0 |

---

## Next Up (from ROADMAP.md)

See `ROADMAP.md` for full backlog. High priority:
1. Sender Identification (match phone → team member)
2. Create Project Button
3. Voice Note Transcription
4. WhatsApp Reminders

---

## Contact

**Owner**: Mosallam (Head of Technical Office, Sigma Contractors)
**Offices**: Cairo, Riyadh
