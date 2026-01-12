# SIGMA HQ - Agent Handoff Summary
**Date:** January 12, 2026
**Project:** Sigma HQ - Technical Office Intelligence Platform
**Last Updated:** Session 2 - New Folder Structure Implementation

---

## 1. PROJECT OVERVIEW

**Sigma HQ** is an AI-powered Technical Office platform for Sigma Contractors (construction/fit-out company in Cairo & Riyadh). It manages multiple engineering projects with:

- **Dashboard** (React/Vercel): Project management, document browsing, email classification
- **Backend** (Python/Cloud Run): Google Drive sync, GCS storage, AI search, email processing
- **WhatsApp Integration**: Message aggregation from project groups
- **AI Search**: Vertex AI + Gemini for document search and analysis

### Key URLs
- **Dashboard:** https://sigma-hq-app.vercel.app
- **Backend:** https://sigma-sync-worker-139501016912.europe-west1.run.app
- **GitHub:** https://github.com/Mousa-alt/sigma-hq-app
- **GCS Bucket:** sigma-docs-repository
- **Waha WhatsApp Server:** 34.78.137.109:3000 (admin/sigma2026, API key: sigma2026)

---

## 2. COMPLETED IN THIS SESSION

### ✅ Backend Updates (backend/main.py)
- **`detect_document_type()`** - Added NEW folder patterns while keeping OLD patterns
  - NEW: `01.Correspondence`, `03.Design-Drawings`, `04.Shop-Drawings`, `05.Contract-BOQ`, etc.
  - OLD: `09-Correspondence`, `02.design`, `04-shop`, etc.
- **`is_approved_folder()`** - New helper function for approved folder detection
  - Supports: `/approved/`, `05-approved`, `04.Shop-Drawings/*/Approved`, `07.Submittals/Approved`
- **`get_latest_by_type()`** - Uses new `is_approved_folder()` for both structures
- **`classify_email()`** - Auto-detects structure, uses `01.Correspondence/Client/` for new projects
- **`get_project_emails()`** - Checks BOTH old and new correspondence folders
- **`is_email_folder()`** - New helper to protect both old and new email folders from sync deletion
- **Version:** v6.0 - New Folder Structure Support

### ✅ Email Backend Updates (backend-email/main.py)
- **`detect_folder_structure()`** - New function to auto-detect old vs new folder layout
- **`save_email_to_gcs()`** - Uses correct path based on project's folder structure
  - NEW: `{folder_name}/01.Correspondence/Client/{DOC_TYPE}/...`
  - OLD: `{folder_name}/09-Correspondence/{DOC_TYPE}/...`
- **Version:** v3.1 - New Folder Structure Support

### ✅ Frontend Updates (src/components/Vault.jsx)
- **`FOLDER_ICONS`** - Added mappings for new folder names:
  - `correspondence`, `project-info`, `design-drawings`, `shop-drawings`
  - `contract-boq`, `qs-procurement`, `submittals`, `reports-mom`
  - `invoices-variations`, `handover`, `pending`, `approved`, `wms`, `snag`
- **`DOC_TYPE_CONFIG`** - Added `procurement` type
- Maintained backward compatibility with old folder structure icons

---

## 3. NEW FOLDER STRUCTURE (FINALIZED)

```
{ProjectName-Venue}/
├── 01.Correspondence
│   ├── Client
│   ├── Contractor
│   ├── Suppliers
│   └── Internal-Memos
├── 02.Project-Info
│   ├── Tender-Documents
│   ├── Mall-Requirements
│   ├── Manuals-Standards
│   ├── Time-Schedule
│   └── Contacts
├── 03.Design-Drawings              # FROM client/consultant (reference)
│   ├── Architectural
│   └── MEP
├── 04.Shop-Drawings                # BY Sigma (production)
│   ├── Architectural
│   │   ├── Pending
│   │   └── Approved
│   └── MEP
│       ├── Pending
│       └── Approved
├── 05.Contract-BOQ
│   ├── Contract
│   └── BOQ
├── 06.QS-Procurement
│   ├── QS-Sheets
│   └── Purchase-Orders
├── 07.Submittals
│   ├── Material-Submittals
│   ├── Work-Inspections
│   ├── Method-Statements
│   └── Approved
├── 08.Reports-MOM
│   ├── MOM
│   ├── General-Reports
│   ├── WMS
│   ├── Work-Plan
│   └── Snag-Lists
├── 09.Invoices-Variations
│   ├── Client-Invoices
│   ├── Subcontractor-Invoices
│   └── Variation-Orders
└── 10.Handover
    ├── As-Built-Drawings
    ├── O&M-Manuals
    └── Warranties
```

---

## 4. CURRENT GCS FOLDER MAPPINGS

| Project | gcsFolderName | Structure |
|---------|---------------|-----------|
| Agora | `Agora-GEM` | OLD |
| Eichholtz | `Eichholtz` | OLD |
| Springfield | `Springfield-D5` | OLD |
| AFV | `AFV-LV` | OLD |
| Ecolab | `Ecolab-CFC` | OLD |
| *New Projects* | `{Name}-{Venue}` | NEW |

---

## 5. KEY FILES REFERENCE

### Frontend (src/)
| File | Purpose | Updated |
|------|---------|---------|
| `App.jsx` | Main app, routing, sync logic | - |
| `components/Vault.jsx` | Document browser tab | ✅ Session 2 |
| `components/FolderPopup.jsx` | Folder file browser modal | - |
| `components/Modal.jsx` | New project creation (auto-generates gcsFolderName) | - |
| `components/ProjectSettings.jsx` | Project settings (editable gcsFolderName) | - |
| `components/ProjectHome/index.jsx` | Project dashboard home tab | - |
| `components/Overview.jsx` | Command center with KPIs | - |
| `components/AIChat.jsx` | AI search & document compare | - |
| `config.js` | URLs, colors, branding | - |
| `hooks/useProjectEmails.js` | Email data fetching hook | - |
| `utils/projectMatching.js` | Strict project matching logic | - |

### Backend
| File | Purpose | Updated |
|------|---------|---------|
| `backend/main.py` | Main sync worker (v6.0) | ✅ Session 2 |
| `backend-email/main.py` | Email IMAP processor (v3.1) | ✅ Session 2 |
| `backend-whatsapp-webhook/main.py` | WhatsApp webhook (v4.14) | - |
| `backend-whatsapp-webhook/config.py` | WhatsApp config | - |

---

## 6. COMMITS FROM THIS SESSION

| SHA | Description |
|-----|-------------|
| `519d894c` | feat: Add support for new folder structure in document detection |
| `42c3a1ad` | feat: Add new folder structure support to email backend |
| `1b3e57a8` | feat: Update Vault folder icons for new folder structure |

### Previous Session Commits
| SHA | Description |
|-----|-------------|
| `1e5728da` | Fix: Use gcsFolderName field for GCS queries |
| `0f29bd52` | Fix: FolderPopup use gcsFolderName field |
| `640d1516` | Add gcsFolderName field to ProjectSettings |
| `cc95fed4` | Fix: App.jsx use gcsFolderName for sync |
| `bb1e45b6` | Fix: ProjectHome use gcsFolderName for stats |
| `de823043` | Auto-generate gcsFolderName on project creation |
| `e6004e14` | Fix: Recent Revisions cards visibility |

---

## 7. DEPLOYMENT INSTRUCTIONS

### Backend Deployment (Cloud Run)

```bash
# Deploy main backend
cd backend
gcloud run deploy sigma-sync-worker \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated

# Deploy email backend  
cd backend-email
gcloud run deploy sigma-email-sync \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated
```

### Frontend Deployment
Frontend auto-deploys via Vercel on GitHub push.

---

## 8. TESTING CHECKLIST

After deployment, verify:

- [ ] **Existing Projects (OLD structure)**
  - Vault shows folders correctly
  - Approved docs detected from `05-approved/`
  - Emails visible from `09-Correspondence/`
  - Document type detection works

- [ ] **New Projects (NEW structure)**
  - Create project with `create_project_folders.py`
  - Sync to GCS
  - Vault shows folders with correct icons
  - Approved docs detected from `04.Shop-Drawings/*/Approved` and `07.Submittals/Approved`
  - Email classification goes to `01.Correspondence/Client/`

- [ ] **Email Classification**
  - New emails go to correct folder based on project structure
  - Unclassified emails still go to `_Unclassified_Emails/`
  - Manual classification detects project structure

---

## 9. IMPORTANT NOTES

- **Backward Compatibility**: All backends support BOTH old and new folder structures
- **Auto-Detection**: System automatically detects which structure a project uses
- **gcsFolderName**: Critical field linking Firestore project to GCS folder
- **Email Protection**: Both `09-Correspondence/` and `01.Correspondence/` protected from sync deletion
- **New Projects**: Default to NEW folder structure when no existing folders detected

---

## 10. NEXT STEPS FOR FUTURE AGENT

1. **Deploy backends to Cloud Run** (see Section 7)
2. **Test with both old and new project structures**
3. **Create a new project using new folder structure** to verify end-to-end
4. **Optional**: Clean up empty duplicate GCS folders (`Agora/`, `Eichholtz/`, `Springfield/`)
5. **Optional**: Migrate existing projects to new structure (requires manual data migration)
