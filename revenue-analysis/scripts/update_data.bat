@echo off
REM Update Data Script for Revenue Performance Dashboard
REM Automatically converts Excel files to JSON format

echo 🔄 Revenue Performance Dashboard - Data Update Script
echo ==================================================

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python 3.7+ and try again.
    pause
    exit /b 1
)

REM Check if required packages are installed
echo 📦 Checking Python dependencies...
python -c "import pandas, numpy" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Required packages not found. Installing...
    python -m pip install pandas numpy openpyxl
)

REM Default file paths
set INPUT_FILE=data\revenue-data.xlsx
set OUTPUT_FILE=data\revenue-data.json

REM Check if input file exists
if not exist "%INPUT_FILE%" (
    echo ❌ Input file not found: %INPUT_FILE%
    echo Please place your Excel file in the data folder as 'revenue-data.xlsx'
    pause
    exit /b 1
)

echo 📊 Processing data file: %INPUT_FILE%
echo 💾 Output will be saved to: %OUTPUT_FILE%
echo.

REM Run the Python adapter
python scripts\universal_data_adapter.py "%INPUT_FILE%" "%OUTPUT_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Data update completed successfully!
    echo Your web app is now ready to use the updated data.
    echo.
    echo 💡 To update data in the future:
    echo    1. Replace %INPUT_FILE% with your new Excel file
    echo    2. Run: scripts\update_data.bat
    echo    3. The web app will automatically use the new data
) else (
    echo.
    echo ❌ Data update failed. Please check the error messages above.
    pause
    exit /b 1
)

pause



