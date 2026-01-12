# Email Backend - Backup Reference

The original monolithic main.py (545 lines) was refactored into:

```
backend-email/
├── main.py              # Slim entry point (30 lines)
├── config.py            # Configuration constants
├── clients.py           # Storage, Firestore, Vertex AI clients
├── routes.py            # HTTP route handlers
├── services/
│   ├── __init__.py
│   └── classifier.py    # Email classification logic
└── utils/
    ├── __init__.py
    ├── imap.py          # IMAP connection & fetching
    └── gcs.py           # Save emails to GCS
```

If you need to restore the old monolithic version, check git history:
```
git show 934baa7:backend-email/main.py > main_old.py
```

Commit SHA with old version: 934baa7d00578d47b0be340fd8eb4825ecfe7b75
