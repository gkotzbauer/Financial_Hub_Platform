/**
 * Complete Standalone Chatbot Implementation
 * Combines all functionality without relying on class inheritance
 */

class CompleteChatbot {
    constructor() {
        this.conversationHistory = [];
        this.isInitialized = false;
        this.currentData = null;
        this.jsonData = null;
        this.init();
    }

    async init() {
        try {
            await this.loadJSONData();
            this.currentData = this.extractAllDashboardData();
            this.isInitialized = true;
            console.log('Complete Chatbot initialized successfully');
        } catch (error) {
            console.error('Error initializing chatbot:', error);
            this.isInitialized = true; // Still mark as initialized to prevent blocking
        }
    }

    async loadJSONData() {
        try {
            const response = await fetch('chatbot-data.json');
            this.jsonData = await response.json();
            console.log('Chatbot JSON data loaded successfully');
        } catch (error) {
            console.error('Error loading JSON data:', error);
            this.jsonData = null;
        }
    }

    // Extract all dashboard data including sections
    extractAllDashboardData() {
        const data = {
            currentPage: this.getCurrentPage(),
            metrics: this.extractBasicMetrics(),
            sections: {}
        };

        // Extract section-specific data based on page
        if (data.currentPage.includes('expense')) {
            data.sections = this.extractExpenseSections();
        } else if (data.currentPage.includes('revenue')) {
            data.sections = this.extractRevenueSections();
        }

        return data;
    }

    getCurrentPage() {
        const path = window.location.pathname.split('/').pop() || 'dashboard.html';
        return path;
    }

    extractBasicMetrics() {
        const metrics = {};

        try {
            const revenueEl = document.getElementById('totalRevenue');
            const expensesEl = document.getElementById('totalExpenses');
            const profitPerVisitEl = document.getElementById('profitPerVisit');
            const profitMarginEl = document.getElementById('profitMargin');

            if (revenueEl) metrics.totalRevenue = this.parseValue(revenueEl.textContent);
            if (expensesEl) metrics.totalExpenses = this.parseValue(expensesEl.textContent);
            if (profitPerVisitEl) metrics.profitPerVisit = this.parseValue(profitPerVisitEl.textContent);
            if (profitMarginEl) metrics.profitMargin = this.parseValue(profitMarginEl.textContent);
        } catch (error) {
            console.warn('Could not extract all metrics:', error);
        }

        return metrics;
    }

    parseValue(text) {
        if (!text) return null;
        const cleanText = text.replace(/[\$,\s]/g, '');

        if (cleanText.includes('%')) {
            return {
                value: parseFloat(cleanText.replace('%', '')),
                type: 'percentage',
                formatted: text.trim()
            };
        } else if (text.includes('$')) {
            return {
                value: parseFloat(cleanText),
                type: 'currency',
                formatted: text.trim()
            };
        } else {
            return {
                value: parseFloat(cleanText),
                type: 'number',
                formatted: text.trim()
            };
        }
    }

    extractExpenseSections() {
        const sections = {};

        try {
            // Extract "Expenses Grew Faster Than GP"
            const expenseOutpacedEl = document.getElementById('expenseOutpacedText');
            if (expenseOutpacedEl && expenseOutpacedEl.textContent !== 'Loading...') {
                const text = expenseOutpacedEl.textContent.trim();
                const categories = text.split(',').map(cat => cat.trim()).filter(cat => cat && cat !== 'None');
                sections.expenseOutpaced = {
                    text: text,
                    categories: categories,
                    count: categories.length
                };
            }

            // Extract Growth Risk Table
            sections.growthRiskTable = this.extractGrowthRiskTable();

            // Extract immediate actions if they exist on expense dashboard
            sections.insights = this.extractExpenseInsights();

        } catch (error) {
            console.error('Error extracting expense sections:', error);
        }

        return sections;
    }

    extractGrowthRiskTable() {
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

                if (monthsOutpaced >= 3) {
                    data.summary.total3Plus++;
                    data.summary.categories3Plus.push(category);
                }
            }
        });

        return data;
    }

    extractExpenseInsights() {
        const insights = {};

        const insightElements = document.querySelectorAll('.insight-item');
        insightElements.forEach(el => {
            const text = el.textContent.trim();
            if (text.includes('Expenses Grew Faster Than GP')) {
                insights.expenseOutpaced = text;
            } else if (text.includes('Grew Despite Decline')) {
                insights.grewDespiteDecline = text;
            }
        });

        return insights;
    }

    extractRevenueSections() {
        const sections = {};

        try {
            // Extract immediate actions
            sections.immediateActions = {
                operational: [],
                revenueCycle: []
            };

            const operationalEl = document.getElementById('immediateActions');
            if (operationalEl) {
                const items = operationalEl.querySelectorAll('li');
                items.forEach(item => {
                    sections.immediateActions.operational.push(item.textContent.trim());
                });
            }

            const revenueCycleEl = document.getElementById('immediateActions2');
            if (revenueCycleEl) {
                const items = revenueCycleEl.querySelectorAll('li');
                items.forEach(item => {
                    sections.immediateActions.revenueCycle.push(item.textContent.trim());
                });
            }

        } catch (error) {
            console.error('Error extracting revenue sections:', error);
        }

        return sections;
    }

    // Main question processing
    async processQuestion(userInput) {
        try {
            if (!this.isInitialized) {
                return "I'm still loading dashboard data. Please try again in a moment.";
            }

            // Update current data
            this.currentData = this.extractAllDashboardData();

            // Clean input
            const cleanInput = userInput.toLowerCase().trim();

            // Add to history
            this.conversationHistory.push({
                type: 'user',
                message: userInput,
                timestamp: new Date()
            });

            let response = null;

            // Check for specific patterns and handle accordingly
            if (this.matchesPattern(cleanInput, ['grew faster than gp']) ||
                this.matchesPattern(cleanInput, ['expenses grew faster']) ||
                this.matchesPattern(cleanInput, ['grew faster'])) {
                response = this.handleExpenseGrowthQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['how many', 'outpaced']) ||
                       this.matchesPattern(cleanInput, ['months', 'outpaced']) ||
                       this.matchesPattern(cleanInput, ['3 or more', 'months'])) {
                response = this.handleOutpacedGrowthQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['immediate actions']) ||
                       this.matchesPattern(cleanInput, ['should do']) ||
                       this.matchesPattern(cleanInput, ['what should i do']) ||
                       this.matchesPattern(cleanInput, ['improve operational'])) {
                response = this.handleImmediateActionsQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['underperforming weeks']) ||
                       this.matchesPattern(cleanInput, ['weeks underperformed']) ||
                       this.matchesPattern(cleanInput, ['which weeks'])) {
                response = this.handleUnderperformingWeeksQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['what went well']) ||
                       this.matchesPattern(cleanInput, ['operational performance']) ||
                       this.matchesPattern(cleanInput, ['revenue cycle performance'])) {
                response = this.handlePerformanceInsightsQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['volume gap']) ||
                       this.matchesPattern(cleanInput, ['visit count']) ||
                       this.matchesPattern(cleanInput, ['weekly visits'])) {
                response = this.handleVolumeAnalysisQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['revenue variance']) ||
                       this.matchesPattern(cleanInput, ['missed revenue']) ||
                       this.matchesPattern(cleanInput, ['expected revenue'])) {
                response = this.handleRevenueVarianceQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['clinical metrics']) ||
                       this.matchesPattern(cleanInput, ['labs per visit']) ||
                       this.matchesPattern(cleanInput, ['procedures per visit'])) {
                response = this.handleClinicalMetricsQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['benchmark payment']) ||
                       this.matchesPattern(cleanInput, ['expected vs benchmark']) ||
                       this.matchesPattern(cleanInput, ['benchmark analysis'])) {
                response = this.handleBenchmarkAnalysisQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['weighting diagnostics']) ||
                       this.matchesPattern(cleanInput, ['weighted benchmark']) ||
                       this.matchesPattern(cleanInput, ['materiality threshold'])) {
                response = this.handleWeightingDiagnosticsQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['aggregated metrics']) ||
                       this.matchesPattern(cleanInput, ['payer level']) ||
                       this.matchesPattern(cleanInput, ['e/m level'])) {
                response = this.handleAggregatedMetricsQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['granular metrics']) ||
                       this.matchesPattern(cleanInput, ['benchmark key']) ||
                       this.matchesPattern(cleanInput, ['cpt level'])) {
                response = this.handleGranularMetricsQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['group diagnostics']) ||
                       this.matchesPattern(cleanInput, ['group level diagnostics']) ||
                       this.matchesPattern(cleanInput, ['material flag'])) {
                response = this.handleGroupDiagnosticsQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['historical benchmarks']) ||
                       this.matchesPattern(cleanInput, ['benchmark rate']) ||
                       this.matchesPattern(cleanInput, ['85% e/m rate'])) {
                response = this.handleHistoricalBenchmarksQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['highest variance']) ||
                       this.matchesPattern(cleanInput, ['top variance']) ||
                       this.matchesPattern(cleanInput, ['expense with highest variance'])) {
                response = this.handleHighestVarianceQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['top performing']) ||
                       this.matchesPattern(cleanInput, ['best performing']) ||
                       this.matchesPattern(cleanInput, ['controlled cost'])) {
                response = this.handleTopPerformingQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['grew despite']) ||
                       this.matchesPattern(cleanInput, ['expenses grew even though']) ||
                       this.matchesPattern(cleanInput, ['gp declined'])) {
                response = this.handleGrewDespiteDeclineQuery(cleanInput);
            } else if (this.matchesPattern(cleanInput, ['profit margin'])) {
                response = this.handleMetricQuery('profit_margin');
            } else if (this.matchesPattern(cleanInput, ['revenue'])) {
                response = this.handleMetricQuery('total_revenue');
            } else if (this.matchesPattern(cleanInput, ['expenses']) || this.matchesPattern(cleanInput, ['costs'])) {
                response = this.handleMetricQuery('total_expenses');
            } else if (this.matchesPattern(cleanInput, ['profit per visit'])) {
                response = this.handleMetricQuery('profit_per_visit');
            } else if (this.isFinancialDataQuery(cleanInput)) {
                response = await this.handleFinancialDataQuery(userInput);
            } else {
                response = this.handleGeneralQuery(cleanInput);
            }

            // Add response to history
            this.conversationHistory.push({
                type: 'bot',
                message: response,
                timestamp: new Date()
            });

            return response;

        } catch (error) {
            console.error('Error processing question:', error);
            return "I encountered an error processing your question. You can try asking about profit margin, revenue, expenses, or what actions you should take.";
        }
    }

    matchesPattern(input, patterns) {
        return patterns.every(pattern => input.includes(pattern.toLowerCase()));
    }

    handleExpenseGrowthQuery(input) {
        try {
            // Priority 1: Try to extract live data from the expense dashboard first
            const element = document.getElementById('expenseOutpacedText');
            if (element && element.textContent && element.textContent !== 'Loading...') {
                const text = element.textContent.trim();

                // Parse the format "(7) Category1, Category2, Category3..."
                const match = text.match(/\((\d+)\)\s*(.*)/);
                if (match) {
                    const count = parseInt(match[1]);
                    const categoriesText = match[2].trim();

                    if (count === 0 || categoriesText.toLowerCase().includes('no expense category')) {
                        return "Good news! No expenses grew faster than GP in the most recent analysis period. This indicates strong margin control.";
                    }

                    const categories = categoriesText.split(',').map(cat => cat.trim()).filter(cat => cat && cat !== 'None');

                    if (categories.length > 0) {
                        let response = `**${count} expense categor${count === 1 ? 'y' : 'ies'} grew faster than GP** in the most recent analysis:\n\n`;

                        categories.forEach((category, i) => {
                            response += `${i + 1}. ${category}\n`;
                        });

                        response += `\nThese categories require attention as they grew faster than your gross profit, which can erode profit margins.`;
                        return response;
                    }
                }

                // Fallback parsing if format is different
                if (text.toLowerCase().includes('none') || text === 'None') {
                    return "Good news! No expenses grew faster than GP in the most recent analysis period. This indicates strong margin control.";
                }

                const categories = text.split(',').map(cat => cat.trim()).filter(cat => cat && cat !== 'None');
                if (categories.length > 0) {
                    return `${categories.length} expense categor${categories.length === 1 ? 'y' : 'ies'} grew faster than GP in the most recent analysis:\n\n${categories.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}\n\nThese categories require attention as they pose a risk to your profit margins.`;
                }
            }

            // Priority 2: Fallback to JSON data if DOM extraction fails
            if (this.jsonData && this.jsonData.expenseGrowthAnalysis) {
                const data = this.jsonData.expenseGrowthAnalysis.grewFasterThanGP;

                if (data.count === 0) {
                    return "Good news! No expenses grew faster than GP in the most recent month. This indicates strong margin control.";
                }

                let response = `${data.count} expense categor${data.count === 1 ? 'y' : 'ies'} grew faster than GP in the most recent month (${this.jsonData.expenseGrowthAnalysis.mostRecentMonth}):\n\n`;

                data.categories.forEach((category, i) => {
                    response += `${i + 1}. ${category}\n`;
                });

                // Add additional context if available
                const details = data.details;
                if (details && details.length > 0) {
                    response += '\n**Risk Assessment:**\n';
                    details.forEach(detail => {
                        if (detail.assessment === 'Margin Risk') {
                            response += `• ${detail.category}: ${detail.diagnostic}\n`;
                        }
                    });
                }

                response += '\nThese categories require attention as they pose a risk to your profit margins.';
                return response;
            }

            return "I need to access the expense dashboard data to find this information. Please make sure you're viewing the Margin Optimization page.";
        } catch (error) {
            console.error('Error in handleExpenseGrowthQuery:', error);
            return "I'm having trouble accessing that data. Please try again.";
        }
    }

    handleOutpacedGrowthQuery(input) {
        try {
            // Extract threshold (default to 3)
            const thresholdMatch = input.match(/(\d+)\s*(?:or more|plus|\+|months)/);
            const threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : 3;

            // Use JSON data if available
            if (this.jsonData && this.jsonData.expenseTrendsOverDataset) {
                const tableData = this.jsonData.expenseTrendsOverDataset.tableData;
                const categoriesAboveThreshold = tableData.filter(row => row.monthsOutpaced >= threshold);

                if (categoriesAboveThreshold.length === 0) {
                    return `No expense categories have ${threshold} or more months when expenses outpaced growth.`;
                }

                let response = `${categoriesAboveThreshold.length} expense categor${categoriesAboveThreshold.length === 1 ? 'y has' : 'ies have'} ${threshold} or more months when expenses outpaced growth:\n\n`;

                categoriesAboveThreshold.forEach((item, i) => {
                    response += `${i + 1}. ${item.category} (${item.monthsOutpaced} months outpaced, ${item.potentialLoss} potential loss)\n`;
                });

                // Add summary if showing 3+ months
                if (threshold === 3) {
                    const summary = this.jsonData.expenseTrendsOverDataset.summary;
                    response += `\n**Summary:** ${summary.total3Plus} categories have 3 or more months of expenses outpacing growth, requiring management attention.`;
                }

                return response;
            }

            // Fallback: try DOM extraction
            const table = document.getElementById('growthRiskTable');
            if (table) {
                const rows = table.querySelectorAll('tbody tr');
                const categoriesAboveThreshold = [];

                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const category = cells[0].textContent.trim();
                        const monthsOutpaced = parseInt(cells[1].textContent.trim()) || 0;

                        if (monthsOutpaced >= threshold) {
                            categoriesAboveThreshold.push({
                                category: category,
                                monthsOutpaced: monthsOutpaced
                            });
                        }
                    }
                });

                if (categoriesAboveThreshold.length === 0) {
                    return `No expense categories have ${threshold} or more months when expenses outpaced growth.`;
                }

                const categoryList = categoriesAboveThreshold.map((item, i) =>
                    `${i + 1}. ${item.category} (${item.monthsOutpaced} months)`
                ).join('\n');

                return `${categoriesAboveThreshold.length} expense categor${categoriesAboveThreshold.length === 1 ? 'y has' : 'ies have'} ${threshold} or more months when expenses outpaced growth:\n\n${categoryList}`;
            }

            return "I need to access the expense trends data to answer this question. Please make sure you're viewing the Margin Optimization page.";
        } catch (error) {
            console.error('Error in handleOutpacedGrowthQuery:', error);
            return "I'm having trouble accessing the expense trends data. Please try again.";
        }
    }

    handleImmediateActionsQuery(input) {
        try {
            // Priority 1: Try DOM extraction first to get live dashboard data
            const operational = [];
            const revenueCycle = [];

            const operationalEl = document.getElementById('immediateActions');
            if (operationalEl) {
                const items = operationalEl.querySelectorAll('li');
                items.forEach(item => {
                    const text = item.textContent.trim();
                    if (text && !text.includes('No data available')) operational.push(text);
                });
            }

            const revenueCycleEl = document.getElementById('immediateActions2');
            if (revenueCycleEl) {
                const items = revenueCycleEl.querySelectorAll('li');
                items.forEach(item => {
                    const text = item.textContent.trim();
                    if (text && !text.includes('No data available')) revenueCycle.push(text);
                });
            }

            if (operational.length > 0 || revenueCycle.length > 0) {
                let response = "Here are the immediate actions to consider:\n\n";

                if (operational.length > 0) {
                    response += "**🚀 Operational Performance (Next 30 Days):**\n";
                    operational.forEach((action, i) => {
                        response += `${i + 1}. ${action}\n`;
                    });
                }

                if (revenueCycle.length > 0) {
                    response += "\n**💰 Revenue Cycle Efficiency (Next 30 Days):**\n";
                    revenueCycle.forEach((action, i) => {
                        response += `${i + 1}. ${action}\n`;
                    });
                }

                return response.trim();
            }

            // Priority 2: Fallback to JSON data if DOM extraction finds no data
            if (this.jsonData && this.jsonData.immediateActions) {
                const actions = this.jsonData.immediateActions;

                if (actions.operational.length === 0 && actions.revenueCycle.length === 0) {
                    return "No immediate actions are currently identified. This indicates strong performance across all metrics!";
                }

                let response = "Here are the immediate actions to consider:\n\n";

                if (actions.operational.length > 0) {
                    response += "**🚀 Operational Performance (Next 30 Days):**\n";
                    actions.operational.forEach((action, i) => {
                        response += `${i + 1}. ${action}\n`;
                    });
                }

                if (actions.revenueCycle.length > 0) {
                    response += "\n**💰 Revenue Cycle Efficiency (Next 30 Days):**\n";
                    actions.revenueCycle.forEach((action, i) => {
                        response += `${i + 1}. ${action}\n`;
                    });
                }

                return response.trim();
            }

            return "I need to access the immediate actions data. This information is typically available on the Revenue Performance dashboard.";
        } catch (error) {
            console.error('Error in handleImmediateActionsQuery:', error);
            return "I'm having trouble accessing the immediate actions data. Please try again.";
        }
    }

    handleMetricQuery(metric) {
        // Use JSON data if available
        if (this.jsonData && this.jsonData.keyMetrics) {
            const metrics = this.jsonData.keyMetrics;

            switch (metric) {
                case 'profit_margin':
                    if (metrics.profitMargin) {
                        return `Your profit margin is ${metrics.profitMargin.formatted}. This shows the percentage of revenue that becomes profit after all expenses.`;
                    }
                    break;
                case 'total_revenue':
                    if (metrics.totalRevenue) {
                        return `Your total revenue is ${metrics.totalRevenue.formatted}.`;
                    }
                    break;
                case 'total_expenses':
                    if (metrics.totalExpenses) {
                        return `Your total expenses are ${metrics.totalExpenses.formatted}.`;
                    }
                    break;
                case 'profit_per_visit':
                    if (metrics.profitPerVisit) {
                        return `Your profit per visit is ${metrics.profitPerVisit.formatted}. This represents the average profit generated from each patient visit.`;
                    }
                    break;
            }
        }

        // Fallback to DOM extraction
        const data = this.currentData.metrics;
        if (data) {
            switch (metric) {
                case 'profit_margin':
                    if (data.profitMargin) {
                        return `Your profit margin is ${data.profitMargin.formatted}. This shows the percentage of revenue that becomes profit after all expenses.`;
                    }
                    break;
                case 'total_revenue':
                    if (data.totalRevenue) {
                        return `Your total revenue is ${data.totalRevenue.formatted}.`;
                    }
                    break;
                case 'total_expenses':
                    if (data.totalExpenses) {
                        return `Your total expenses are ${data.totalExpenses.formatted}.`;
                    }
                    break;
                case 'profit_per_visit':
                    if (data.profitPerVisit) {
                        return `Your profit per visit is ${data.profitPerVisit.formatted}. This represents the average profit generated from each patient visit.`;
                    }
                    break;
            }
        }

        return `I don't have current data for that metric. Try asking about profit margin, revenue, expenses, or profit per visit.`;
    }

    handleGeneralQuery(input) {
        const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon'];
        if (greetings.some(greeting => input.includes(greeting))) {
            return "Hello! I can help you understand your dashboard data. Try asking: 'What expenses grew faster than GP?', 'How many expenses outpaced growth?', or 'What immediate actions should I take?'";
        }

        if (input.includes('help')) {
            return "I can help you understand your financial data! Try asking:\n• What expenses grew faster than GP?\n• How many expenses have 3+ months outpaced growth?\n• What immediate actions should I take?\n• What's our profit margin?";
        }

        return "I can help with your dashboard data. Try asking about:\n• Expenses that grew faster than GP\n• Months when expenses outpaced growth\n• Immediate actions to improve performance\n• Your profit margin, revenue, or expenses\n• Underperforming weeks\n• What went well and what can be improved\n• Volume gaps and visit counts\n• Revenue variance and missed revenue\n• Clinical metrics and lab utilization";
    }

    handleUnderperformingWeeksQuery(input) {
        try {
            // Use JSON data if available
            if (this.jsonData && this.jsonData.revenuePerformanceAnalysis) {
                const weeklyData = this.jsonData.revenuePerformanceAnalysis.weeklyPerformance;
                const underperforming = weeklyData.underperformingWeeks;

                if (!underperforming || underperforming.length === 0) {
                    return "No weeks are currently identified as underperforming. Great job maintaining consistent performance!";
                }

                let response = `${underperforming.length} week${underperforming.length === 1 ? '' : 's'} ${underperforming.length === 1 ? 'is' : 'are'} identified as underperforming:\n\n`;

                underperforming.forEach((week, i) => {
                    response += `${i + 1}. Week ${week.week} (${week.year}) - Missed Revenue: ${week.missedRevenue}\n`;
                });

                // Add overperforming weeks for context
                const overperforming = weeklyData.overperformingWeeks;
                if (overperforming && overperforming.length > 0) {
                    response += `\n**For comparison, ${overperforming.length} week${overperforming.length === 1 ? '' : 's'} overperformed:**\n`;
                    overperforming.forEach((week, i) => {
                        response += `• Week ${week.week} (${week.year}) - Extra Revenue: ${week.extraRevenue}\n`;
                    });
                }

                response += "\nReview these weeks to identify opportunities to capture missed revenue or avoid similar performance issues.";
                return response;
            }

            return "I need to access the weekly performance data to answer this question. This information is typically available on the Revenue Performance dashboard.";
        } catch (error) {
            console.error('Error in handleUnderperformingWeeksQuery:', error);
            return "I'm having trouble accessing the weekly performance data. Please try again.";
        }
    }

    handlePerformanceInsightsQuery(input) {
        try {
            // Use JSON data if available
            if (this.jsonData && this.jsonData.revenuePerformanceAnalysis) {
                const data = this.jsonData.revenuePerformanceAnalysis;

                // Determine if asking about operational or revenue cycle
                let response = "";

                if (input.includes('operational')) {
                    const operational = data.operationalInsights;
                    response = "**🚀 Operational Performance Insights:**\n\n";

                    if (operational.whatWentWell.length > 0) {
                        response += "**✅ What Went Well:**\n";
                        operational.whatWentWell.forEach((insight, i) => {
                            response += `${i + 1}. ${insight}\n`;
                        });
                    }

                    if (operational.whatCanBeImproved.length > 0) {
                        response += "\n**⚠️ What Can Be Improved:**\n";
                        operational.whatCanBeImproved.forEach((insight, i) => {
                            response += `${i + 1}. ${insight}\n`;
                        });
                    }
                } else if (input.includes('revenue cycle')) {
                    const revenueCycle = data.revenueCycleInsights;
                    response = "**💰 Revenue Cycle Performance Insights:**\n\n";

                    if (revenueCycle.whatWentWell.length > 0) {
                        response += "**✅ What Went Well:**\n";
                        revenueCycle.whatWentWell.forEach((insight, i) => {
                            response += `${i + 1}. ${insight}\n`;
                        });
                    }

                    if (revenueCycle.whatCanBeImproved.length > 0) {
                        response += "\n**⚠️ What Can Be Improved:**\n";
                        revenueCycle.whatCanBeImproved.forEach((insight, i) => {
                            response += `${i + 1}. ${insight}\n`;
                        });
                    }
                } else {
                    // Show both operational and revenue cycle
                    const operational = data.operationalInsights;
                    const revenueCycle = data.revenueCycleInsights;

                    response = "**📊 Performance Insights:**\n\n";

                    if (operational.whatWentWell.length > 0) {
                        response += "**🚀 Operational - What Went Well:**\n";
                        operational.whatWentWell.slice(0, 3).forEach((insight, i) => {
                            response += `• ${insight}\n`;
                        });
                    }

                    if (revenueCycle.whatWentWell.length > 0) {
                        response += "\n**💰 Revenue Cycle - What Went Well:**\n";
                        revenueCycle.whatWentWell.slice(0, 3).forEach((insight, i) => {
                            response += `• ${insight}\n`;
                        });
                    }

                    if (operational.whatCanBeImproved.length > 0 || revenueCycle.whatCanBeImproved.length > 0) {
                        response += "\n**⚠️ Areas for Improvement:**\n";
                        if (operational.whatCanBeImproved.length > 0) {
                            response += `• Operational: ${operational.whatCanBeImproved[0]}\n`;
                        }
                        if (revenueCycle.whatCanBeImproved.length > 0) {
                            response += `• Revenue Cycle: ${revenueCycle.whatCanBeImproved[0]}\n`;
                        }
                    }
                }

                return response.trim();
            }

            return "I need to access the performance insights data to answer this question. This information is typically available on the Revenue Performance dashboard.";
        } catch (error) {
            console.error('Error in handlePerformanceInsightsQuery:', error);
            return "I'm having trouble accessing the performance insights data. Please try again.";
        }
    }

    handleVolumeAnalysisQuery(input) {
        try {
            if (this.jsonData && this.jsonData.revenuePerformanceAnalysis && this.jsonData.revenuePerformanceAnalysis.volumeAnalysis) {
                const volumeData = this.jsonData.revenuePerformanceAnalysis.volumeAnalysis;

                let response = "**📊 Volume Analysis:**\n\n";
                response += `**Current Performance:**\n`;
                response += `• Average Weekly Visits: ${volumeData.averageWeeklyVisits}\n`;
                response += `• Benchmark Weekly Visits: ${volumeData.benchmarkWeeklyVisits}\n`;
                response += `• Overall Volume Gap: ${volumeData.averageWeeklyVisits - volumeData.benchmarkWeeklyVisits}\n\n`;

                if (volumeData.weeklyVolumeGaps && volumeData.weeklyVolumeGaps.length > 0) {
                    response += `**Weeks with Volume Gaps:**\n`;
                    volumeData.weeklyVolumeGaps.forEach((week, i) => {
                        response += `${i + 1}. Week ${week.week} (${week.year}): ${week.actualVisits} actual vs ${week.expectedVisits} expected (Gap: ${week.volumeGap})\n`;
                    });
                }

                return response;
            }

            return "I need to access the volume analysis data to answer this question. This information is available on the Revenue Performance dashboard.";
        } catch (error) {
            console.error('Error in handleVolumeAnalysisQuery:', error);
            return "I'm having trouble accessing the volume analysis data. Please try again.";
        }
    }

    handleRevenueVarianceQuery(input) {
        try {
            if (this.jsonData && this.jsonData.revenuePerformanceAnalysis) {
                const weeklyData = this.jsonData.revenuePerformanceAnalysis.weeklyPerformance;

                let response = "**💰 Revenue Variance Analysis:**\n\n";

                if (weeklyData.underperformingWeeks && weeklyData.underperformingWeeks.length > 0) {
                    response += `**Underperforming Weeks (Missed Revenue):**\n`;
                    weeklyData.underperformingWeeks.forEach((week, i) => {
                        response += `${i + 1}. Week ${week.week} (${week.year}): ${week.missedRevenue} (${week.revenueVariancePct})\n`;
                    });
                }

                if (weeklyData.overperformingWeeks && weeklyData.overperformingWeeks.length > 0) {
                    response += `\n**Overperforming Weeks (Extra Revenue):**\n`;
                    weeklyData.overperformingWeeks.forEach((week, i) => {
                        response += `${i + 1}. Week ${week.week} (${week.year}): ${week.extraRevenue} (${week.revenueVariancePct})\n`;
                    });
                }

                // Add financial metrics if available
                if (this.jsonData.revenuePerformanceAnalysis.financialMetrics) {
                    const financial = this.jsonData.revenuePerformanceAnalysis.financialMetrics;
                    response += `\n**Current Financial Performance:**\n`;
                    response += `• Collection Rate: ${financial.collectionRate.current} (${financial.collectionRate.variance} vs benchmark)\n`;
                    response += `• Rate Variance: ${financial.rateVariance.current} per visit above expected\n`;
                    response += `• NRV Gap: ${financial.nrvGapDollar.current} (${financial.nrvGapDollar.variance} improvement)\n`;
                }

                return response;
            }

            return "I need to access the revenue variance data to answer this question. This information is available on the Revenue Performance dashboard.";
        } catch (error) {
            console.error('Error in handleRevenueVarianceQuery:', error);
            return "I'm having trouble accessing the revenue variance data. Please try again.";
        }
    }

    handleClinicalMetricsQuery(input) {
        try {
            if (this.jsonData && this.jsonData.revenuePerformanceAnalysis && this.jsonData.revenuePerformanceAnalysis.clinicalMetrics) {
                const clinical = this.jsonData.revenuePerformanceAnalysis.clinicalMetrics;

                let response = "**🏥 Clinical Performance Metrics:**\n\n";

                response += `**Laboratory Utilization:**\n`;
                response += `• Current: ${clinical.labsPerVisit.current} labs per visit\n`;
                response += `• Benchmark: ${clinical.labsPerVisit.benchmark} labs per visit\n`;
                response += `• Variance: ${clinical.labsPerVisit.variance} (${clinical.labsPerVisit.trend})\n\n`;

                response += `**Procedure Utilization:**\n`;
                response += `• Current: ${clinical.proceduresPerVisit.current} procedures per visit\n`;
                response += `• Benchmark: ${clinical.proceduresPerVisit.benchmark} procedures per visit\n`;
                response += `• Variance: ${clinical.proceduresPerVisit.variance} (${clinical.proceduresPerVisit.trend})\n\n`;

                response += `**E/M Coding Complexity:**\n`;
                response += `• Current: ${clinical.avgChargeEMWeight.current} average E/M weight\n`;
                response += `• Benchmark: ${clinical.avgChargeEMWeight.benchmark} average E/M weight\n`;
                response += `• Variance: ${clinical.avgChargeEMWeight.variance} (${clinical.avgChargeEMWeight.trend})\n\n`;

                response += `**Service Diversity:**\n`;
                response += `• Current: ${clinical.cptCount.current} different CPT codes used\n`;
                response += `• Benchmark: ${clinical.cptCount.benchmark} different CPT codes\n`;
                response += `• Variance: ${clinical.cptCount.variance} (${clinical.cptCount.trend})\n`;

                return response;
            }

            return "I need to access the clinical metrics data to answer this question. This information is available on the Revenue Performance dashboard.";
        } catch (error) {
            console.error('Error in handleClinicalMetricsQuery:', error);
            return "I'm having trouble accessing the clinical metrics data. Please try again.";
        }
    }

    handleBenchmarkAnalysisQuery(input) {
        try {
            if (!this.jsonData || !this.jsonData.aggregatedWeeklyMetrics) {
                return "I need access to the aggregated weekly metrics data to answer benchmark analysis questions.";
            }

            const benchmarkData = this.jsonData.aggregatedWeeklyMetrics.benchmarkAnalysis;
            const paymentAnalysis = this.jsonData.aggregatedWeeklyMetrics.benchmarkPaymentAnalysis;

            let response = `**Benchmark Payment Analysis:**\n\n`;

            response += `Our revenue performance analysis compares actual results against two types of benchmarks:\n\n`;

            response += `**Expected vs Benchmark Payment Variance:**\n`;
            response += `• Compares expected payments (based on 85% E/M rate) against historical benchmark payments\n`;
            response += `• Key metrics tracked: Expected vs Benchmark Payment Variance ($ and %)\n\n`;

            response += `**Key Benchmark Metrics:**\n`;
            benchmarkData.keyMetrics.forEach(metric => {
                response += `• ${metric.replace(/_/g, ' ')}\n`;
            });

            response += `\n**Materiality Threshold:** ${benchmarkData.materialityThreshold} - Used to flag significant variances that require attention.`;

            return response;
        } catch (error) {
            console.error('Error in handleBenchmarkAnalysisQuery:', error);
            return "I'm having trouble accessing the benchmark analysis data. Please try again.";
        }
    }

    handleWeightingDiagnosticsQuery(input) {
        try {
            if (!this.jsonData || !this.jsonData.aggregatedWeeklyMetrics) {
                return "I need access to the aggregated weekly metrics data to answer weighting diagnostics questions.";
            }

            const weightingData = this.jsonData.aggregatedWeeklyMetrics.benchmarkPaymentAnalysis.weightingDiagnostics;

            let response = `**Weighting Diagnostics Analysis:**\n\n`;

            response += `${weightingData.description}\n\n`;

            response += `**Material Variance Detection:**\n`;
            response += `• ${weightingData.thresholdDescription}\n`;
            response += `• Material Flag: ${weightingData.materialityFlag}\n\n`;

            response += `**Tracked Metrics:**\n`;
            weightingData.metrics.forEach(metric => {
                response += `• ${metric.replace(/_/g, ' ')}\n`;
            });

            response += `\nThis analysis helps identify when volume-weighted vs unweighted benchmark calculations show significant differences, indicating potential data quality or performance issues that need investigation.`;

            return response;
        } catch (error) {
            console.error('Error in handleWeightingDiagnosticsQuery:', error);
            return "I'm having trouble accessing the weighting diagnostics data. Please try again.";
        }
    }

    handleAggregatedMetricsQuery(input) {
        try {
            if (!this.jsonData || !this.jsonData.aggregatedWeeklyMetrics) {
                return "I need access to the aggregated weekly metrics data to answer aggregated metrics questions.";
            }

            const aggregatedData = this.jsonData.aggregatedWeeklyMetrics;

            let response = `**Aggregated Weekly Metrics Overview:**\n\n`;

            response += `Our system provides comprehensive weekly analysis aggregated at multiple levels:\n\n`;

            response += `**Grouping Dimensions:**\n`;
            aggregatedData.aggregatedDimensions.groupingLevels.forEach(level => {
                response += `• ${level}\n`;
            });

            response += `\n**Key Metric Categories:**\n\n`;

            response += `**Visit Metrics:**\n`;
            Object.entries(aggregatedData.derivedMetrics.visitMetrics).forEach(([key, description]) => {
                response += `• ${key.replace(/_/g, ' ')}: ${description}\n`;
            });

            response += `\n**Financial Metrics:**\n`;
            Object.entries(aggregatedData.derivedMetrics.financialMetrics).forEach(([key, description]) => {
                response += `• ${key.replace(/_/g, ' ')}: ${description}\n`;
            });

            response += `\n**Clinical & Collection Metrics:**\n`;
            response += `• Clinical: ${aggregatedData.derivedMetrics.clinicalMetrics.join(', ')}\n`;
            response += `• Collection: ${aggregatedData.derivedMetrics.collectionMetrics.join(', ')}\n`;

            response += `\nThis aggregated view helps identify patterns and performance trends across different payers and service types.`;

            return response;
        } catch (error) {
            console.error('Error in handleAggregatedMetricsQuery:', error);
            return "I'm having trouble accessing the aggregated metrics data. Please try again.";
        }
    }

    handleGranularMetricsQuery(input) {
        try {
            if (!this.jsonData || !this.jsonData.granularWeeklyMetrics) {
                return "I need access to the granular weekly metrics data to answer granular analysis questions.";
            }

            const granularData = this.jsonData.granularWeeklyMetrics;

            let response = `**Granular Weekly Metrics Analysis:**\n\n`;

            response += `${granularData.benchmarkKeyAnalysis.description}\n\n`;

            response += `**Analysis Dimensions:**\n`;
            granularData.benchmarkKeyAnalysis.granularDimensions.forEach(dimension => {
                response += `• ${dimension}\n`;
            });

            response += `\n**CPT Code Tracking:**\n`;
            response += `• ${granularData.benchmarkKeyAnalysis.cptCodeTracking.description}\n`;
            response += `• Purpose: ${granularData.benchmarkKeyAnalysis.cptCodeTracking.purpose}\n\n`;

            response += `**Key Derived Metrics:**\n\n`;

            response += `**Payment Analysis:**\n`;
            granularData.granularDerivedMetrics.paymentCalculations.forEach(metric => {
                response += `• ${metric.replace(/_/g, ' ')}\n`;
            });

            response += `\n**Volume Analysis:**\n`;
            granularData.granularDerivedMetrics.volumeAnalysis.forEach(metric => {
                response += `• ${metric.replace(/_/g, ' ')}\n`;
            });

            response += `\n**Rate Analysis:**\n`;
            granularData.granularDerivedMetrics.rateAnalysis.forEach(metric => {
                response += `• ${metric.replace(/_/g, ' ')}\n`;
            });

            response += `\nThis granular view provides the most detailed analysis possible, allowing identification of performance issues at the individual CPT code combination level.`;

            return response;
        } catch (error) {
            console.error('Error in handleGranularMetricsQuery:', error);
            return "I'm having trouble accessing the granular metrics data. Please try again.";
        }
    }

    handleGroupDiagnosticsQuery(input) {
        try {
            if (!this.jsonData || !this.jsonData.granularWeeklyMetrics) {
                return "I need access to the granular weekly metrics data to answer group diagnostics questions.";
            }

            const groupData = this.jsonData.granularWeeklyMetrics.groupLevelDiagnostics;

            let response = `**Group-Level Diagnostics:**\n\n`;

            response += `${groupData.description}\n\n`;

            response += `**Materiality Threshold:** ${groupData.materialityThreshold}\n\n`;

            response += `**Weighting Analysis:**\n`;
            response += `• Purpose: ${groupData.weightingAnalysis.purpose}\n`;
            response += `• Material Flag: ${groupData.weightingAnalysis.materialityFlag}\n\n`;

            response += `**Weighted vs Unweighted Metrics:**\n`;
            groupData.weightingAnalysis.weightedVsUnweighted.forEach(metric => {
                response += `• ${metric.replace(/_/g, ' ')}\n`;
            });

            response += `\n**Group-Level Metrics:**\n`;
            groupData.groupMetrics.forEach(metric => {
                response += `• ${metric.replace(/_/g, ' ')}\n`;
            });

            response += `\nThese diagnostics help identify when volume weighting creates significant differences in benchmark calculations, indicating potential data quality or performance issues.`;

            return response;
        } catch (error) {
            console.error('Error in handleGroupDiagnosticsQuery:', error);
            return "I'm having trouble accessing the group diagnostics data. Please try again.";
        }
    }

    handleHistoricalBenchmarksQuery(input) {
        try {
            if (!this.jsonData || !this.jsonData.granularWeeklyMetrics) {
                return "I need access to the granular weekly metrics data to answer historical benchmarks questions.";
            }

            const benchmarkData = this.jsonData.granularWeeklyMetrics.historicalBenchmarks;

            let response = `**Historical Benchmarks Analysis:**\n\n`;

            response += `Our system calculates multiple types of historical benchmarks at the granular Benchmark_Key level:\n\n`;

            response += `**Expected Rate Per Key:**\n`;
            response += `• ${benchmarkData.expectedRatePerKey.description}\n`;
            response += `• Metric: ${benchmarkData.expectedRatePerKey.metric}\n\n`;

            response += `**Historical Visit Count:**\n`;
            response += `• ${benchmarkData.historicalVisitCount.description}\n`;
            response += `• Metric: ${benchmarkData.historicalVisitCount.metric}\n\n`;

            response += `**Historical Payment Rate:**\n`;
            response += `• ${benchmarkData.historicalPaymentRate.description}\n`;
            response += `• Metric: ${benchmarkData.historicalPaymentRate.metric}\n\n`;

            response += `These benchmarks provide the foundation for calculating revenue variances, volume gaps, and rate differences at the most granular level possible.`;

            return response;
        } catch (error) {
            console.error('Error in handleHistoricalBenchmarksQuery:', error);
            return "I'm having trouble accessing the historical benchmarks data. Please try again.";
        }
    }

    handleHighestVarianceQuery(input) {
        try {
            // Priority 1: Extract live data from expense dashboard
            const topVarianceElement = document.getElementById('topVarianceText');
            if (topVarianceElement) {
                const liveText = topVarianceElement.textContent.trim();
                if (liveText && liveText !== 'Loading...' && !liveText.includes('No variance data')) {
                    return `**Expense with Highest Variance:** ${liveText}\n\nThis category had the largest absolute change in spending compared to its historical average.`;
                } else if (liveText.includes('No variance data')) {
                    return "No significant variance detected in expense categories for the most recent period.";
                }
            }

            return "I need access to the expense dashboard data to find variance information. Please ensure you're on the Margin Optimization dashboard.";
        } catch (error) {
            console.error('Error in handleHighestVarianceQuery:', error);
            return "I'm having trouble accessing the variance data. Please try again.";
        }
    }

    handleTopPerformingQuery(input) {
        try {
            // Priority 1: Extract live data from expense dashboard
            const topMarginElement = document.getElementById('topMarginText');
            if (topMarginElement) {
                const liveText = topMarginElement.textContent.trim();
                if (liveText && liveText !== 'Loading...' && !liveText.includes('No expense category')) {
                    return `**Top Performing Expense Categories with Controlled Cost:**\n\n${liveText}\n\nThese categories showed the best cost control relative to revenue changes.`;
                } else if (liveText.includes('No expense category')) {
                    return "No expense categories currently qualify as top performers for controlled cost relative to revenue changes.";
                }
            }

            return "I need access to the expense dashboard data to find top performing categories. Please ensure you're on the Margin Optimization dashboard.";
        } catch (error) {
            console.error('Error in handleTopPerformingQuery:', error);
            return "I'm having trouble accessing the top performing categories data. Please try again.";
        }
    }

    handleGrewDespiteDeclineQuery(input) {
        try {
            // Priority 1: Extract live data from expense dashboard
            const grewDespiteElement = document.getElementById('expenseGrewDespiteDeclineText');
            if (grewDespiteElement) {
                const liveText = grewDespiteElement.textContent.trim();
                if (liveText && liveText !== 'Loading...') {
                    // Parse the format similar to other expense metrics
                    const match = liveText.match(/\((\d+)\)\s*(.*)/);
                    if (match) {
                        const count = parseInt(match[1]);
                        const categoriesText = match[2].trim();

                        if (count === 0 || categoriesText.toLowerCase().includes('no expense category')) {
                            return "Good news! No expenses grew even though GP declined. This indicates good cost discipline during revenue challenges.";
                        }

                        const categories = categoriesText.split(',').map(cat => cat.trim()).filter(cat => cat);

                        let response = `**${count} expense categor${count === 1 ? 'y' : 'ies'} grew even though GP declined:**\n\n`;

                        categories.forEach((category, index) => {
                            response += `${index + 1}. ${category}\n`;
                        });

                        response += `\nThese categories increased spending during a period when gross profit was declining, which is concerning for margin control.`;
                        return response;
                    }

                    // Fallback parsing
                    return `**Expenses that grew despite GP decline:** ${liveText}\n\nThese categories increased spending during a period when gross profit was declining.`;
                }
            }

            return "I need access to the expense dashboard data to find this information. Please ensure you're on the Margin Optimization dashboard.";
        } catch (error) {
            console.error('Error in handleGrewDespiteDeclineQuery:', error);
            return "I'm having trouble accessing this data. Please try again.";
        }
    }

    // Check if the input is a financial data query
    isFinancialDataQuery(input) {
        const financialQueryPatterns = [
            'p&l line items',
            'line items',
            'variable operational costs',
            'variable operational',
            'fixed costs',
            'fixed',
            'expense types',
            'expense categories',
            'financial summary',
            'summary',
            'search',
            'find',
            'what are all',
            'show me all',
            'list all'
        ];

        return financialQueryPatterns.some(pattern =>
            input.includes(pattern.toLowerCase())
        );
    }

    // Handle financial data queries using the backend API
    async handleFinancialDataQuery(query) {
        try {
            const response = await fetch('/api/financial-query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: query })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                return data.formattedResponse;
            } else {
                return "I encountered an error processing your financial data query. Please try rephrasing your question.";
            }
        } catch (error) {
            console.error('Error handling financial data query:', error);
            return "I'm unable to access the financial data right now. Please ensure the server is running and try again.";
        }
    }
}

// Export the complete chatbot
window.CompleteChatbot = CompleteChatbot;