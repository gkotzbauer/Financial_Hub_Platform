# RMT Financial Hub - User Guide

## Quick Start

### Access Your Financial Hub
**Always use port 8080 for the dashboard:**
- **Main Hub**: http://localhost:8080/
- **Revenue Dashboard**: http://localhost:8080/revenue-dashboard.html
- **Expense Dashboard**: http://localhost:8080/expense-dashboard.html
- **Chat Agent**: http://localhost:3010/

## Daily Operations

### Starting the Financial Hub
```bash
cd /Users/kotzbauer/expense_management_analytics-RMT-v2
./start-financial-hub.sh
```

This command:
- Cleans up any duplicate processes
- Starts all required services
- Shows you the access URLs

### Stopping the Financial Hub
```bash
cd /Users/kotzbauer/expense_management_analytics-RMT-v2
./stop-financial-hub.sh
```

### Checking Service Health
```bash
cd /Users/kotzbauer/expense_management_analytics-RMT-v2
./check-financial-hub.sh
```

**What you'll see when everything is working:**
```
🔍 Checking RMT Financial Hub services...
✅ Static File Server is running correctly
✅ Chat Agent is running correctly
✅ Backend API is running correctly

Service URLs:
  🌐 Main Hub: http://localhost:8080/
  💰 Revenue Dashboard: http://localhost:8080/revenue-dashboard.html
  📊 Expense Dashboard: http://localhost:8080/expense-dashboard.html
  🤖 Chat Agent: http://localhost:3010/
```

If any service shows ❌, run `./stop-financial-hub.sh` then `./start-financial-hub.sh` to restart.

## Understanding the Services

### Port Assignments (DO NOT CHANGE)
- **Port 8080**: Static file server for dashboards (Python)
- **Port 3010**: AI Chat Agent for data queries (Node.js)
- **Port 3008**: Backend API for data processing (Node.js)

### Common Mistake to Avoid
❌ **WRONG**: http://localhost:3008/revenue-dashboard.html
✅ **CORRECT**: http://localhost:8080/revenue-dashboard.html

Port 3008 is ONLY for API calls, not for viewing dashboards!

## Troubleshooting

### Problem: Dashboard shows no data
**Solution:**
1. Check you're using http://localhost:8080/ (not 3008)
2. Run `./check-financial-hub.sh` to verify all services are running
3. If any service shows ❌, restart everything:
   ```bash
   ./stop-financial-hub.sh
   ./start-financial-hub.sh
   ```

### Problem: "Cannot GET /" error
**Cause:** You're using the wrong port (probably 3008)
**Solution:** Use http://localhost:8080/ instead

### Problem: Multiple duplicate processes running
**Solution:**
```bash
./stop-financial-hub.sh
./start-financial-hub.sh
```
The start script automatically cleans up duplicates.

### Problem: Chat agent not responding
**Solution:** Check if it's running on port 3010:
```bash
./check-financial-hub.sh
```
If not running, restart all services.

## Features Overview

### Main Financial Hub (http://localhost:8080/)
- Navigation portal to all analytics modules
- Clean, professional interface
- Quick access buttons to both dashboards

### Revenue Performance Dashboard
- **Access**: http://localhost:8080/revenue-dashboard.html
- **Features**:
  - Revenue trend analysis
  - Performance metrics tracking
  - Year-over-year comparisons
  - Cashflow projections
  - Visit count analysis
  - Interactive charts with Chart.js

### Expense Management Dashboard
- **Access**: http://localhost:8080/expense-dashboard.html
- **Features**:
  - Real-time expense tracking
  - Margin risk assessment
  - Cost trend analysis
  - Marketing spend efficiency
  - Expense growth alignment
  - Category-based analytics

### AI Chat Agent
- **Access**: http://localhost:3010/
- **Features**:
  - Natural language queries about your data
  - Smart entity recognition (insurance companies, performance categories)
  - Contextual data insights
  - Query examples:
    - "Show me Aetna operational improvements"
    - "How many weeks were over performed?"
    - "List all scenarios with BCBS"

## Important Files - DO NOT MODIFY

These files contain critical embedded data and configurations:
- `revenue-analysis/index.html` - Contains all revenue data
- `expense-dashboard.html` - Main expense analytics
- `chat-agent/` directory - AI system files

## Daily Workflow

### Morning Startup
1. Open Terminal
2. Navigate to project:
   ```bash
   cd /Users/kotzbauer/expense_management_analytics-RMT-v2
   ```
3. Start services:
   ```bash
   ./start-financial-hub.sh
   ```
4. Open browser to http://localhost:8080/

### End of Day Shutdown
1. Open Terminal
2. Navigate to project:
   ```bash
   cd /Users/kotzbauer/expense_management_analytics-RMT-v2
   ```
3. Stop services:
   ```bash
   ./stop-financial-hub.sh
   ```

## Quick Reference Card

| Task | Command |
|------|---------|
| Start all services | `./start-financial-hub.sh` |
| Stop all services | `./stop-financial-hub.sh` |
| Check health | `./check-financial-hub.sh` |
| Main Hub | http://localhost:8080/ |
| Revenue Dashboard | http://localhost:8080/revenue-dashboard.html |
| Expense Dashboard | http://localhost:8080/expense-dashboard.html |
| Chat Agent | http://localhost:3010/ |

## Support

If issues persist after following this guide:
1. Check the README-FINANCIAL-HUB.md for technical details
2. Verify all npm dependencies are installed
3. Ensure Python 3 is available for the static file server
4. Check that ports 8080, 3010, and 3008 are not in use by other applications