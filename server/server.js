const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Enable CORS for frontend requests
app.use(cors({
  origin: ['http://localhost:3002', 'http://localhost:3000'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Session configuration
app.use(session({
  secret: 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// User management (in production, use a proper database)
const users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@company.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: "password"
    role: 'admin'
  },
  {
    id: 2,
    username: 'user',
    email: 'user@company.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: "password"
    role: 'user'
  }
];

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token.' });
  }
};

// Serve static files from the data directory
app.use('/data', express.static(path.join(__dirname, 'data')));

// Serve revenue analysis static files
app.use('/revenue-analysis', express.static(path.join(__dirname, '../revenue-analysis')));

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    // Find user by username or email
    const user = users.find(u => u.username === username || u.email === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: rememberMe ? '7d' : '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  // In a real app, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' });
});

// API endpoint to get the Excel file - dynamically finds any Excel file
app.get('/api/data', authenticateToken, (req, res) => {
  const dataDir = path.join(__dirname, 'data');
  
  // Check if data directory exists
  if (!fs.existsSync(dataDir)) {
    return res.status(404).json({ error: 'Data directory not found' });
  }
  
  // Find Excel files in the data directory
  const files = fs.readdirSync(dataDir);
  const excelFiles = files.filter(file => 
    file.endsWith('.xlsx') || file.endsWith('.xls')
  ).filter(file => 
    !file.startsWith('~$') // Exclude temporary Excel files
  );
  
  if (excelFiles.length === 0) {
    return res.status(404).json({ error: 'No Excel files found in data directory' });
  }
  
  // Use the first Excel file found
  const fileName = excelFiles[0];
  const filePath = path.join(dataDir, fileName);
  
  console.log(`Serving Excel file: ${fileName}`);
  
  // Set cache-busting headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  
  // Send the file
  res.sendFile(filePath);
});

// API endpoint to list available files
app.get('/api/files', authenticateToken, (req, res) => {
  const dataDir = path.join(__dirname, 'data');
  
  if (!fs.existsSync(dataDir)) {
    return res.status(404).json({ error: 'Data directory not found' });
  }
  
  const files = fs.readdirSync(dataDir);
  const excelFiles = files.filter(file => 
    file.endsWith('.xlsx') || file.endsWith('.xls')
  ).filter(file => 
    !file.startsWith('~$')
  );
  
  res.json({ files: excelFiles });
});



// API endpoint to get the Financial Performance Data file
app.get('/api/financial-performance', authenticateToken, (req, res) => {
  const publicDir = path.join(__dirname, '..', 'public');
  const filePath = path.join(publicDir, 'Financial Performance Data.xlsx');
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Financial Performance Data file not found' });
  }
  
  console.log(`Serving Financial Performance Data file: Financial Performance Data.xlsx`);
  
  // Set cache-busting headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  
  // Send the file
  res.sendFile(filePath);
});

// Revenue analysis routes
app.get('/revenue-analysis', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../revenue-analysis/index.html'));
});

// Serve revenue analysis data
app.get('/revenue-analysis/data/*', authenticateToken, (req, res) => {
  const filePath = path.join(__dirname, '../revenue-analysis', req.path.replace('/revenue-analysis', ''));
  res.sendFile(filePath);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server is running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Excel file available at: http://localhost:${PORT}/api/data`);
}); 