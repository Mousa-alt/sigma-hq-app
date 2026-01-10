# Sigma HQ - Technical Office Intelligence Platform
## Complete Agent Briefing Document
**Date:** January 10, 2026
**Prepared for:** Next AI Agent Handoff

---

## 1. PROJECT OVERVIEW

**What is Sigma HQ?**
An AI-powered command center for Sigma Contractors, a construction company operating between Cairo and Riyadh. The platform manages 20+ simultaneous engineering projects by:
- Syncing project documents from Google Drive to AI-searchable index
- Capturing WhatsApp group messages and classifying them by project
- Syncing emails and extracting actionable items
- Providing a unified dashboard for the Technical Office team

**User:** Mosallam - Head of Technical Office at Sigma Contractors
- Not deeply technical, needs solutions that "just work"
- Values automation over manual processes
- Gets frustrated with repetitive debugging

---

## 2. CURRENT INFRASTRUCTURE

### 2.1 Frontend
| Component | URL | Tech |
|-----------|-----|------|
| Dashboard | https://sigma-hq-app.netlify.app | React + Vite |
| Repository | https://github.com/Mousa-alt/sigma-hq-app | GitHub |

### 2.2 Backend Services (Google Cloud Run)
| Service | URL | Purpose |
|---------|-----|---------|
| Sync Worker | https://sigma-sync-worker-71025980302.europe-west1.run.app | Google Drive ↔ GCS sync |
| Email Sync | https://sigma-email-sync-71025980302.europe-west1.run.app | IMAP email fetching |
| WhatsApp Webhook | https://sigma-whatsapp-webhook-71025980302.europe-west1.run.app | Receives WhatsApp messages |

### 2.3 WhatsApp Server (Google Cloud VM)
| Detail | Value |
|--------|-------|
| VM Name | waha-server |
| IP | 34.78.137.109 |
| Port | 3000 |
| Dashboard | http://34.78.137.109:3000/dashboard |
| Username | admin |
| Password | sigma2026 |
| API Key | sigma2026 |
| Zone | europe-west1-b |
| Machine | e2-small |

### 2.4 Database & Storage
| Service | Project/Bucket |
|---------|----------------|
| Firestore | sigma-hq-38843 |
| GCS Bucket | gs://sigma-docs-repository/ |
| Vertex AI Search | sigma-hq-technical-office |

### 2.5 Key Firestore Collections
Path: `artifacts/sigma-hq-production/public/data/`
- `projects` - Registered construction projects
- `whatsapp_messages` - Captured WhatsApp messages
- `whatsapp_groups` - Group → Project mappings
- `emails` - Synced emails
- `webhook_debug` - Debug payloads for troubleshooting

---

## 3. WHAT'S WORKING ✅

1. **Document Sync Pipeline**
   - Google Drive folders sync to GCS
   - Vertex AI indexes documents for RAG search
   - AI chat can answer questions about project documents

2. **Email Sync**
   - Runs every 5 minutes via Cloud Scheduler
   - Fetches from IMAP, classifies by project using Vertex AI
   - Shows in Activity Feed on dashboard

3. **WhatsApp Message Capture**
   - Waha server running 24/7 on GCP VM
   - Webhook receives messages and saves to Firestore
   - AI classifies messages by project, urgency, action type
   - Messages appear in dashboard Activity Feed

4. **Dashboard Features**
   - Project management (add/edit projects)
   - Document vault with file browsing
   - AI chat for document queries
   - Channel Settings for mapping groups to projects
   - Activity Feed showing WhatsApp + Email

---

## 4. CURRENT BUG 🐛

### WhatsApp Group Names Not Displaying

**Problem:**
- Groups show as numeric IDs (e.g., "120363423161692218") instead of names (e.g., "Command Center - Technical office")
- "Mosallam" incorrectly appears as a group name (it's actually the sender's display name)

**Root Cause:**
Waha's webhook payload does NOT include group names. It only sends:
```json
{
  "from": "120363423161692218@g.us",  // Group ID only
  "_data": {
    "notifyName": "Mosallam"  // This is SENDER name, not group name
  }
}
```

**Solution Implemented (needs deployment):**
- Webhook now calls Waha API to fetch group name when new group detected
- Uses correct Waha URL: `http://34.78.137.109:3000` (was incorrectly set to `31.220.107.186:3002`)
- Includes API key authentication header
- Caches group names in Firestore

**Deployment Command (user needs to run):**
```bash
cd ~/sigma-hq-app
git pull origin main
gcloud builds submit --config=backend-whatsapp-webhook/cloudbuild.yaml --project=sigma-hq-technical-office
```

---

## 5. WHAT NEEDS TO BE DONE 📋

### Immediate (This Session)
1. **Deploy the webhook fix** - Command above
2. **Test group name resolution** - Send message in WhatsApp group, verify name appears
3. **Clean up old data** - Delete "Mosallam" entry and numeric ID entries from `whatsapp_groups` collection
4. **Configure Command Group** - Set up "Command Center - Technical office" as the command group type

### Short-term
1. **Auto-classification of new groups**
   - When new group detected, analyze name for project keywords
   - Suggest project mapping with confidence score
   - Auto-detect type (internal/client/consultant/command)

2. **Dashboard improvements**
   - Show actual group names instead of IDs in Channel Settings
   - Add "Refresh" button to re-fetch group names from Waha
   - Better error handling when Waha API unreachable

### Medium-term (Roadmap)
1. **n8n Workflow Automation** - Connect WhatsApp commands to actions
2. **Mobile App** - Convert React app to mobile (PWA or React Native)
3. **Slack Integration** - Add Slack as another channel
4. **Timeline Visualization** - Project timeline with milestones
5. **Budget Tracking** - Integration with financial data

---

## 6. ARCHITECTURE NOTES

### Why Waha Instead of Official WhatsApp API?
Official WhatsApp Business API cannot read group messages - only send notifications. Waha is a self-hosted WhatsApp Web wrapper that can read all messages including groups.

### Why Cloud VM for Waha Instead of Cloud Run?
Cloud Run is serverless and can restart anytime. Waha needs to maintain a persistent WhatsApp Web session. If container restarts, user must scan QR code again. VM stays running 24/7.

### Bidirectional Sync Requirement
Construction projects have documents that change frequently (invoices, shop drawings). One-way sync creates stale data. System uses bidirectional sync to keep everything current.

### Fire-and-Forget Pattern
For background operations (sync, classification), save to Firestore first, close UI modal immediately, trigger background operation asynchronously. Prevents UI blocking.

---

## 7. KEY FILE PATHS

### Backend
```
backend-whatsapp-webhook/
├── main.py              # Webhook handler (v2.4)
├── requirements.txt     # Python deps
├── cloudbuild.yaml      # Deployment config
└── Dockerfile           # Python 3.11

backend-sync-worker/
├── main.py              # Drive sync logic
├── requirements.txt
└── cloudbuild.yaml

backend-email-sync/
├── main.py              # IMAP email sync
├── requirements.txt
└── cloudbuild.yaml
```

### Frontend
```
src/
├── components/
│   ├── Dashboard.jsx
│   ├── ProjectHome.jsx
│   ├── Sidebar.jsx
│   ├── ChatPanel.jsx
│   ├── Settings.jsx
│   ├── ChannelSettings.jsx   # WhatsApp group mapping UI
│   ├── WhatsAppSettings.jsx
│   └── ...
├── services/
│   └── firebase.js
└── App.jsx
```

### Scripts
```
scripts/
└── sync-whatsapp-groups.py   # Manual sync script (requires local access to Waha)
```

---

## 8. CREDENTIALS & ACCESS

### Google Cloud
- Project: `sigma-hq-technical-office`
- User authenticates via: `gcloud auth login`

### Firebase
- Project: `sigma-hq-38843`
- Console: https://console.firebase.google.com/project/sigma-hq-38843

### Waha Dashboard
- URL: http://34.78.137.109:3000/dashboard
- Username: `admin`
- Password: `sigma2026`
- API calls require header: `X-Api-Key: sigma2026`

### GitHub
- Repo: https://github.com/Mousa-alt/sigma-hq-app
- User: Mousa-alt
- MCP tools available for direct commits

---

## 9. COMMON COMMANDS

### Deploy WhatsApp Webhook
```bash
cd ~/sigma-hq-app
git pull origin main
gcloud builds submit --config=backend-whatsapp-webhook/cloudbuild.yaml --project=sigma-hq-technical-office
```

### Deploy Sync Worker
```bash
gcloud builds submit --config=backend-sync-worker/cloudbuild.yaml --project=sigma-hq-technical-office
```

### Deploy Email Sync
```bash
gcloud builds submit --config=backend-email-sync/cloudbuild.yaml --project=sigma-hq-technical-office
```

### Check Waha VM Status
```bash
gcloud compute instances list --project=sigma-hq-technical-office
```

### SSH to Waha VM (if needed)
```bash
gcloud compute ssh waha-server --zone=europe-west1-b --project=sigma-hq-technical-office
```

### Check Webhook Version
```bash
curl https://sigma-whatsapp-webhook-71025980302.europe-west1.run.app
```

---

## 10. KNOWN ISSUES & GOTCHAS

1. **SSH from user's machine doesn't work** - Use `gcloud compute ssh` or Cloud Console browser SSH instead

2. **Ad blockers break Firebase** - If dashboard doesn't load, check for ad blocker interference

3. **Cloud Run memory limits** - Large project folders (>1.8GB) can exceed memory. Use 4GiB memory, 2 CPU cores, extended timeouts.

4. **Waha webhook doesn't include group names** - Must fetch from Waha API separately (this is the current bug)

5. **IP changes on VM restart** - Waha VM IP can change. Always verify with `gcloud compute instances list`

6. **GCP empty env vars** - When passing `VAR=` to Cloud Run, GCP may interpret as unset. Always use explicit values.

---

## 11. NEXT AGENT CHECKLIST

- [ ] Have user run deployment command for webhook fix
- [ ] Verify webhook version shows "v2.4" with correct Waha URL
- [ ] Test by sending WhatsApp message, check if group name resolves
- [ ] Clean up incorrect entries in Firestore `whatsapp_groups` collection
- [ ] Help user configure "Command Center - Technical office" as command group
- [ ] Implement auto-classification for new groups (if time permits)

---

## 12. CONTACT CONTEXT

**User Profile:**
- Name: Mosallam
- Role: Head of Technical Office
- Company: Sigma Contractors
- Locations: Cairo (HQ) and Riyadh
- Communication style: Direct, wants fast solutions, gets frustrated with debugging loops
- Technical level: Uses tools but not a developer

**What works well:**
- Providing exact commands to copy-paste
- Making changes directly via GitHub MCP
- Explaining what's happening in simple terms

**What to avoid:**
- Multiple options when one will work
- Asking user to debug or investigate
- Solutions requiring manual/repeated intervention

---

*End of Briefing Document*
