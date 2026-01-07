# Root Dockerfile - redirects to backend
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/main.py .

# Run the Flask app
CMD exec functions-framework --target=sync_drive_folder --port=${PORT:-8080}
