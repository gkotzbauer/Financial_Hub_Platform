# RMT Financial Hub

## Service Architecture

### Core Services
- **Port 8080**: Static File Server (Python) - Serves main hub and dashboards
- **Port 3010**: Chat Agent (Node.js) - AI-powered financial data queries
- **Port 3008**: Backend API (Node.js) - Data processing and authentication

### Access URLs
- **Main Hub**: http://localhost:8080/
- **Revenue Dashboard**: http://localhost:8080/revenue-dashboard.html
- **Expense Dashboard**: http://localhost:8080/expense-dashboard.html
- **Chat Agent**: http://localhost:3010/

## Management Scripts

### Start All Services
```bash
./start-financial-hub.sh
```

### Stop All Services
```bash
./stop-financial-hub.sh
```

### Health Check
```bash
./check-financial-hub.sh
```

## Important Notes

⚠️ **DO NOT modify these files without explicit request:**
- `revenue-analysis/index.html` - Contains embedded revenue data
- `expense-dashboard.html` - Main expense analytics dashboard
- `chat-agent/` directory - AI agent system

⚠️ **Always use port 8080 for dashboard access, not 3008**
- Port 3008 = Backend API only (no static files)
- Port 8080 = Dashboard files served correctly

## Troubleshooting

If dashboards show no data:
1. Check you're using port 8080, not 3008
2. Run `./check-financial-hub.sh` to verify services
3. Restart with `./stop-financial-hub.sh && ./start-financial-hub.sh`

## File Structure
```
expense_management_analytics-RMT-v2/
├── start-financial-hub.sh     # Start all services
├── stop-financial-hub.sh      # Stop all services
├── check-financial-hub.sh     # Health check
├── revenue-analysis/           # Revenue dashboard files
├── chat-agent/                 # AI chat system
├── expense-dashboard.html      # Expense analytics
└── revenue-dashboard.html      # Revenue entry point
```