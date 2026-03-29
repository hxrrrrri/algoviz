FROM python:3.11-slim

WORKDIR /app

# Install system deps (libgomp1 required by TensorFlow for OpenMP threading)
RUN apt-get update && apt-get install -y \
    gcc \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

# Install Python deps — ML packages first so Docker layer cache is efficient
COPY requirements.txt .
RUN pip install --no-cache-dir tensorflow-cpu>=2.15.0 scikit-learn numpy pandas
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Permissions
RUN chown -R appuser:appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1
ENV TF_CPP_MIN_LOG_LEVEL=3
ENV TF_ENABLE_ONEDNN_OPTS=0

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]