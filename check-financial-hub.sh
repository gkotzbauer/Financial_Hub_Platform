#!/bin/bash

# RMT Financial Hub Health Check Script
# This script checks if all services are running correctly

echo "🔍 Checking RMT Financial Hub services..."

# Function to check if a service is responding
check_service() {
    local name=$1
    local url=$2
    local expected_content=$3

    if curl -s --connect-timeout 3 "$url" | grep -q "$expected_content"; then
        echo "✅ $name is running correctly"
        return 0
    else
        echo "❌ $name is not responding"
        return 1
    fi
}

# Check Static File Server (port 8080)
check_service "Static File Server" "http://localhost:8080/" "RMT Financial Hub"

# Check Chat Agent (port 3010)
check_service "Chat Agent" "http://localhost:3010/" "Financial Hub Chat Agent"

# Check Backend API (port 3008)
check_service "Backend API" "http://localhost:3008/health" "healthy"

echo ""
echo "Service URLs:"
echo "  🌐 Main Hub: http://localhost:8080/"
echo "  💰 Revenue Dashboard: http://localhost:8080/revenue-dashboard.html"
echo "  📊 Expense Dashboard: http://localhost:8080/expense-dashboard.html"
echo "  🤖 Chat Agent: http://localhost:3010/"