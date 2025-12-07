# Vercel Deployment Guide

## 🚀 Deploying to Vercel

### Prerequisites
1. Vercel account (free at vercel.com)
2. GitHub repository connected to Vercel

### Deployment Steps

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository: `gkotzbauer/Revenue_Performance_Analysis`

2. **Configure Build Settings**
   - **Framework Preset**: Other
   - **Build Command**: Leave empty (not needed for static site)
   - **Output Directory**: Leave empty (root directory)
   - **Install Command**: `npm install`

3. **Environment Variables** (if needed)
   - No environment variables required for basic deployment

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy your site

### 🎯 Important Notes

#### Data File Handling
- **Static Files**: Vercel serves the `data/` folder as static files
- **File Updates**: To update data files, you must:
  1. Upload new files to your GitHub repository
  2. Redeploy (Vercel will auto-deploy on push)

#### Admin Panel Limitations
- **Local Server**: Full admin functionality with file uploads
- **Vercel**: Admin panel works but file uploads require GitHub updates
- **Workaround**: Use local server for testing, GitHub for production updates

### 🔧 Local vs Vercel Differences

| Feature | Local Server | Vercel |
|---------|-------------|---------|
| **File Uploads** | ✅ Real-time | ❌ Requires GitHub push |
| **Data Updates** | ✅ Immediate | ⏳ After GitHub push |
| **Admin Panel** | ✅ Full functionality | ⚠️ Limited (no file uploads) |
| **Performance** | ✅ Fast | ✅ Fast |
| **Accessibility** | ❌ Local only | ✅ Global access |

### 📁 File Structure for Vercel
```
Revenue_Performance_Analysis/
├── index.html              # Main dashboard
├── data/                   # Data files (served statically)
│   ├── revenue-data.xlsx   # Primary data source
│   └── revenue-data.json   # Fallback data source
├── api/                    # Vercel serverless functions
│   └── upload.js          # File upload handler
├── vercel.json            # Vercel configuration
└── package.json           # Dependencies
```

### 🚨 Troubleshooting

#### Data Not Loading
1. Check that `data/revenue-data.xlsx` exists in your repository
2. Verify file permissions and format
3. Check browser console for CORS errors

#### Admin Panel Not Working
1. Admin panel uploads don't work on Vercel (static hosting limitation)
2. Use local server for testing uploads
3. Update files via GitHub for production

#### Build Errors
1. Ensure all dependencies are in `package.json`
2. Check that `vercel.json` is properly configured
3. Verify file paths are correct

### 🔄 Update Process

1. **For Data Updates**:
   ```bash
   # Update your local files
   git add data/revenue-data.xlsx
   git commit -m "Update revenue data"
   git push origin main
   # Vercel will auto-deploy
   ```

2. **For Code Updates**:
   ```bash
   # Same process as data updates
   git add .
   git commit -m "Update dashboard code"
   git push origin main
   ```

### 🌐 Your Vercel URL
After deployment, your dashboard will be available at:
`https://revenue-performance-analysis-[your-username].vercel.app`

### 💡 Best Practices

1. **Test Locally First**: Always test with `node server.js` before pushing
2. **Use Git for Updates**: Update data files through GitHub, not admin panel
3. **Monitor Deployments**: Check Vercel dashboard for deployment status
4. **Backup Data**: Keep local copies of important data files 