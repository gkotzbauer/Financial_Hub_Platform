import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert CSV file to JSON with proper data typing and processing
 */
function csvToJSON(csvPath, outputPath) {
    return new Promise((resolve, reject) => {
        const results = [];
        const fileName = path.basename(csvPath, '.csv');

        console.log(`Processing: ${fileName}`);

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                // Process and clean the row data
                const processedRow = processRowData(row, fileName);
                if (processedRow) {
                    results.push(processedRow);
                }
            })
            .on('end', () => {
                // Save as JSON
                const jsonData = {
                    source: fileName,
                    lastUpdated: new Date().toISOString(),
                    rowCount: results.length,
                    data: results
                };

                fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
                console.log(`  ✓ Converted to JSON: ${results.length} records`);
                resolve(jsonData);
            })
            .on('error', (error) => {
                console.error(`Error processing ${csvPath}:`, error);
                reject(error);
            });
    });
}

/**
 * Process and clean individual row data based on the source file
 */
function processRowData(row, fileName) {
    // Skip empty rows
    if (Object.values(row).every(val => !val || val.trim() === '')) {
        return null;
    }

    if (fileName.includes('P&L expense')) {
        return processPLExpenseRow(row);
    } else if (fileName.includes('Summary RMT')) {
        return processSummaryRow(row);
    } else if (fileName.includes('Financial Performance')) {
        return processFinancialPerformanceRow(row);
    } else {
        return processGenericRow(row);
    }
}

/**
 * Process P&L expense data specifically
 */
function processPLExpenseRow(row) {
    const category = row['Category'] || '';

    // Skip if no category
    if (!category.trim()) return null;

    return {
        category: category.trim(),
        year: 2025, // Based on file name
        expenses: {
            jan2025: parseFloat(row['Jan 2025']) || 0,
            feb2025: parseFloat(row['Feb 2025']) || 0,
            mar2025: parseFloat(row['Mar 2025']) || 0,
            apr2025: parseFloat(row['Apr 2025']) || 0,
            may2025: parseFloat(row['5/1/25 0:00']) || 0,
            jun2025: parseFloat(row['Jun 2025']) || 0
        },
        analysis: {
            nonzeroMonthCount: parseInt(row['Nonzero Month Count']) || 0,
            oneTimeExpense: row['One Time Expense'] === 'TRUE',
            marginalCostPerDollarGP: parseFloat(row['Marginal Cost per $1 GP']) || 0,
            fixedCostEstimate: parseFloat(row['Fixed Cost Estimate']) || 0,
            rSquaredLinear: parseFloat(row['R² Linear']) || 0,
            elasticity: parseFloat(row['Elasticity (Log-Log)']) || 0,
            modelStatus: row['Model Status'] || '',
            estimatedFutureExpense: parseFloat(row['Estimated Future Expense']) || 0,
            meanJanMayExpense: parseFloat(row['Mean Jan–May Expense']) || 0,
            meanJanJuneExpense: parseFloat(row['Mean Jan–June Expense']) || 0,
            juneVsJanMayAvg: parseFloat(row['June vs Jan–May Avg ($)']) || 0,
            ratioChangeJuneVsMeanPrior: parseFloat(row['Ratio_Change_June_vs_MeanPrior']) || 0,
            expenseVsProfitGrowthRatio: parseFloat(row['Expense vs Profit Growth Ratio']) || 0,
            bestPerforming: row['Best Performing (Cost Decline Rank)'] || '',
            efficiencyAlert: row['Efficiency Alert'] || '',
            elasticityClassification: row['Elasticity Classification'] || '',
            marginRisk: row['Margin Risk'] || '',
            performanceDiagnostic: row['Performance Diagnostic Assignment'] || '',
            marketingSpendEfficiency: row['Marketing Spend Efficiency'] || '',
            rankingPriority: parseInt(row['Ranking Priority']) || 0
        },
        type: determineExpenseType(category)
    };
}

/**
 * Process summary dashboard data
 */
function processSummaryRow(row) {
    return {
        period: row['YOY Rev & Visits'] || '',
        revenue: parseFloat(row['Revenue']) || 0,
        visits: parseInt(row['Visits']) || 0,
        // Add other relevant fields as they appear in the data
        ...row
    };
}

/**
 * Process financial performance data
 */
function processFinancialPerformanceRow(row) {
    return {
        ...row,
        // Convert numeric strings to numbers where appropriate
        ...Object.fromEntries(
            Object.entries(row).map(([key, value]) => {
                const numValue = parseFloat(value);
                return [key, !isNaN(numValue) && value !== '' ? numValue : value];
            })
        )
    };
}

/**
 * Generic row processor for other files
 */
function processGenericRow(row) {
    return {
        ...row,
        // Convert numeric strings to numbers where appropriate
        ...Object.fromEntries(
            Object.entries(row).map(([key, value]) => {
                const numValue = parseFloat(value);
                return [key, !isNaN(numValue) && value !== '' ? numValue : value];
            })
        )
    };
}

/**
 * Determine expense type based on category name
 */
function determineExpenseType(category) {
    const categoryLower = category.toLowerCase();

    if (categoryLower.includes('variable') && categoryLower.includes('operational')) {
        return 'Variable Operational Costs';
    } else if (categoryLower.includes('fixed')) {
        return 'Fixed Costs';
    } else if (categoryLower.includes('medical') || categoryLower.includes('430000')) {
        return 'Medical Services';
    } else if (categoryLower.includes('accounting') || categoryLower.includes('612300')) {
        return 'Professional Services';
    } else if (categoryLower.includes('interest') || categoryLower.includes('617')) {
        return 'Interest Expense';
    } else if (categoryLower.includes('utilities') || categoryLower.includes('610600')) {
        return 'Utilities';
    } else if (categoryLower.includes('dues') || categoryLower.includes('subscriptions')) {
        return 'Dues & Subscriptions';
    } else if (categoryLower.includes('postage') || categoryLower.includes('delivery')) {
        return 'Postage & Delivery';
    } else if (categoryLower.includes('quickbooks') || categoryLower.includes('fees')) {
        return 'Payment Processing Fees';
    } else {
        return 'Other Operating Expenses';
    }
}

/**
 * Convert all CSV files to JSON
 */
async function convertAllCSVToJSON() {
    const csvDir = path.join(__dirname, '..', 'data', 'csv');
    const jsonDir = path.join(__dirname, '..', 'data', 'json');

    // Create JSON output directory
    if (!fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
    }

    console.log('Converting CSV files to JSON...');
    console.log(`Source: ${csvDir}`);
    console.log(`Output: ${jsonDir}\n`);

    // Get all CSV files
    const csvFiles = fs.readdirSync(csvDir).filter(file => file.endsWith('.csv'));

    if (csvFiles.length === 0) {
        console.log('No CSV files found!');
        return;
    }

    const convertedData = {};

    // Convert each CSV file
    for (const csvFile of csvFiles) {
        const csvPath = path.join(csvDir, csvFile);
        const jsonFile = csvFile.replace('.csv', '.json');
        const jsonPath = path.join(jsonDir, jsonFile);

        try {
            const jsonData = await csvToJSON(csvPath, jsonPath);
            convertedData[jsonFile] = jsonData;
        } catch (error) {
            console.error(`Failed to convert ${csvFile}:`, error.message);
        }
    }

    // Create a master index file
    const indexData = {
        created: new Date().toISOString(),
        files: Object.keys(convertedData),
        totalRecords: Object.values(convertedData).reduce((sum, data) => sum + data.rowCount, 0),
        summary: convertedData
    };

    const indexPath = path.join(jsonDir, 'data-index.json');
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));

    console.log('\n========================================');
    console.log(`Conversion complete! ${csvFiles.length} CSV files converted to JSON`);
    console.log(`Total records processed: ${indexData.totalRecords}`);
    console.log(`JSON files saved to: ${jsonDir}`);
    console.log(`Index file created: data-index.json`);

    return convertedData;
}

// Export functions
export {
    csvToJSON,
    convertAllCSVToJSON,
    processRowData,
    determineExpenseType
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    convertAllCSVToJSON();
}