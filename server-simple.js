import express from 'express';
import path from 'path';
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
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
    res.sendStatus(200);
});

// Authentication endpoint
app.post('/api/login', (req, res) => {
    console.log('Login attempt received:', req.body);

    const { username, password } = req.body;

    // Simple authentication
    const users = {
        'admin': { password: 'password', role: 'admin' },
        'user': { password: 'password', role: 'user' }
    };

    if (users[username] && users[username].password === password) {
        console.log('Login successful for:', username);
        res.json({
            success: true,
            token: 'demo-token-' + Date.now(),
            user: {
                username: username,
                role: users[username].role
            }
        });
    } else {
        console.log('Login failed for:', username);
        res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve index.html for root (main margin dashboard)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});