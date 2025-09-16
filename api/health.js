import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dataDir = path.join(process.cwd(), 'data');
    const excelPath = path.join(dataDir, 'revenue-data.xlsx');
    const jsonPath = path.join(dataDir, 'revenue-data.json');

    const excelExists = fs.existsSync(excelPath);
    const jsonExists = fs.existsSync(jsonPath);

    const excelStats = excelExists ? fs.statSync(excelPath) : null;
    const jsonStats = jsonExists ? fs.statSync(jsonPath) : null;

    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      dataFiles: {
        excel: {
          exists: excelExists,
          path: excelPath,
          size: excelStats ? excelStats.size : null,
          lastModified: excelStats ? excelStats.mtime : null
        },
        json: {
          exists: jsonExists,
          path: jsonPath,
          size: jsonStats ? jsonStats.size : null,
          lastModified: jsonStats ? jsonStats.mtime : null
        }
      },
      urls: {
        excel: '/data/revenue-data.xlsx',
        json: '/data/revenue-data.json',
        test: '/data-test.html'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
} 