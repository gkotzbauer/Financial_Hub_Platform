# Data Update Guide for Revenue Performance Dashboard

This guide explains how to update your source data files without breaking the web app.

## 🎯 Problem Solved

Previously, updating source files would break the web app because:
- Column names changed
- Data structure was different
- Required columns were missing

**Now you can update any Excel file without worrying about breaking the web app!**

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Python packages
pip install -r requirements.txt

# Or install individually
pip install pandas numpy openpyxl
```

### 2. Update Your Data

**Option A: Simple (Recommended)**
```bash
# Mac/Linux
./scripts/update_data.sh

# Windows
scripts\update_data.bat
```

**Option B: Direct Python**
```bash
python scripts/universal_data_adapter.py
```

**Option C: Custom Files**
```bash
python scripts/universal_data_adapter.py "new-data.xlsx" "data/revenue-data.json"
```

## 📁 File Structure

```
scripts/
├── universal_data_adapter.py    # Main Python adapter
├── update_data.sh              # Mac/Linux convenience script
├── update_data.bat             # Windows convenience script
└── excel-to-json.js            # Original JavaScript converter

data/
├── revenue-data.xlsx           # Your source Excel file
└── revenue-data.json           # Generated JSON for web app

requirements.txt                 # Python dependencies
```

## 🔧 How It Works

The `universal_data_adapter.py` script:

1. **Loads your Excel file** (any format, any column names)
2. **Maps columns automatically** (handles common naming variations)
3. **Adds missing columns** (with sensible defaults)
4. **Calculates derived columns** (performance metrics, etc.)
5. **Validates data structure** (ensures web app compatibility)
6. **Outputs perfect JSON** (exactly what the web app expects)

## 📊 Column Mapping

The script automatically maps common column variations:

| Source Column | Target Column |
|---------------|---------------|
| `Year of Visit Service Date` | `Year` |
| `ISO Week of Visit Service Date` | `Week` |
| `Total Visits` | `Visit Count` |
| `Payment Amount` | `Payment Amount*` |
| `Collection Rate` | `Collection Rate*` |
| `Expected Revenue` | `Expected Payments` |
| `Revenue Gap` | `Missed Revenue (RF)` |

## 🎯 Expected Columns

The web app expects these columns (automatically created if missing):

### Core Metrics
- `Year`, `Week`, `Visit Count`
- `Charge Amount`, `Payment Amount*`
- `Collection Rate*`, `Zero Balance Collection Rate`

### Performance Metrics
- `Expected Payments`, `Missed Revenue (RF)`
- `Performance Diagnostic`, `% Error`
- `Over Performed`, `Under Performed`, `Average Performance`

### Derived Metrics
- `NRV Gap ($)`, `NRV Gap (%)`, `NRV Gap Sum ($)`
- `% of Remaining Charges`
- `Volume Without Revenue Lift`

### Narrative Fields
- `Operational - What Went Well`
- `Operational - What Can Be Improved`
- `Revenue Cycle - What Went Well`
- `Revenue Cycle - What Can Be Improved`
- `Zero-Balance Collection Narrative`

## 📝 Usage Examples

### Basic Update
```bash
# 1. Replace your Excel file
cp "new-revenue-data.xlsx" "data/revenue-data.xlsx"

# 2. Run the update script
./scripts/update_data.sh

# 3. Your web app now uses the new data!
```

### Custom File Names
```bash
# Process any Excel file to any JSON file
python scripts/universal_data_adapter.py "my-data.xlsx" "output.json"
```

### Batch Processing
```bash
# Process multiple files
for file in data/*.xlsx; do
    python scripts/universal_data_adapter.py "$file" "data/$(basename "$file" .xlsx).json"
done
```

## 🐛 Troubleshooting

### Python Not Found
```bash
# Install Python 3.7+
# Download from: https://python.org/downloads/
```

### Missing Packages
```bash
# Install required packages
pip install pandas numpy openpyxl

# Or upgrade existing packages
pip install --upgrade pandas numpy openpyxl
```

### Permission Denied (Mac/Linux)
```bash
# Make scripts executable
chmod +x scripts/update_data.sh
chmod +x scripts/universal_data_adapter.py
```

### File Not Found
- Ensure your Excel file is in the `data/` folder
- Check the file name matches exactly
- Verify the file isn't corrupted

## 🔄 Automation

### Cron Job (Mac/Linux)
```bash
# Update data every Monday at 9 AM
0 9 * * 1 cd /path/to/your/repo && ./scripts/update_data.sh
```

### GitHub Actions
```yaml
name: Update Data
on:
  push:
    paths: ['data/*.xlsx']
jobs:
  update-json:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - run: pip install -r requirements.txt
      - run: python scripts/universal_data_adapter.py
      - run: git config user.name "GitHub Action"
      - run: git config user.email "action@github.com"
      - run: git add data/revenue-data.json
      - run: git commit -m "Auto-update JSON data" || exit 0
      - run: git push
```

## 📈 Benefits

✅ **No More Web App Breaks** - Column changes won't affect your dashboard  
✅ **Automatic Column Mapping** - Handles common naming variations  
✅ **Missing Column Generation** - Adds required columns with defaults  
✅ **Data Validation** - Ensures output always matches expected structure  
✅ **Zero Web App Changes** - Your HTML/JavaScript code stays the same  
✅ **Multiple Options** - Python, shell scripts, or batch files  
✅ **Easy Automation** - Set up cron jobs or GitHub Actions  

## 🆘 Need Help?

1. **Check the console output** - The script provides detailed logging
2. **Verify file paths** - Ensure files are in the correct locations
3. **Check Python version** - Ensure you have Python 3.7+
4. **Install dependencies** - Run `pip install -r requirements.txt`

## 🎉 Success!

Once you run the update script successfully:

1. Your web app will automatically use the new data
2. All charts and tables will update
3. No code changes are needed
4. You can update data anytime without worry

**Happy data updating! 🚀**



