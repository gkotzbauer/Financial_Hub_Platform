import express from 'express';
import path from 'path';
import fs from 'fs';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Authentication endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Simple authentication (in production, use proper authentication)
    const users = {
        'admin': { password: 'password', role: 'admin' },
        'user': { password: 'password', role: 'user' }
    };

    if (users[username] && users[username].password === password) {
        res.json({
            success: true,
            token: 'demo-token-' + Date.now(),
            role: users[username].role,
            username: username
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }
});

// File upload endpoint
app.post('/api/upload', (req, res) => {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, 'uploads');
    form.keepExtensions = true;

    if (!fs.existsSync(form.uploadDir)) {
        fs.mkdirSync(form.uploadDir, { recursive: true });
    }

    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        const file = files.file;
        if (!file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        try {
            // Process Excel file
            const workbook = xlsx.readFile(file.filepath);
            const sheetName = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

            // Save as JSON for quick access
            const dataPath = path.join(__dirname, 'data', fields.type === 'revenue' ? 'revenue-data.json' : 'expense-data.json');
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

            res.json({
                success: true,
                message: 'File uploaded and processed successfully',
                recordCount: data.length
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to process file: ' + error.message
            });
        }
    });
});

// Import financial query engine and dashboard metric mapper
import FinancialDataQuery from './server/utils/financial-data-query.js';
import DashboardMetricMapper from './server/utils/dashboard-metric-mapper.js';

// Initialize engines
const financialQueryEngine = new FinancialDataQuery();
const metricMapper = new DashboardMetricMapper();

// Data endpoints
app.get('/api/revenue-data', (req, res) => {
    const dataPath = path.join(__dirname, 'data', 'revenue-data.json');
    if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        res.json(data);
    } else {
        res.json([]);
    }
});

app.get('/api/expense-data', (req, res) => {
    const dataPath = path.join(__dirname, 'data', 'expense-data.json');
    if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        res.json(data);
    } else {
        res.json([]);
    }
});

// Financial query endpoint for chatbot
app.post('/api/financial-query', (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // First try metric breakdown queries
        const metricResult = metricMapper.processMetricQuery(query);
        if (metricResult) {
            const formattedResponse = metricMapper.formatMetricBreakdownResponse(metricResult);
            return res.json({
                success: true,
                query: query,
                type: 'metric_breakdown',
                result: metricResult,
                formattedResponse: formattedResponse
            });
        }

        // Fall back to general financial queries
        const result = financialQueryEngine.parseAndQuery(query);
        const formattedResponse = financialQueryEngine.formatResponseForChat(result);

        res.json({
            success: true,
            query: query,
            type: 'financial_data',
            result: result,
            formattedResponse: formattedResponse
        });
    } catch (error) {
        console.error('Error processing financial query:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process financial query'
        });
    }
});

// Metric breakdown endpoint
app.post('/api/metric-breakdown', (req, res) => {
    try {
        const { metricName } = req.body;
        if (!metricName) {
            return res.status(400).json({ error: 'Metric name is required' });
        }

        const result = metricMapper.processMetricQuery(`What makes up ${metricName}?`);
        if (result) {
            const formattedResponse = metricMapper.formatMetricBreakdownResponse(result);
            res.json({
                success: true,
                metricName: metricName,
                result: result,
                formattedResponse: formattedResponse
            });
        } else {
            res.json({
                success: false,
                error: `Metric "${metricName}" not found or breakdown not available`
            });
        }
    } catch (error) {
        console.error('Error processing metric breakdown:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process metric breakdown'
        });
    }
});

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/expense-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'expense-dashboard.html'));
});

app.get('/revenue-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'revenue-dashboard.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 RMT Analytics Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🔐 Login: http://localhost:${PORT}/login`);
    console.log(`\nDemo Credentials:`);
    console.log(`  Admin: admin / password`);
    console.log(`  User: user / password`);
});