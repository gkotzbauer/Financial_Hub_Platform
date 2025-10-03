import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dashboard Metric Mapper
 * Maps dashboard metrics to their component expense categories using P&L Assignments
 */
class DashboardMetricMapper {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data', 'json');
        this.plAssignments = null;
        this.plExpenseData = null;
        this.financialPerformanceData = null;
        this.expenseAnalysisData = null;
        this.loadAllData();
    }

    loadAllData() {
        try {
            // Load P&L Assignments - the key mapping file
            const assignmentsPath = path.join(this.dataPath, 'P&L Assignments.json');
            if (fs.existsSync(assignmentsPath)) {
                this.plAssignments = JSON.parse(fs.readFileSync(assignmentsPath, 'utf8'));
            }

            // Load P&L expense data
            const plExpensePath = path.join(this.dataPath, 'P&L expense processed data through June 2025 v2.json');
            if (fs.existsSync(plExpensePath)) {
                this.plExpenseData = JSON.parse(fs.readFileSync(plExpensePath, 'utf8'));
            }

            // Load Financial Performance data
            const financialPath = path.join(this.dataPath, 'Financial Performance Data.json');
            if (fs.existsSync(financialPath)) {
                this.financialPerformanceData = JSON.parse(fs.readFileSync(financialPath, 'utf8'));
            }

            // Load Expense Analysis data
            const expenseAnalysisPath = path.join(this.dataPath, 'expense-analysis.json');
            if (fs.existsSync(expenseAnalysisPath)) {
                this.expenseAnalysisData = JSON.parse(fs.readFileSync(expenseAnalysisPath, 'utf8'));
            }

            console.log('Dashboard metric mapper data loaded successfully');
        } catch (error) {
            console.error('Error loading dashboard metric mapper data:', error);
        }
    }

    /**
     * Get account numbers that belong to a specific metric category
     */
    getAccountNumbersForMetric(metricName) {
        if (!this.plAssignments || !this.plAssignments.data) return [];

        const accountNumbers = [];

        this.plAssignments.data.forEach(row => {
            if (row[metricName]) {
                accountNumbers.push(row[metricName]);
            }
        });

        return [...new Set(accountNumbers)]; // Remove duplicates
    }

    /**
     * Get breakdown of Variable Operational Costs
     */
    getVariableOperationalCostsBreakdown() {
        const accountNumbers = this.getAccountNumbersForMetric('Variable Operational Costs');
        return this.getExpenseBreakdownByAccounts(accountNumbers, 'Variable Operational Costs');
    }

    /**
     * Get breakdown of Standard Commitments
     */
    getStandardCommitmentsBreakdown() {
        const accountNumbers = this.getAccountNumbersForMetric('Standard Commitments');
        return this.getExpenseBreakdownByAccounts(accountNumbers, 'Standard Commitments');
    }

    /**
     * Get breakdown of Revenue Proportional expenses
     */
    getRevenueProportionalBreakdown() {
        const accountNumbers = this.getAccountNumbersForMetric('Revenue Proportional');
        return this.getExpenseBreakdownByAccounts(accountNumbers, 'Revenue Proportional');
    }

    /**
     * Get breakdown of Marketing & Advertising
     */
    getMarketingAdvertisingBreakdown() {
        const accountNumbers = this.getAccountNumbersForMetric('Marketing & Advertising');
        return this.getExpenseBreakdownByAccounts(accountNumbers, 'Marketing & Advertising');
    }

    /**
     * Get breakdown of Owner Controlled expenses
     */
    getOwnerControlledBreakdown() {
        const accountNumbers = this.getAccountNumbersForMetric('Owner Controlled');
        return this.getExpenseBreakdownByAccounts(accountNumbers, 'Owner Controlled');
    }

    /**
     * Get breakdown of Supplies
     */
    getSuppliesBreakdown() {
        const accountNumbers = this.getAccountNumbersForMetric('Supplies');
        return this.getExpenseBreakdownByAccounts(accountNumbers, 'Supplies');
    }

    /**
     * Get expense breakdown for specific account numbers
     */
    getExpenseBreakdownByAccounts(accountNumbers, metricName) {
        if (!this.plExpenseData || !this.plExpenseData.data) {
            return {
                metricName: metricName,
                total: 0,
                components: [],
                accountNumbers: accountNumbers,
                error: 'P&L expense data not available'
            };
        }

        const components = [];
        let total = 0;

        // Find matching categories in the P&L data
        this.plExpenseData.data.forEach(expenseItem => {
            const categoryString = expenseItem.category.toString();

            // Check if this category matches any of our account numbers
            const matchingAccount = accountNumbers.find(accountNum => {
                return categoryString.includes(accountNum.toString()) ||
                       categoryString.startsWith(accountNum.toString());
            });

            if (matchingAccount) {
                // Calculate total expenses for this category (Jan-Jun 2025)
                const categoryTotal =
                    (expenseItem.expenses?.jan2025 || 0) +
                    (expenseItem.expenses?.feb2025 || 0) +
                    (expenseItem.expenses?.mar2025 || 0) +
                    (expenseItem.expenses?.apr2025 || 0) +
                    (expenseItem.expenses?.may2025 || 0) +
                    (expenseItem.expenses?.jun2025 || 0);

                total += categoryTotal;

                components.push({
                    category: expenseItem.category,
                    accountNumber: matchingAccount,
                    total: categoryTotal,
                    monthlyBreakdown: {
                        jan2025: expenseItem.expenses?.jan2025 || 0,
                        feb2025: expenseItem.expenses?.feb2025 || 0,
                        mar2025: expenseItem.expenses?.mar2025 || 0,
                        apr2025: expenseItem.expenses?.apr2025 || 0,
                        may2025: expenseItem.expenses?.may2025 || 0,
                        jun2025: expenseItem.expenses?.jun2025 || 0
                    },
                    analysis: expenseItem.analysis
                });
            }
        });

        // Sort components by total amount (descending)
        components.sort((a, b) => b.total - a.total);

        return {
            metricName: metricName,
            total: total,
            totalFormatted: `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            componentCount: components.length,
            components: components,
            accountNumbers: accountNumbers
        };
    }

    /**
     * Get metric value from Financial Performance Data
     */
    getMetricValue(metricName) {
        if (!this.financialPerformanceData || !this.financialPerformanceData.data) return null;

        const metric = this.financialPerformanceData.data.find(item =>
            item.Metric_Name === metricName ||
            item.Metric_ID === metricName.toUpperCase().replace(/\s+/g, '_')
        );

        return metric;
    }

    /**
     * Process natural language query for metric breakdowns
     */
    processMetricQuery(query) {
        const queryLower = query.toLowerCase();

        if (queryLower.includes('variable operational') ||
            queryLower.includes('what makes up variable operational')) {
            const breakdown = this.getVariableOperationalCostsBreakdown();
            const metricValue = this.getMetricValue('Variable Operational Costs');

            return {
                queryType: 'Variable Operational Costs Breakdown',
                dashboardMetric: metricValue,
                breakdown: breakdown,
                summary: `Variable Operational Costs (${breakdown.totalFormatted}) consists of ${breakdown.componentCount} expense categories`
            };
        }

        if (queryLower.includes('standard commitments') ||
            queryLower.includes('what makes up standard commitments')) {
            const breakdown = this.getStandardCommitmentsBreakdown();
            return {
                queryType: 'Standard Commitments Breakdown',
                breakdown: breakdown,
                summary: `Standard Commitments (${breakdown.totalFormatted}) consists of ${breakdown.componentCount} expense categories`
            };
        }

        if (queryLower.includes('marketing') && (queryLower.includes('advertising') || queryLower.includes('what makes up'))) {
            const breakdown = this.getMarketingAdvertisingBreakdown();
            return {
                queryType: 'Marketing & Advertising Breakdown',
                breakdown: breakdown,
                summary: `Marketing & Advertising (${breakdown.totalFormatted}) consists of ${breakdown.componentCount} expense categories`
            };
        }

        if (queryLower.includes('revenue proportional') ||
            queryLower.includes('what makes up revenue proportional')) {
            const breakdown = this.getRevenueProportionalBreakdown();
            return {
                queryType: 'Revenue Proportional Breakdown',
                breakdown: breakdown,
                summary: `Revenue Proportional expenses (${breakdown.totalFormatted}) consists of ${breakdown.componentCount} expense categories`
            };
        }

        if (queryLower.includes('owner controlled') ||
            queryLower.includes('what makes up owner controlled')) {
            const breakdown = this.getOwnerControlledBreakdown();
            return {
                queryType: 'Owner Controlled Breakdown',
                breakdown: breakdown,
                summary: `Owner Controlled expenses (${breakdown.totalFormatted}) consists of ${breakdown.componentCount} expense categories`
            };
        }

        if (queryLower.includes('supplies') && queryLower.includes('what makes up')) {
            const breakdown = this.getSuppliesBreakdown();
            return {
                queryType: 'Supplies Breakdown',
                breakdown: breakdown,
                summary: `Supplies (${breakdown.totalFormatted}) consists of ${breakdown.componentCount} expense categories`
            };
        }

        return null; // Query doesn't match any metric breakdown
    }

    /**
     * Format metric breakdown response for chatbot
     */
    formatMetricBreakdownResponse(queryResult) {
        if (!queryResult || !queryResult.breakdown) return "No data available for this metric.";

        let response = `**${queryResult.queryType}**\n\n`;

        if (queryResult.dashboardMetric) {
            response += `Dashboard Value: ${queryResult.dashboardMetric.Value_2025_Jan_July} (Growth: ${queryResult.dashboardMetric.Growth_Rate_Percentage}%)\n`;
        }

        response += `${queryResult.summary}\n\n`;

        if (queryResult.breakdown.components.length > 0) {
            response += "**Component Categories:**\n";

            // Show top 10 components
            queryResult.breakdown.components.slice(0, 10).forEach((component, index) => {
                const formattedTotal = `$${component.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                response += `${index + 1}. ${component.category} - ${formattedTotal}\n`;
            });

            if (queryResult.breakdown.components.length > 10) {
                response += `\n*Showing top 10 of ${queryResult.breakdown.components.length} categories*`;
            }

            response += `\n**Total:** ${queryResult.breakdown.totalFormatted}`;
        }

        return response;
    }
}

export default DashboardMetricMapper;