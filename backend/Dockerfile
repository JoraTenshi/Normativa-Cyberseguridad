# Backend Dockerfile using Alpine (Lightweight)
FROM alpine:latest

WORKDIR /app

# Install basic utilities
RUN apk add --no-cache \
    curl \
    wget \
    git \
    bash

COPY . .

EXPOSE 8000

CMD ["/bin/bash"]
