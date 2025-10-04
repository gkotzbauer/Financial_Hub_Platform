import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractExcelData() {
    const publicDir = path.join(__dirname, 'public');
    const files = [
        'expense-analysis.xlsx',
        'Financial Performance Data.xlsx',
        'Status Summary Source File.xlsx'
    ];

    const extractedData = {};

    files.forEach(filename => {
        console.log(`\n=== Processing ${filename} ===`);

        try {
            const filepath = path.join(publicDir, filename);
            const workbook = XLSX.readFile(filepath);

            console.log(`Sheet names: ${workbook.SheetNames.join(', ')}`);

            const fileData = {};

            workbook.SheetNames.forEach(sheetName => {
                console.log(`\n--- Sheet: ${sheetName} ---`);

                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                console.log(`Rows: ${jsonData.length}`);
                if (jsonData.length > 0) {
                    console.log(`Columns: ${jsonData[0].length}`);
                    console.log('First few rows:');
                    jsonData.slice(0, 5).forEach((row, idx) => {
                        console.log(`  Row ${idx}: ${JSON.stringify(row)}`);
                    });
                }

                fileData[sheetName] = jsonData;
            });

            extractedData[filename] = fileData;

        } catch (error) {
            console.error(`Error processing ${filename}:`, error.message);
        }
    });

    // Save extracted data
    const outputFile = path.join(__dirname, 'extracted-excel-data.json');
    fs.writeFileSync(outputFile, JSON.stringify(extractedData, null, 2));
    console.log(`\nExtracted data saved to: ${outputFile}`);

    return extractedData;
}

// Run the extraction
extractExcelData();