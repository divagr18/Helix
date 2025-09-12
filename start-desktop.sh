#!/bin/bash

# Helix CME Electron Startup Script
echo "🚀 Starting Helix CME Desktop Application..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start Docker services
echo "📦 Starting Docker services..."
cd "$(dirname "$0")"
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if frontend is ready
echo "🔍 Checking if frontend is ready..."
timeout=60
counter=0
while ! curl -s http://localhost:5173 > /dev/null; do
    if [ $counter -ge $timeout ]; then
        echo "❌ Frontend failed to start within $timeout seconds"
        exit 1
    fi
    echo "   Waiting for frontend... ($counter/$timeout)"
    sleep 2
    counter=$((counter + 2))
done

# Check if backend is ready
echo "🔍 Checking if backend is ready..."
counter=0
while ! curl -s http://localhost:8000/api/v1/health/ > /dev/null; do
    if [ $counter -ge $timeout ]; then
        echo "❌ Backend failed to start within $timeout seconds"
        exit 1
    fi
    echo "   Waiting for backend... ($counter/$timeout)"
    sleep 2
    counter=$((counter + 2))
done

echo "✅ All services are ready!"

# Start Electron
echo "🖥️  Starting Electron desktop app..."
cd electron
npm run electron-dev

echo "👋 Helix CME Desktop Application closed."
