import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Financial Data Query Engine for RMT Analytics Chatbot
 * Provides structured access to P&L and financial data
 */
class FinancialDataQuery {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data', 'json');
        this.data = {};
        this.loadAllData();
    }

    /**
     * Load all JSON data files into memory
     */
    loadAllData() {
        try {
            // Load P&L expense data
            const plDataPath = path.join(this.dataPath, 'P&L expense processed data through June 2025 v2.json');
            if (fs.existsSync(plDataPath)) {
                this.data.plExpenses = JSON.parse(fs.readFileSync(plDataPath, 'utf8'));
            }

            // Load other financial data files
            const dataFiles = {
                summary: 'Summary RMT Rev & Expense Data for Dashboard.json',
                financialPerformance: 'Financial Performance Data.json',
                statusSummary: 'Status Summary Source File.json',
                expenseAnalysis: 'expense-analysis.json'
            };

            Object.entries(dataFiles).forEach(([key, filename]) => {
                const filePath = path.join(this.dataPath, filename);
                if (fs.existsSync(filePath)) {
                    this.data[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                }
            });

            console.log('Financial data loaded successfully');
        } catch (error) {
            console.error('Error loading financial data:', error);
        }
    }

    /**
     * Query P&L line items for specific criteria
     */
    queryPLLineItems(filters = {}) {
        if (!this.data.plExpenses) return [];

        let results = this.data.plExpenses.data || [];

        // Apply filters
        if (filters.year) {
            results = results.filter(item => item.year === filters.year);
        }

        if (filters.type) {
            results = results.filter(item =>
                item.type && item.type.toLowerCase().includes(filters.type.toLowerCase())
            );
        }

        if (filters.category) {
            results = results.filter(item =>
                item.category && item.category.toLowerCase().includes(filters.category.toLowerCase())
            );
        }

        if (filters.month) {
            const monthKey = `${filters.month.toLowerCase()}${filters.year || 2025}`;
            results = results.filter(item => item.expenses[monthKey] > 0);
        }

        return results;
    }

    /**
     * Get Variable Operational Costs for a specific year
     */
    getVariableOperationalCosts(year = 2025) {
        return this.queryPLLineItems({
            year: year,
            type: 'Variable Operational'
        });
    }

    /**
     * Get Fixed Costs for a specific year
     */
    getFixedCosts(year = 2025) {
        return this.queryPLLineItems({
            year: year,
            type: 'Fixed'
        });
    }

    /**
     * Get all expense types/categories available
     */
    getExpenseTypes() {
        if (!this.data.plExpenses) return [];

        const types = new Set();
        this.data.plExpenses.data.forEach(item => {
            if (item.type) types.add(item.type);
        });

        return Array.from(types).sort();
    }

    /**
     * Get monthly expense totals by type
     */
    getMonthlyExpensesByType(type, year = 2025) {
        const items = this.queryPLLineItems({ type, year });

        const monthlyTotals = {
            jan2025: 0, feb2025: 0, mar2025: 0,
            apr2025: 0, may2025: 0, jun2025: 0
        };

        items.forEach(item => {
            Object.keys(monthlyTotals).forEach(month => {
                monthlyTotals[month] += item.expenses[month] || 0;
            });
        });

        return monthlyTotals;
    }

    /**
     * Search for specific accounts or categories
     */
    searchCategories(searchTerm) {
        if (!this.data.plExpenses) return [];

        const searchLower = searchTerm.toLowerCase();
        return this.data.plExpenses.data.filter(item =>
            item.category.toLowerCase().includes(searchLower) ||
            item.type.toLowerCase().includes(searchLower)
        );
    }

    /**
     * Get high-level financial summary
     */
    getFinancialSummary(year = 2025) {
        const summary = {
            year: year,
            totalExpenseCategories: 0,
            totalMonthlyExpenses: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0 },
            expensesByType: {},
            topExpenseCategories: []
        };

        if (!this.data.plExpenses) return summary;

        const data = this.data.plExpenses.data.filter(item => item.year === year);
        summary.totalExpenseCategories = data.length;

        // Calculate totals by month
        data.forEach(item => {
            summary.totalMonthlyExpenses.jan += item.expenses.jan2025 || 0;
            summary.totalMonthlyExpenses.feb += item.expenses.feb2025 || 0;
            summary.totalMonthlyExpenses.mar += item.expenses.mar2025 || 0;
            summary.totalMonthlyExpenses.apr += item.expenses.apr2025 || 0;
            summary.totalMonthlyExpenses.may += item.expenses.may2025 || 0;
            summary.totalMonthlyExpenses.jun += item.expenses.jun2025 || 0;

            // Group by type
            if (!summary.expensesByType[item.type]) {
                summary.expensesByType[item.type] = 0;
            }
            const totalForItem = Object.values(item.expenses).reduce((sum, val) => sum + val, 0);
            summary.expensesByType[item.type] += totalForItem;
        });

        // Get top 10 expense categories
        summary.topExpenseCategories = data
            .map(item => ({
                category: item.category,
                type: item.type,
                totalExpense: Object.values(item.expenses).reduce((sum, val) => sum + val, 0)
            }))
            .sort((a, b) => b.totalExpense - a.totalExpense)
            .slice(0, 10);

        return summary;
    }

    /**
     * Parse natural language queries and return appropriate data
     */
    parseAndQuery(query) {
        const queryLower = query.toLowerCase();

        // Extract year
        const yearMatch = query.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : 2025;

        // Detect query type and respond accordingly
        if (queryLower.includes('variable operational costs') || queryLower.includes('variable operational')) {
            const data = this.getVariableOperationalCosts(year);
            return {
                queryType: 'Variable Operational Costs',
                year: year,
                count: data.length,
                data: data,
                summary: `Found ${data.length} variable operational cost line items for ${year}`
            };
        }

        if (queryLower.includes('fixed costs') || queryLower.includes('fixed')) {
            const data = this.getFixedCosts(year);
            return {
                queryType: 'Fixed Costs',
                year: year,
                count: data.length,
                data: data,
                summary: `Found ${data.length} fixed cost line items for ${year}`
            };
        }

        if (queryLower.includes('p&l line items') || queryLower.includes('line items')) {
            const data = this.queryPLLineItems({ year });
            return {
                queryType: 'All P&L Line Items',
                year: year,
                count: data.length,
                data: data,
                summary: `Found ${data.length} total P&L line items for ${year}`
            };
        }

        if (queryLower.includes('expense types') || queryLower.includes('categories')) {
            const types = this.getExpenseTypes();
            return {
                queryType: 'Expense Types',
                data: types,
                summary: `Available expense types: ${types.join(', ')}`
            };
        }

        if (queryLower.includes('summary') || queryLower.includes('overview')) {
            const summary = this.getFinancialSummary(year);
            return {
                queryType: 'Financial Summary',
                year: year,
                data: summary,
                summary: `Financial summary for ${year}: ${summary.totalExpenseCategories} expense categories`
            };
        }

        // Search for specific terms
        if (queryLower.includes('search') || queryLower.includes('find')) {
            const searchTerms = query.replace(/search|find|for|the/gi, '').trim();
            const results = this.searchCategories(searchTerms);
            return {
                queryType: 'Search Results',
                searchTerm: searchTerms,
                count: results.length,
                data: results,
                summary: `Found ${results.length} items matching "${searchTerms}"`
            };
        }

        // Default: return general info
        return {
            queryType: 'General Information',
            data: this.getFinancialSummary(year),
            summary: 'Here is a general overview of the financial data available'
        };
    }

    /**
     * Format response for chatbot display
     */
    formatResponseForChat(queryResult) {
        let response = `**${queryResult.queryType}**\n\n`;
        response += `${queryResult.summary}\n\n`;

        if (queryResult.data && Array.isArray(queryResult.data)) {
            if (queryResult.data.length > 0) {
                response += "**Details:**\n";
                queryResult.data.slice(0, 10).forEach((item, index) => {
                    if (item.category) {
                        const totalExpense = Object.values(item.expenses).reduce((sum, val) => sum + val, 0);
                        response += `${index + 1}. ${item.category} (${item.type}) - Total: $${totalExpense.toLocaleString()}\n`;
                    } else if (typeof item === 'string') {
                        response += `• ${item}\n`;
                    }
                });

                if (queryResult.data.length > 10) {
                    response += `\n*Showing top 10 of ${queryResult.data.length} results*`;
                }
            }
        }

        return response;
    }
}

// Export the class
export default FinancialDataQuery;

// Test functionality if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const queryEngine = new FinancialDataQuery();

    console.log('\n=== Testing Financial Data Query Engine ===\n');

    // Test queries
    const testQueries = [
        "What are all of the P&L line items associated with the 2025 Variable Operational Costs?",
        "Show me fixed costs for 2025",
        "What expense types are available?",
        "Give me a financial summary",
        "Search for interest expense"
    ];

    testQueries.forEach(query => {
        console.log(`Query: "${query}"`);
        const result = queryEngine.parseAndQuery(query);
        const formatted = queryEngine.formatResponseForChat(result);
        console.log(formatted);
        console.log('\n' + '='.repeat(50) + '\n');
    });
}