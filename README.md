# Margin Performance Analysis Dashboard

A comprehensive dashboard for analyzing urgent care revenue performance with actionable insights and recommendations.

## Features

- 📊 **Margin Analysis** - Visual breakdown of over/under performing weeks
- 💰 **Margin Opportunity Tracking** - Identify missed revenue and gains
- 🎯 **Actionable Recommendations** - AI-powered suggestions for improvement
- 📈 **Trend Analysis** - 6-month revenue performance tracking
- 📋 **Detailed Weekly Reports** - Comprehensive performance breakdowns
- 📤 **Excel Export** - Download filtered results for further analysis
- 🔧 **Admin Panel** - Upload new data files (admin access required)

## Quick Start

### Option 1: Simple Test Server (Recommended for Testing)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the test server:**
   ```bash
   npm run test-server
   ```

3. **Open your browser:**
   - Dashboard: http://localhost:3000
   - Admin Panel: http://localhost:3000?admin=true

### Option 2: Development Mode (Vite)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   - Dashboard: http://localhost:5173
   - Admin Panel: http://localhost:5173?admin=true

## Data Sources

The dashboard automatically loads data from multiple sources in this order:

1. **Excel File** (`data/revenue-data.xlsx`) - Primary data source for updates
2. **JSON File** (`data/revenue-data.json`) - Fallback data source  
3. **Embedded Data** - Built-in sample data for testing

## Admin Features

To access admin features, add `?admin=true` to the URL or set `localStorage.setItem('isAdmin', 'true')` in browser console.

Admin features include:
- Upload new data files
- Update dashboard data for all users
- Access to advanced configuration options

## Data Format

The dashboard expects Excel files with the following columns:

- **Year** - Year of the data
- **Week** - Week number
- **Visit Count** - Number of patient visits
- **Total Payments** - Actual revenue collected
- **Predicted Payments** - Expected revenue
- **Performance Diagnostic** - Over/Average/Under Performed
- **What Went Well** - Positive performance factors
- **What Can Be Improved** - Areas for improvement
- **Aetna Analysis** - Aetna-specific insights
- **BCBS Analysis** - BCBS-specific insights

## Export Features

- **Excel Export** - Download filtered results as Excel file
- **Summary Sheets** - Performance metrics and missed revenue calculations
- **Detailed Analysis** - Complete dataset with all insights

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Troubleshooting

### Server Issues
- Ensure port 3000 is available
- Check that all dependencies are installed
- Verify Node.js version 14+ is installed

### Data Loading Issues
- Check browser console for error messages
- Verify data file format matches expected structure
- Ensure data files are in the correct location

### Admin Access Issues
- Add `?admin=true` to URL
- Clear browser cache and cookies
- Check browser console for JavaScript errors

## Version History

- **v4.1** - Enhanced debugging, improved data loading, better error handling
- **v4.0** - Added admin panel, Excel export, performance improvements
- **v3.0** - Added embedded data, improved UI/UX
- **v2.0** - Added filtering and chart enhancements
- **v1.0** - Initial release with basic dashboard functionality

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify data file format and location
3. Ensure all dependencies are properly installed
4. Try refreshing the page or clearing browser cache
