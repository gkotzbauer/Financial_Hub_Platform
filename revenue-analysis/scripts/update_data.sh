#!/bin/bash
# Update Data Script for Revenue Performance Dashboard
# Automatically converts Excel files to JSON format

echo "🔄 Revenue Performance Dashboard - Data Update Script"
echo "=================================================="

# Check if Python is available
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Python is not installed. Please install Python 3.7+ and try again."
    exit 1
fi

# Check if required packages are installed
echo "📦 Checking Python dependencies..."
$PYTHON_CMD -c "import pandas, numpy" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  Required packages not found. Installing..."
    $PYTHON_CMD -m pip install pandas numpy openpyxl
fi

# Default file paths
INPUT_FILE="data/revenue-data.xlsx"
OUTPUT_FILE="data/revenue-data.json"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Input file not found: $INPUT_FILE"
    echo "Please place your Excel file in the data folder as 'revenue-data.xlsx'"
    exit 1
fi

echo "📊 Processing data file: $INPUT_FILE"
echo "💾 Output will be saved to: $OUTPUT_FILE"
echo ""

# Run the Python adapter
$PYTHON_CMD scripts/universal_data_adapter.py "$INPUT_FILE" "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Data update completed successfully!"
    echo "Your web app is now ready to use the updated data."
    echo ""
    echo "💡 To update data in the future:"
    echo "   1. Replace $INPUT_FILE with your new Excel file"
    echo "   2. Run: ./scripts/update_data.sh"
    echo "   3. The web app will automatically use the new data"
else
    echo ""
    echo "❌ Data update failed. Please check the error messages above."
    exit 1
fi



