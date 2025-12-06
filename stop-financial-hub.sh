#!/bin/bash

# RMT Financial Hub Stop Script
# This script cleanly shuts down all Financial Hub services

echo "🛑 Stopping RMT Financial Hub services..."

# Kill all related processes
pkill -f "npm start" 2>/dev/null || true
pkill -f "python.*server" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true

echo "✅ All Financial Hub services stopped."
echo "To restart, run: ./start-financial-hub.sh"