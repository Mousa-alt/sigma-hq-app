# Agent Rules for Sigma HQ

> READ THIS BEFORE MAKING ANY CHANGES

## Critical Rules

### 1. Never Change HTTP Methods Without Updating Frontend
**Why:** On 2026-01-13, changing POST to GET-only broke the entire Vault.
```
❌ BAD: Changing /files from POST to GET without updating React
✅ GOOD: Support BOTH methods: @app.route('/files', methods=['GET', 'POST'])
```

### 2. Never Rename Firestore Fields Without Migration
**Why:** Renaming `group_id` to `wahaId` caused duplicate WhatsApp groups.
```
❌ BAD: Just rename the field and hope it works
✅ GOOD: Support BOTH old and new field names, add migration endpoint
```

### 3. Always Run Tests Before Declaring Success
```bash
npm test
```
If tests fail, the deployment is NOT complete.

### 4. Verify /status After Deployment
```bash
curl https://sigma-sync-worker-71025980302.europe-west1.run.app/status
curl https://sigma-whatsapp-71025980302.europe-west1.run.app/status
```
Check that `version` matches what you just deployed.

### 5. Update PROJECT_STATUS.md After Major Changes
Keep the version numbers and recent changes up to date.

### 6. Increment Version on Every Change
Update `SERVICE_VERSION` in the file you're modifying:
- `backend/routes.py` → sync worker
- `backend-whatsapp-webhook/main.py` → WhatsApp
- `backend-email/routes.py` → email sync

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

## Quick Checks

**Is the backend running?**
```bash
curl https://sigma-sync-worker-71025980302.europe-west1.run.app/
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
