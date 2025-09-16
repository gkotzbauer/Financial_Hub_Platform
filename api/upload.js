import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(process.cwd(), 'data');
    form.keepExtensions = true;
    form.maxFileSize = 50 * 1024 * 1024; // 50MB limit

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      const file = files.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Move file to data folder with correct name
      const newPath = path.join(process.cwd(), 'data', 'revenue-data.xlsx');
      fs.renameSync(file.filepath, newPath);

      res.status(200).json({ 
        success: true, 
        message: 'File uploaded successfully',
        filename: 'revenue-data.xlsx'
      });
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 