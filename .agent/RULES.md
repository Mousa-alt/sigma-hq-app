# Agent Rules for Sigma HQ

> READ THIS FIRST BEFORE MAKING ANY CHANGES

## Quick Start for New Agent

1. Read `PROJECT_STATUS.md` for current system state
2. Read `ROADMAP.md` for planned features
3. Check `/status` endpoints to verify services are healthy
4. Create a feature branch, never push directly to main

---

## Critical Rules

### 1. CI/CD Workflow (MANDATORY)
**The deployment pipeline is locked. Do not change it.**

```
Feature Branch → PR → Tests Pass → Merge → Cloud Build Deploys
```

- **GitHub Actions**: Runs tests on PRs only (`.github/workflows/deploy.yml`)
- **Cloud Build Triggers**: Deploy to Cloud Run (preserve env vars)
- **Branch Protection**: Can't merge if tests fail

**WHY THIS MATTERS:**
On 2026-01-14, we tried deploying via GitHub Actions using `gcloud run deploy --source`. 
It WIPED environment variables (PORT, WAHA_URL, etc.) and crashed WhatsApp service.
Cloud Build triggers preserve these. DO NOT "optimize" this into GitHub Actions.

### 2. Never Push Directly to Main
```bash
# ❌ WRONG
git push origin main

# ✅ CORRECT
git checkout -b feature-name
git push -u origin feature-name
# Then create PR on GitHub
```

### 3. Never Change HTTP Methods Without Updating Frontend
**Why:** On 2026-01-13, changing POST to GET-only broke the entire Vault.
```
❌ BAD: Changing /files from POST to GET without updating React
✅ GOOD: Support BOTH methods: @app.route('/files', methods=['GET', 'POST'])
```

### 4. Never Rename Firestore Fields Without Migration
**Why:** Renaming `group_id` to `wahaId` caused duplicate WhatsApp groups.
```
❌ BAD: Just rename the field and hope it works
✅ GOOD: Support BOTH old and new field names, add migration endpoint
```

### 5. Always Let Tests Run
Tests run automatically on PR. Wait for green checkmark before merging.
```bash
# To run locally:
npm test
```

### 6. Verify /status After Merge
After PR is merged, Cloud Build deploys automatically. Verify:
```bash
curl https://sigma-sync-worker-71025980302.europe-west1.run.app/status
curl https://sigma-whatsapp-71025980302.europe-west1.run.app/status
```

### 7. Increment Version on Every Change
Update `SERVICE_VERSION` in the file you're modifying:
- `backend/routes.py` → Sync Worker
- `backend-whatsapp-webhook/main.py` → WhatsApp
- `backend-email/routes.py` → Email Sync

### 8. Update PROJECT_STATUS.md After Major Changes
Keep version numbers and recent changes current.

---

## Service URLs

| Service | URL |
|---------|-----|
| Dashboard | https://sigma-hq-app.vercel.app |
| Sync Worker | https://sigma-sync-worker-71025980302.europe-west1.run.app |
| WhatsApp | https://sigma-whatsapp-71025980302.europe-west1.run.app |
| WAHA | http://34.78.137.109:3000 |

## WAHA Credentials
- Login: admin / sigma2026
- API Key: sigma2026

---

## Deployment Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Feature Branch │────▶│   Pull Request  │────▶│  Tests (GitHub  │
│   git push      │     │   on GitHub     │     │   Actions)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                   Tests Pass?
                                                    │      │
                                                   Yes     No
                                                    │      │
                                                    ▼      ▼
                                              ┌──────┐  ┌──────┐
                                              │Merge │  │Block │
                                              │ OK   │  │Merge │
                                              └──┬───┘  └──────┘
                                                 │
                                                 ▼
                                         ┌─────────────────┐
                                         │  Cloud Build    │
                                         │  Auto-Deploys   │
                                         │  (preserves     │
                                         │   env vars)     │
                                         └─────────────────┘
```

---

## Quick Checks

**Is the backend running?**
```bash
curl https://sigma-sync-worker-71025980302.europe-west1.run.app/status
```

**Is WhatsApp connected?**
```bash
curl https://sigma-whatsapp-71025980302.europe-west1.run.app/waha/session
```

**Does Vault work?**
```bash
curl -X POST https://sigma-sync-worker-71025980302.europe-west1.run.app/files \
  -H "Content-Type: application/json" \
  -d '{"project": "Ecolab"}'
```

---

## Firestore Structure
```
artifacts/
  sigma-hq-production/
    public/
      data/
        projects/
        team_members/
        whatsapp_groups/
        messages/
```

---

## Files to Know

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | GitHub Actions - tests on PRs |
| `PROJECT_STATUS.md` | Current system state |
| `ROADMAP.md` | Feature backlog |
| `.agent/RULES.md` | This file - critical rules |
| `backend/routes.py` | Main API endpoints |
| `backend-whatsapp-webhook/main.py` | WhatsApp service |
| `src/components/Vault.jsx` | Document browser |
