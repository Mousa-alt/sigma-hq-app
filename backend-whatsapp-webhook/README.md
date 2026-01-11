# WhatsApp Webhook - Modular Architecture

## Overview

This webhook processes incoming WhatsApp messages for Sigma Contractors' Technical Office platform.

**Version:** v4.13 (Modular)

## File Structure

```
backend-whatsapp-webhook/
├── main.py                 # Original monolithic file (2000+ lines) - KEEP FOR ROLLBACK
├── main_modular.py         # NEW slim entry point (~150 lines)
│
├── config.py               # All environment variables and constants
│
├── utils/
│   ├── __init__.py
│   ├── revision_parser.py  # Revision extraction and sorting (Rev01, V2, dates)
│   └── date_utils.py       # Deadline extraction, date formatting
│
├── services/
│   ├── __init__.py
│   ├── firestore_ops.py    # All Firestore database operations
│   ├── waha_api.py         # WhatsApp API calls via Waha
│   ├── file_delivery.py    # File sending, signed URLs, short URLs
│   └── vertex_search.py    # Document search via Vertex AI
│
├── handlers/
│   ├── __init__.py
│   ├── commands.py         # All command handling (f, d, a, etc.)
│   └── classification.py   # AI message classification
│
├── requirements.txt
└── Dockerfile
```

## Module Responsibilities

| Module | Lines | Purpose |
|--------|-------|---------|
| `main_modular.py` | ~150 | HTTP routing only |
| `config.py` | ~50 | Environment variables |
| `utils/revision_parser.py` | ~150 | Revision sorting |
| `utils/date_utils.py` | ~100 | Date/deadline parsing |
| `services/firestore_ops.py` | ~450 | Database operations |
| `services/waha_api.py` | ~100 | WhatsApp API |
| `services/file_delivery.py` | ~250 | File sending |
| `services/vertex_search.py` | ~100 | Document search |
| `handlers/commands.py` | ~650 | Command processing |
| `handlers/classification.py` | ~150 | AI classification |

## Deployment

### Using Modular Version (Recommended for new deploys)

```bash
# Rename files
mv main.py main_legacy.py
mv main_modular.py main.py

# Deploy
gcloud run deploy sigma-whatsapp-webhook \
  --source . \
  --region europe-west1 \
  --project sigma-hq-technical-office
```

### Rollback to Original

```bash
# If issues occur
mv main.py main_modular.py
mv main_legacy.py main.py

# Redeploy
gcloud run deploy sigma-whatsapp-webhook --source .
```

## Features

- **Commands:** f (find), g (get), done, assign, escalate, defer
- **Shortcuts:** s, u, p, t, d, h (summary, urgent, pending, today, digest, help)
- **Document Search:** Vertex AI powered, sorted by revision
- **Short URLs:** Clean view links for documents
- **AI Classification:** Gemini-powered message analysis

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GCP_PROJECT` | sigma-hq-technical-office | GCP project ID |
| `GCS_BUCKET` | sigma-docs-repository | Document storage bucket |
| `FIREBASE_PROJECT` | sigma-hq-38843 | Firebase project |
| `APP_ID` | sigma-hq-production | Application ID |
| `WAHA_API_URL` | http://34.78.137.109:3000 | Waha server URL |
| `WAHA_API_KEY` | sigma2026 | Waha API key |
| `WAHA_PLUS_ENABLED` | false | Enable Waha Plus features |
| `SHORT_URL_BASE` | (webhook URL) | Base URL for short links |

## Testing Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run with functions framework
functions-framework --target=whatsapp_webhook --port=8080

# Test health check
curl http://localhost:8080

# Test with sample payload
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"event":"message","payload":{"body":"help","chatId":"test@g.us"}}'
```

## Benefits of Modular Architecture

1. **Lower Risk** - Change one module without affecting others
2. **Easier Debugging** - Errors point to specific files
3. **Faster Development** - Find code faster in smaller files
4. **Better Testing** - Unit test each module separately
5. **Team Ready** - Multiple developers can work on different modules
