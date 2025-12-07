import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve data folder specifically
app.use('/data', express.static(path.join(__dirname, 'data')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle admin route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Specific routes for data files
app.get('/data/revenue-data.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'data', 'revenue-data.json'));
});

app.get('/data/revenue-data.xlsx', (req, res) => {
    res.sendFile(path.join(__dirname, 'data', 'revenue-data.xlsx'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        dataFile: '/data/revenue-data.xlsx'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    console.log(`🔧 Admin panel available at http://localhost:${PORT}?admin=true`);
    console.log(`📁 Data file available at:`);
    console.log(`   - http://localhost:${PORT}/data/revenue-data.xlsx`);
    console.log(`💡 Press Ctrl+C to stop the server`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    process.exit(0);
}); 