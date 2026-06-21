# Use an official Python base image
FROM python:3.11-slim

# Install system dependencies, pandoc, curl, tools to extract typst, and standard fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    xz-utils \
    pandoc \
    ca-certificates \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

# Install Typst CLI from GitHub releases
RUN curl -L https://github.com/typst/typst/releases/latest/download/typst-x86_64-unknown-linux-musl.tar.xz -o typst.tar.xz \
    && tar -xvf typst.tar.xz \
    && mv typst-x86_64-unknown-linux-musl/typst /usr/local/bin/ \
    && rm -rf typst.tar.xz typst-x86_64-unknown-linux-musl

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose port 8000
EXPOSE 8000

# Start the FastAPI application
CMD ["python", "main.py"]
