# Render Deployment Guide

## 🚀 Deploying to Render

### Prerequisites
1. Render account (free at render.com)
2. GitHub repository connected to Render

### Deployment Steps

#### 1. **Connect to Render**
- Go to [render.com](https://render.com)
- Sign up/Login with your GitHub account
- Click "New +" → "Static Site"

#### 2. **Connect Repository**
- **Repository**: `gkotzbauer/Revenue_Performance_Analysis`
- **Branch**: `main`
- **Root Directory**: Leave empty (root of repo)

#### 3. **Configure Build Settings**
- **Name**: `revenue-performance-dashboard` (or your preferred name)
- **Environment**: `Static Site`
- **Build Command**: Leave empty (not needed for static site)
- **Publish Directory**: Leave empty (root directory)

#### 4. **Advanced Settings** (Optional)
- **Auto-Deploy**: ✅ Enabled (recommended)
- **Branch**: `main`

#### 5. **Deploy**
- Click "Create Static Site"
- Render will automatically deploy your site

### 🎯 Render Configuration

The `render.yaml` file provides:
- ✅ **Static site configuration**
- ✅ **Data file routing** (`/data/*`)
- ✅ **API routing** (`/api/*`)
- ✅ **CORS headers** for data access
- ✅ **Cache control** for fresh data

### 📁 File Structure for Render
```
Revenue_Performance_Analysis/
├── index.html              # Main dashboard
├── data/                   # Data files (served statically)
│   ├── revenue-data.xlsx   # Primary data source
│   └── revenue-data.json   # Fallback data source
├── api/                    # API endpoints (if needed)
├── render.yaml            # Render configuration
└── package.json           # Dependencies
```

### 🔧 Render vs Vercel Differences

| Feature | Render | Vercel |
|---------|--------|--------|
| **Static Files** | ✅ Excellent | ⚠️ Sometimes problematic |
| **Data File Serving** | ✅ Reliable | ❌ Can be unreliable |
| **CORS Support** | ✅ Built-in | ⚠️ Requires configuration |
| **Deployment Speed** | ✅ Fast | ✅ Fast |
| **Free Tier** | ✅ Generous | ✅ Generous |

### 🚨 Troubleshooting

#### Data Files Not Loading
1. **Check file paths**: Ensure `data/` folder is in repository
2. **Verify permissions**: Files should be readable
3. **Check browser console**: Look for CORS errors
4. **Test direct access**: Try `your-render-url.com/data/revenue-data.xlsx`

#### Build Errors
1. **No build required**: This is a static site
2. **Check render.yaml**: Ensure configuration is correct
3. **Verify repository**: Make sure all files are committed

#### CORS Issues
1. **Headers configured**: `render.yaml` includes CORS headers
2. **Test with curl**: `curl -I your-render-url.com/data/revenue-data.xlsx`
3. **Check browser**: Open developer tools and check Network tab

### 🔄 Update Process

#### For Data Updates:
```bash
# Update your local files
git add data/revenue-data.xlsx
git commit -m "Update revenue data"
git push origin main
# Render will auto-deploy
```

#### For Code Updates:
```bash
# Same process as data updates
git add .
git commit -m "Update dashboard code"
git push origin main
```

### 🌐 Your Render URL
After deployment, your dashboard will be available at:
`https://revenue-performance-dashboard.onrender.com`

### 💡 Best Practices

1. **Test Locally First**: Always test with `node server.js` before pushing
2. **Use Git for Updates**: Update data files through GitHub
3. **Monitor Deployments**: Check Render dashboard for deployment status
4. **Backup Data**: Keep local copies of important data files

### 🔍 Testing Your Deployment

1. **Main Dashboard**: `https://your-render-url.com/`
2. **Data Test Page**: `https://your-render-url.com/data-test.html`
3. **Health API**: `https://your-render-url.com/api/health`
4. **Direct Data Access**: `https://your-render-url.com/data/revenue-data.xlsx`

### 📊 Expected Behavior

- ✅ **Excel files load first** (primary data source)
- ✅ **JSON files as fallback** (if Excel fails)
- ✅ **Embedded data as safety net** (if both fail)
- ✅ **Admin panel works** (with file upload limitations)
- ✅ **All charts and filters function** normally

### 🎉 Success Indicators

- Dashboard loads without errors
- Data files are accessible via direct URLs
- Charts display real data (not embedded sample data)
- Admin panel is accessible (with `?admin=true`)
- Export functionality works correctly 