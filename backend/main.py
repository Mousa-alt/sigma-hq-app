# Sigma HQ Backend - Main Entry Point (v7.0 Modular)
# This is the slim entry point that imports from modules
#
# Structure:
#   main.py         - This file (entry point)
#   config.py       - Configuration constants
#   clients.py      - GCS, Firestore, Drive clients
#   routes.py       - HTTP route handlers
#   services/       - Business logic (sync, search, email)
#   utils/          - Helpers (document detection, GCS ops)

import functions_framework
from flask import Flask
from routes import register_routes

# Create Flask app
app = Flask(__name__)

# Register all routes
register_routes(app)

# Cloud Functions entry point
@functions_framework.http
def main(request):
    """Cloud Functions HTTP entry point"""
    with app.request_context(request.environ):
        return app.full_dispatch_request()

# Local development
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
