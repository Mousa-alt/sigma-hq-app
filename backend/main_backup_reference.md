# Main Backend - Backup Reference

The original monolithic main.py (1,216 lines) was refactored into:

```
backend/
├── main.py              # Slim entry point (30 lines)
├── config.py            # Configuration constants
├── clients.py           # GCS, Firestore, Drive clients  
├── routes.py            # HTTP route handlers
├── services/
│   ├── __init__.py
│   ├── sync.py          # Drive → GCS sync
│   ├── search.py        # Vertex AI search
│   └── email.py         # Email classification
└── utils/
    ├── __init__.py
    ├── document.py      # Document type detection
    └── gcs.py           # GCS operations
```

If you need to restore the old monolithic version, check git history:
```
git show 7d510b0:backend/main.py > main_old.py
```

Commit SHA with old version: 7d510b0a4a56835c0347ae387e396425bea64a05
