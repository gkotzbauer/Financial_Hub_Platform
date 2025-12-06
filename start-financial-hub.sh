#!/bin/bash

# RMT Financial Hub Startup Script
# This script ensures only the necessary services are running

echo "🚀 Starting RMT Financial Hub..."

# Kill any existing processes to prevent duplicates
echo "Cleaning up existing processes..."
pkill -f "npm start" 2>/dev/null || true
pkill -f "python.*server" 2>/dev/null || true
sleep 2

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Start Python static file server (port 8080) - Main hub and dashboards
echo "Starting Static File Server (port 8080)..."
python3 -m http.server 8080 > /dev/null 2>&1 &
STATIC_PID=$!

# Start Chat Agent (port 3010)
echo "Starting Chat Agent (port 3010)..."
cd chat-agent
npm start > /dev/null 2>&1 &
CHAT_PID=$!

# Start Backend API (port 3008)
echo "Starting Backend API (port 3008)..."
cd ..
PORT=3008 npm start > /dev/null 2>&1 &
API_PID=$!

# Wait a moment for services to start
sleep 3

echo "✅ Financial Hub Services Started:"
echo "  🌐 Main Hub & Dashboards: http://localhost:8080/"
echo "  🤖 Chat Agent: http://localhost:3010/"
echo "  🔧 Backend API: http://localhost:3008/api/"
echo ""
echo "Process IDs:"
echo "  Static Server: $STATIC_PID"
echo "  Chat Agent: $CHAT_PID"
echo "  Backend API: $API_PID"
echo ""
echo "To stop all services, run: ./stop-financial-hub.sh"