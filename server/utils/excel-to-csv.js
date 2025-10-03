const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Convert Excel files to CSV format
 * Each sheet in the Excel file will be converted to a separate CSV file
 */
function convertExcelToCSV(inputPath, outputDir) {
    try {
        // Read the Excel file
        const workbook = XLSX.readFile(inputPath);
        const baseFileName = path.basename(inputPath, path.extname(inputPath));

        console.log(`\nProcessing: ${baseFileName}`);
        console.log(`Sheets found: ${workbook.SheetNames.join(', ')}`);

        const csvFiles = [];

        // Process each sheet
        workbook.SheetNames.forEach((sheetName, index) => {
            const worksheet = workbook.Sheets[sheetName];

            // Convert to CSV
            const csvData = XLSX.utils.sheet_to_csv(worksheet);

            // Create filename (sanitize sheet name for filesystem)
            const sanitizedSheetName = sheetName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const csvFileName = workbook.SheetNames.length > 1
                ? `${baseFileName}_${sanitizedSheetName}.csv`
                : `${baseFileName}.csv`;

            const csvPath = path.join(outputDir, csvFileName);

            // Write CSV file
            fs.writeFileSync(csvPath, csvData);
            csvFiles.push(csvPath);

            // Count rows for logging
            const rowCount = csvData.split('\n').length - 1;
            console.log(`  ✓ Sheet "${sheetName}" → ${csvFileName} (${rowCount} rows)`);
        });

        return csvFiles;
    } catch (error) {
        console.error(`Error converting ${inputPath}:`, error.message);
        throw error;
    }
}

/**
 * Convert all Excel files in the project to CSV format
 */
function convertAllExcelFiles() {
    // Create CSV output directory
    const csvDir = path.join(__dirname, '..', 'data', 'csv');
    if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
    }

    console.log('Starting Excel to CSV conversion...');
    console.log(`Output directory: ${csvDir}\n`);

    // List of Excel files to convert
    const excelFiles = [
        {
            path: 'server/data/P&L expense processed data through June 2025 v2.xlsx',
            name: 'P&L Expense Data'
        },
        {
            path: 'public/Summary RMT Rev & Expense Data for Dashboard.xlsx',
            name: 'Summary Dashboard Data'
        },
        {
            path: 'public/Financial Performance Data.xlsx',
            name: 'Financial Performance'
        },
        {
            path: 'public/Status Summary Source File.xlsx',
            name: 'Status Summary'
        },
        {
            path: 'public/expense-analysis.xlsx',
            name: 'Expense Analysis'
        },
        {
            path: 'public/P&L Assignments.xlsx',
            name: 'P&L Assignments'
        }
    ];

    const convertedFiles = [];

    excelFiles.forEach(file => {
        const fullPath = path.join(__dirname, '..', '..', file.path);
        if (fs.existsSync(fullPath)) {
            try {
                const csvFiles = convertExcelToCSV(fullPath, csvDir);
                convertedFiles.push({
                    source: file.name,
                    files: csvFiles
                });
            } catch (error) {
                console.error(`Failed to convert ${file.name}`);
            }
        } else {
            console.log(`⚠ File not found: ${file.path}`);
        }
    });

    console.log('\n========================================');
    console.log(`Conversion complete! ${convertedFiles.length} Excel files processed`);
    console.log(`CSV files saved to: ${csvDir}`);

    return convertedFiles;
}

// Export functions
module.exports = {
    convertExcelToCSV,
    convertAllExcelFiles
};

// Run if called directly
if (require.main === module) {
    convertAllExcelFiles();
}