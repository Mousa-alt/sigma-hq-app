# Agent Quick Start

> Read this in 2 minutes to get up to speed.

## What is Sigma HQ?

AI-powered Technical Office platform for a construction company. Manages projects, documents, WhatsApp messages, and emails.

## Key URLs

| What | URL |
|------|-----|
| Dashboard | https://sigma-hq-app.vercel.app |
| Sync API | https://sigma-sync-worker-71025980302.europe-west1.run.app |
| WhatsApp API | https://sigma-whatsapp-71025980302.europe-west1.run.app |
| GitHub | https://github.com/Mousa-alt/sigma-hq-app |

## How to Make Changes

```bash
# 1. Create branch (NEVER push to main directly)
git checkout -b my-feature

# 2. Make changes, commit
git add .
git commit -m "feat: description"

# 3. Push and create PR
git push -u origin my-feature
# Go to GitHub and create Pull Request

# 4. Wait for tests to pass (green checkmark)

# 5. Merge PR → Cloud Build auto-deploys
```

## DO NOT

❌ Push directly to main  
❌ Move deployment to GitHub Actions (it breaks env vars)  
❌ Change POST to GET without updating frontend  
❌ Rename Firestore fields without migration  
❌ Merge if tests are failing  

## Verify After Deploy

```bash
curl https://sigma-sync-worker-71025980302.europe-west1.run.app/status
curl https://sigma-whatsapp-71025980302.europe-west1.run.app/status
```

## Files to Read

1. `.agent/RULES.md` - Critical rules (READ FIRST)
2. `PROJECT_STATUS.md` - Current system state
3. `ROADMAP.md` - Feature backlog

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│  Cloud Run  │────▶│  Firestore  │
│   (Vercel)  │     │  (Python)   │     │  + GCS      │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    WAHA     │
                    │  (WhatsApp) │
                    └─────────────┘
```

## CI/CD Pipeline

```
Feature Branch → PR → GitHub Actions Tests → Merge → Cloud Build Deploys
```

- **GitHub Actions**: Tests only (on PR)
- **Cloud Build**: Deployment (preserves env vars)
- **Vercel**: Frontend auto-deploy

## WAHA WhatsApp Server

- URL: http://34.78.137.109:3000
- Login: admin / sigma2026
- API Key: sigma2026

## Current Priorities

From `ROADMAP.md`:
1. Sender Identification
2. Create Project Button  
3. Voice Note Transcription
4. WhatsApp Reminders

---

**For more details, read `.agent/RULES.md`**
