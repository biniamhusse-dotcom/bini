FROM python:3.11-slim

WORKDIR /app

# Install dependencies with retry and timeout settings
COPY requirements.txt .
RUN pip install --no-cache-dir --retries 5 --timeout 60 -r requirements.txt

# Copy application files
COPY bahmni_openai_middleware.py assistant_server.py ./

# Create non-root user for security
RUN addgroup --system assistant && adduser --system --ingroup assistant assistant
USER assistant

EXPOSE 5050

# Run with gunicorn for production-grade concurrency
CMD ["gunicorn", "--bind", "0.0.0.0:5050", "--workers", "2", "--threads", "4", "--timeout", "120", "assistant_server:app"]
