FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all Python files and modules
COPY main.py .
COPY config.py .
COPY utils/ ./utils/
COPY services/ ./services/
COPY handlers/ ./handlers/

ENV PORT=8080
EXPOSE 8080

CMD exec functions-framework --target=whatsapp_webhook --port=${PORT}
