/**
 * Enhanced Chatbot Knowledge Base with Comprehensive Data Extraction
 * Extracts and understands all sections and content from both dashboards
 */

class EnhancedChatbotKnowledgeBase extends ChatbotKnowledgeBase {
    constructor() {
        super();
        this.sectionExtractors = {
            expense: {
                'expenseOutpacedInsight': this.extractExpenseOutpacedData.bind(this),
                'growthRiskTable': this.extractGrowthRiskTableData.bind(this),
                'expenseAnalysisTable': this.extractExpenseAnalysisData.bind(this),
                'keyMetrics': this.extractKeyMetricsData.bind(this),
                'insights': this.extractInsightsData.bind(this)
            },
            revenue: {
                'immediateActions': this.extractImmediateActionsData.bind(this),
                'weeklyPerformance': this.extractWeeklyPerformanceData.bind(this),
                'revenueInsights': this.extractRevenueInsightsData.bind(this),
                'underperformingWeeks': this.extractUnderperformingWeeksData.bind(this)
            }
        };

        this.enhancedQuestionPatterns = {
            ...this.questionPatterns,
            specific_count: [
                "how many", "count", "number of", "total", "sum of"
            ],
            month_analysis: [
                "months", "outpaced", "growth", "decline", "opposite direction"
            ],
            expense_categories: [
                "expenses", "categories", "grew faster", "outpaced growth"
            ],
            action_items: [
                "immediate actions", "should do", "next steps", "recommendations", "improve"
            ],
            performance_analysis: [
                "operational performance", "what went well", "what can be improved", "insights"
            ]
        };
    }

    // Enhanced data extraction that includes all dashboard sections
    extractDashboardData() {
        const basicData = super.extractDashboardData();

        // Add comprehensive section data based on current page
        if (basicData.currentPage.includes('expense')) {
            basicData.sections = this.extractExpenseSections();
        } else if (basicData.currentPage.includes('revenue')) {
            basicData.sections = this.extractRevenueSections();
        }

        return basicData;
    }

    // Extract all expense dashboard sections
    extractExpenseSections() {
        const sections = {};

        try {
            // Extract "Expenses Grew Faster Than GP" data
            sections.expenseOutpaced = this.extractExpenseOutpacedData();

            // Extract Growth Risk Table data
            sections.growthRiskTable = this.extractGrowthRiskTableData();

            // Extract expense analysis table data
            sections.expenseAnalysis = this.extractExpenseAnalysisData();

            // Extract insights data
            sections.insights = this.extractInsightsData();

        } catch (error) {
            console.warn('Error extracting expense sections:', error);
        }

        return sections;
    }

    // Extract all revenue dashboard sections
    extractRevenueSections() {
        const sections = {};

        try {
            // Extract immediate actions
            sections.immediateActions = this.extractImmediateActionsData();

            // Extract weekly performance data
            sections.weeklyPerformance = this.extractWeeklyPerformanceData();

            // Extract revenue insights
            sections.revenueInsights = this.extractRevenueInsightsData();

        } catch (error) {
            console.warn('Error extracting revenue sections:', error);
        }

        return sections;
    }

    // Extract "Expenses Grew Faster Than GP" data
    extractExpenseOutpacedData() {
        const element = document.getElementById('expenseOutpacedText');
        if (element && element.textContent !== 'Loading...') {
            const text = element.textContent.trim();
            // Parse the categories from the text
            const categories = text.split(',').map(cat => cat.trim()).filter(cat => cat && cat !== 'None');
            return {
                text: text,
                categories: categories,
                count: categories.length
            };
        }
        return { text: '', categories: [], count: 0 };
    }

    // Extract Growth Risk Table data
    extractGrowthRiskTableData() {
        const table = document.getElementById('growthRiskTable');
        if (!table) return { rows: [], summary: {} };

        const data = { rows: [], summary: { total3Plus: 0, categories3Plus: [] } };
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5) {
                const category = cells[0].textContent.trim();
                const monthsOutpaced = parseInt(cells[1].textContent.trim()) || 0;
                const monthsDidNotDecline = parseInt(cells[2].textContent.trim()) || 0;
                const monthsOpposite = parseInt(cells[3].textContent.trim()) || 0;
                const potentialLoss = cells[4].textContent.trim();

                const rowData = {
                    category,
                    monthsOutpaced,
                    monthsDidNotDecline,
                    monthsOpposite,
                    potentialLoss
                };

                data.rows.push(rowData);

                // Count categories with 3+ months outpaced growth
                if (monthsOutpaced >= 3) {
                    data.summary.total3Plus++;
                    data.summary.categories3Plus.push(category);
                }
            }
        });

        return data;
    }

    // Extract expense analysis table data
    extractExpenseAnalysisData() {
        const data = { categories: [], metrics: {} };

        // Look for expense analysis table or data
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
            if (headers.some(h => h.includes('Category') || h.includes('Expense'))) {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 0) {
                        const rowData = {};
                        headers.forEach((header, index) => {
                            if (cells[index]) {
                                rowData[header] = cells[index].textContent.trim();
                            }
                        });
                        data.categories.push(rowData);
                    }
                });
            }
        });

        return data;
    }

    // Extract insights data from various sections
    extractInsightsData() {
        const insights = {};

        // Extract from insights sections
        const insightSections = document.querySelectorAll('.insight-item, .insights-section');
        insightSections.forEach(section => {
            const text = section.textContent.trim();
            if (text.includes('Expenses Grew Faster Than GP')) {
                insights.expenseOutpaced = text;
            } else if (text.includes('Grew Despite Decline')) {
                insights.grewDespiteDecline = text;
            }
        });

        return insights;
    }

    // Extract immediate actions from revenue dashboard
    extractImmediateActionsData() {
        const actions = {
            operational: [],
            revenueCycle: []
        };

        // Extract operational immediate actions
        const operationalEl = document.getElementById('immediateActions');
        if (operationalEl) {
            const items = operationalEl.querySelectorAll('li');
            items.forEach(item => {
                actions.operational.push(item.textContent.trim());
            });
        }

        // Extract revenue cycle immediate actions
        const revenueCycleEl = document.getElementById('immediateActions2');
        if (revenueCycleEl) {
            const items = revenueCycleEl.querySelectorAll('li');
            items.forEach(item => {
                actions.revenueCycle.push(item.textContent.trim());
            });
        }

        return actions;
    }

    // Extract weekly performance data
    extractWeeklyPerformanceData() {
        const data = { weeks: [], underperforming: [], overperforming: [] };

        // Look for performance tables or data
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
            if (headers.some(h => h.includes('Week') || h.includes('Performance'))) {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 0) {
                        const weekData = {};
                        headers.forEach((header, index) => {
                            if (cells[index]) {
                                weekData[header] = cells[index].textContent.trim();
                            }
                        });

                        data.weeks.push(weekData);

                        // Categorize performance
                        if (weekData['Performance Diagnostic']) {
                            if (weekData['Performance Diagnostic'].includes('Under')) {
                                data.underperforming.push(weekData);
                            } else if (weekData['Performance Diagnostic'].includes('Over')) {
                                data.overperforming.push(weekData);
                            }
                        }
                    }
                });
            }
        });

        return data;
    }

    // Extract revenue insights data
    extractRevenueInsightsData() {
        const insights = { whatWentWell: [], whatCanImprove: [] };

        // Look for insight sections in tables or divs
        const insightElements = document.querySelectorAll('td, div');
        insightElements.forEach(el => {
            const text = el.textContent.trim();
            if (text.includes('What Went Well:')) {
                const content = text.replace('What Went Well:', '').trim();
                if (content) insights.whatWentWell.push(content);
            } else if (text.includes('What Can Be Improved:')) {
                const content = text.replace('What Can Be Improved:', '').trim();
                if (content) insights.whatCanImprove.push(content);
            }
        });

        return insights;
    }

    // Extract underperforming weeks data
    extractUnderperformingWeeksData() {
        const weeklyData = this.extractWeeklyPerformanceData();
        return {
            count: weeklyData.underperforming.length,
            weeks: weeklyData.underperforming,
            details: weeklyData.underperforming.map(week => ({
                week: week.Week || 'Unknown',
                performance: week['Performance Diagnostic'] || 'Unknown',
                issues: week['What Can Be Improved'] || 'No specific issues listed'
            }))
        };
    }

    // Enhanced question analysis for complex queries
    analyzeComplexQuestion(input) {
        const analysis = {
            type: 'complex',
            intent: null,
            entities: {
                numbers: [],
                metrics: [],
                timeframes: [],
                categories: [],
                sections: []
            },
            specifics: {}
        };

        // Extract numbers
        const numberMatches = input.match(/\d+/g);
        if (numberMatches) {
            analysis.entities.numbers = numberMatches.map(n => parseInt(n));
        }

        // Detect section references
        if (input.includes('outpaced growth') || input.includes('months outpaced')) {
            analysis.entities.sections.push('growthRiskTable');
            analysis.specifics.column = 'monthsOutpaced';
        }

        if (input.includes('grew faster than gp') || input.includes('expenses grew faster')) {
            analysis.entities.sections.push('expenseOutpaced');
        }

        if (input.includes('immediate actions') || input.includes('should do next')) {
            analysis.entities.sections.push('immediateActions');
        }

        if (input.includes('operational performance')) {
            analysis.entities.sections.push('operationalPerformance');
        }

        // Detect counting questions
        if (input.includes('how many') || input.includes('count') || input.includes('number of')) {
            analysis.intent = 'count';
        }

        // Detect list questions
        if (input.includes('which') || input.includes('what are') || input.includes('list')) {
            analysis.intent = 'list';
        }

        return analysis;
    }

    // Generate response for complex questions
    generateComplexResponse(analysis, dashboardData) {
        const sections = dashboardData.sections || {};

        if (analysis.intent === 'count' && analysis.entities.sections.includes('growthRiskTable')) {
            // Handle questions like "how many expenses have 3+ months outpaced growth"
            const threshold = analysis.entities.numbers.find(n => n >= 3) || 3;
            const tableData = sections.growthRiskTable;

            if (tableData && tableData.summary) {
                const count = tableData.rows.filter(row => row.monthsOutpaced >= threshold).length;
                const categories = tableData.rows
                    .filter(row => row.monthsOutpaced >= threshold)
                    .map(row => row.category);

                return `${count} expense categories have ${threshold} or more months when the expense outpaced growth. These categories are: ${categories.join(', ')}.`;
            }
        }

        if (analysis.intent === 'list' && analysis.entities.sections.includes('expenseOutpaced')) {
            // Handle questions about expenses that grew faster than GP
            const outpacedData = sections.expenseOutpaced;
            if (outpacedData && outpacedData.categories.length > 0) {
                return `${outpacedData.count} expenses grew faster than GP: ${outpacedData.categories.join(', ')}.`;
            } else {
                return "No expenses grew faster than GP in the most recent month.";
            }
        }

        if (analysis.entities.sections.includes('immediateActions')) {
            // Handle questions about immediate actions
            const actionsData = sections.immediateActions;
            if (actionsData) {
                let response = "Here are the immediate actions to improve operational performance:\n\n";

                if (actionsData.operational.length > 0) {
                    response += "**Operational Performance Actions:**\n";
                    actionsData.operational.forEach((action, i) => {
                        response += `${i + 1}. ${action}\n`;
                    });
                }

                if (actionsData.revenueCycle.length > 0) {
                    response += "\n**Revenue Cycle Efficiency Actions:**\n";
                    actionsData.revenueCycle.forEach((action, i) => {
                        response += `${i + 1}. ${action}\n`;
                    });
                }

                return response.trim();
            }
        }

        return null; // Let the regular engine handle it
    }
}

// Export the enhanced class
window.EnhancedChatbotKnowledgeBase = EnhancedChatbotKnowledgeBase;