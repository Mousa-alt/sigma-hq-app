FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all modules
COPY config.py .
COPY clients.py .
COPY routes.py .
COPY main.py .
COPY utils/ ./utils/
COPY services/ ./services/

ENV PORT=8080
EXPOSE 8080

CMD exec functions-framework --target=main --port=${PORT}
