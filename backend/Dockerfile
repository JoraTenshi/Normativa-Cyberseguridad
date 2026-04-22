# Backend Dockerfile using Alpine (Lightweight)
FROM alpine:latest

WORKDIR /app

# Install basic utilities and Python
RUN apk add --no-cache \
    curl \
    wget \
    git \
    bash \
    python3 \
    py3-pip

COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt || true

EXPOSE 8000

CMD ["python3", "-m", "http.server", "8000"]
