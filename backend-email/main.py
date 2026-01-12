# Sigma HQ Email Backend - Main Entry Point (v4.0 Modular)
#
# Structure:
#   main.py         - This file (entry point)
#   config.py       - Configuration constants
#   clients.py      - Storage, Firestore, Vertex AI clients
#   routes.py       - HTTP route handlers
#   services/       - Email classification logic
#   utils/          - IMAP and GCS helpers

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
