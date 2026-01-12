# Sigma HQ Email Backend - Main Entry Point (v4.0 Modular)
import functions_framework
from flask import Flask
from routes import register_routes

app = Flask(__name__)
register_routes(app)

@functions_framework.http
def main(request):
    """Cloud Functions HTTP entry point"""
    with app.request_context(request.environ):
        return app.full_dispatch_request()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
