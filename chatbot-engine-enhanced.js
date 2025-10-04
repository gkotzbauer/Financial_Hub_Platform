/**
 * Enhanced Dashboard Chatbot Engine
 * Handles complex queries about detailed dashboard content and sections
 */

class EnhancedDashboardChatbot extends DashboardChatbot {
    constructor() {
        super();
        this.knowledgeBase = new EnhancedChatbotKnowledgeBase();
        this.enhancedPatterns = {
            counting: /(?:how many|count|number of|total|sum of)/i,
            monthAnalysis: /(?:months?|outpaced|growth|decline|opposite direction)/i,
            expenseCategories: /(?:expenses?|categories|grew faster|outpaced growth)/i,
            actionItems: /(?:immediate actions?|should do|next steps?|recommendations?|improve)/i,
            performanceAnalysis: /(?:operational performance|what went well|what can be improved|insights?)/i,
            thresholds: /(?:3 or more|3\+|three or more|at least 3|3 months)/i
        };
    }

    // Enhanced question processing
    async processQuestion(userInput) {
        try {
            if (!this.isInitialized) {
                return "I'm still loading dashboard data. Please try again in a moment.";
            }

            // Update current data with enhanced extraction
            this.currentData = this.knowledgeBase.extractDashboardData();

            // Clean and normalize input
            const cleanInput = userInput.toLowerCase().trim();

            // Add to conversation history
            this.conversationHistory.push({
                type: 'user',
                message: userInput,
                timestamp: new Date()
            });

            // First try enhanced analysis for complex questions
            const complexResponse = this.handleComplexQuery(cleanInput, userInput);
            if (complexResponse) {
                this.conversationHistory.push({
                    type: 'bot',
                    message: complexResponse,
                    timestamp: new Date()
                });
                return complexResponse;
            }

            // Fall back to regular processing
            return super.processQuestion(userInput);
        } catch (error) {
            console.error('Error processing question:', error);
            // Fall back to basic processing on any error
            return super.processQuestion(userInput);
        }
    }

    // Handle complex queries about dashboard sections
    handleComplexQuery(cleanInput, originalInput) {
        try {
            // Check for counting questions about outpaced growth
            if (this.matchesPattern(cleanInput, ['how many', 'outpaced', 'growth']) ||
                this.matchesPattern(cleanInput, ['count', 'months', 'outpaced']) ||
                this.matchesPattern(cleanInput, ['3 or more', 'months', 'outpaced'])) {
                return this.handleOutpacedGrowthQuery(cleanInput);
            }

            // Check for "expenses grew faster than GP" questions
            if (this.matchesPattern(cleanInput, ['grew faster than gp']) ||
                this.matchesPattern(cleanInput, ['expenses grew faster']) ||
                this.matchesPattern(cleanInput, ['how many', 'grew faster'])) {
                return this.handleExpenseGrowthQuery(cleanInput);
            }

            // Check for immediate actions questions
            if (this.matchesPattern(cleanInput, ['immediate actions']) ||
                this.matchesPattern(cleanInput, ['should do next']) ||
                this.matchesPattern(cleanInput, ['improve operational performance']) ||
                this.matchesPattern(cleanInput, ['what you should do'])) {
                return this.handleImmediateActionsQuery(cleanInput);
            }

            // Check for operational performance questions
            if (this.matchesPattern(cleanInput, ['operational performance']) ||
                this.matchesPattern(cleanInput, ['what went well']) ||
                this.matchesPattern(cleanInput, ['what can be improved'])) {
                return this.handleOperationalPerformanceQuery(cleanInput);
            }

            // Check for revenue cycle questions
            if (this.matchesPattern(cleanInput, ['revenue cycle']) ||
                this.matchesPattern(cleanInput, ['underperforming weeks']) ||
                this.matchesPattern(cleanInput, ['missed revenue'])) {
                return this.handleRevenueCycleQuery(cleanInput);
            }

            return null; // No complex match found
        } catch (error) {
            console.error('Error in complex query handling:', error);
            return null;
        }
    }

    // Handle questions about expenses that outpaced growth
    handleOutpacedGrowthQuery(input) {
        const sections = this.currentData.sections || {};
        const tableData = sections.growthRiskTable;

        if (!tableData || !tableData.rows) {
            return "I cannot find the expense trends data on this page. Please make sure you're on the Margin Optimization (expense management) dashboard.";
        }

        // Extract threshold from question (default to 3)
        const thresholdMatch = input.match(/(\d+)\s*(?:or more|plus|\+|months)/);
        const threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : 3;

        // Filter categories by threshold
        const categoriesAboveThreshold = tableData.rows.filter(row => row.monthsOutpaced >= threshold);

        if (categoriesAboveThreshold.length === 0) {
            return `No expense categories have ${threshold} or more months when expenses outpaced growth.`;
        }

        const categoryNames = categoriesAboveThreshold.map(row => row.category);
        const response = `${categoriesAboveThreshold.length} expense categor${categoriesAboveThreshold.length === 1 ? 'y has' : 'ies have'} ${threshold} or more months when expenses outpaced growth:\n\n${categoryNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}`;

        // Add additional context if available
        if (categoriesAboveThreshold.length > 0) {
            const maxMonths = Math.max(...categoriesAboveThreshold.map(row => row.monthsOutpaced));
            const worstCategory = categoriesAboveThreshold.find(row => row.monthsOutpaced === maxMonths);
            return response + `\n\nThe worst performer is "${worstCategory.category}" with ${maxMonths} months of outpacing growth.`;
        }

        return response;
    }

    // Handle questions about expenses that grew faster than GP
    handleExpenseGrowthQuery(input) {
        try {
            const sections = this.currentData.sections || {};
            const outpacedData = sections.expenseOutpaced;

            if (!outpacedData) {
                // Try to extract the data directly if sections aren't populated
                const element = document.getElementById('expenseOutpacedText');
                if (element && element.textContent && element.textContent !== 'Loading...') {
                    const text = element.textContent.trim();
                    const categories = text.split(',').map(cat => cat.trim()).filter(cat => cat && cat !== 'None');

                    if (categories.length === 0 || text.toLowerCase().includes('none')) {
                        return "No expenses grew faster than GP in the most recent month. This is good news for your margin health!";
                    }

                    return `${categories.length} expense categor${categories.length === 1 ? 'y' : 'ies'} grew faster than GP in the most recent month:\n\n${categories.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}\n\nThese categories warrant immediate investigation as they pose a risk to your profit margins.`;
                }

                return "I cannot find the 'Expenses Grew Faster Than GP' data on this page. Please make sure you're on the Margin Optimization (expense management) dashboard.";
            }

            if (outpacedData.count === 0 || (outpacedData.text && outpacedData.text.toLowerCase().includes('none'))) {
                return "No expenses grew faster than GP in the most recent month. This is good news for your margin health!";
            }

            return `${outpacedData.count} expense categor${outpacedData.count === 1 ? 'y' : 'ies'} grew faster than GP in the most recent month:\n\n${outpacedData.categories.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}\n\nThese categories warrant immediate investigation as they pose a risk to your profit margins.`;
        } catch (error) {
            console.error('Error in handleExpenseGrowthQuery:', error);
            // Try basic extraction as fallback
            const element = document.getElementById('expenseOutpacedText');
            if (element && element.textContent) {
                return `Based on the data shown: ${element.textContent}`;
            }
            return "I'm having trouble accessing that specific data. Please try asking about profit margin, revenue, or expenses instead.";
        }
    }

    // Handle immediate actions questions
    handleImmediateActionsQuery(input) {
        const sections = this.currentData.sections || {};
        const actionsData = sections.immediateActions;

        if (!actionsData) {
            return "I cannot find the immediate actions data on this page. Please make sure you're on the Revenue Performance dashboard to see 'What You Should Do Next' recommendations.";
        }

        let response = "Here are the immediate actions you should consider to improve operational performance:\n\n";

        if (actionsData.operational && actionsData.operational.length > 0) {
            response += "**🚀 Operational Performance - Next 30 Days:**\n";
            actionsData.operational.forEach((action, i) => {
                response += `${i + 1}. ${action}\n`;
            });
        }

        if (actionsData.revenueCycle && actionsData.revenueCycle.length > 0) {
            response += "\n**💰 Revenue Cycle Efficiency - Next 30 Days:**\n";
            actionsData.revenueCycle.forEach((action, i) => {
                response += `${i + 1}. ${action}\n`;
            });
        }

        if (actionsData.operational.length === 0 && actionsData.revenueCycle.length === 0) {
            return "No immediate actions are currently listed. This might indicate strong performance across all metrics!";
        }

        return response.trim();
    }

    // Handle operational performance questions
    handleOperationalPerformanceQuery(input) {
        const sections = this.currentData.sections || {};
        const insightsData = sections.revenueInsights;

        if (!insightsData) {
            return "I cannot find operational performance insights on this page. These insights are typically available on the Revenue Performance dashboard.";
        }

        let response = "Here are the operational performance insights:\n\n";

        if (insightsData.whatWentWell && insightsData.whatWentWell.length > 0) {
            response += "**✅ What Went Well:**\n";
            insightsData.whatWentWell.forEach((insight, i) => {
                response += `• ${insight}\n`;
            });
        }

        if (insightsData.whatCanImprove && insightsData.whatCanImprove.length > 0) {
            response += "\n**⚠️ What Can Be Improved:**\n";
            insightsData.whatCanImprove.forEach((insight, i) => {
                response += `• ${insight}\n`;
            });
        }

        return response.trim() || "No specific operational performance insights are currently available.";
    }

    // Handle revenue cycle questions
    handleRevenueCycleQuery(input) {
        const sections = this.currentData.sections || {};
        const weeklyData = sections.weeklyPerformance;

        if (!weeklyData) {
            return "I cannot find weekly performance data on this page. Please make sure you're on the Revenue Performance dashboard.";
        }

        if (input.includes('underperforming')) {
            const underperforming = weeklyData.underperforming || [];
            if (underperforming.length === 0) {
                return "No weeks are currently identified as underperforming. Great job maintaining consistent performance!";
            }

            let response = `${underperforming.length} week${underperforming.length === 1 ? '' : 's'} ${underperforming.length === 1 ? 'is' : 'are'} identified as underperforming:\n\n`;
            underperforming.forEach((week, i) => {
                response += `${i + 1}. Week ${week.Week || 'Unknown'} - ${week['Performance Diagnostic'] || 'Underperformed'}\n`;
            });

            return response + "\nReview these weeks to identify opportunities to capture missed revenue or avoid similar performance issues.";
        }

        return "I can provide information about weekly performance, underperforming weeks, and revenue cycle efficiency. What specific aspect would you like to know about?";
    }

    // Utility method to check if input matches multiple patterns
    matchesPattern(input, patterns) {
        return patterns.every(pattern => input.includes(pattern.toLowerCase()));
    }

    // Enhanced intent analysis
    analyzeIntent(input) {
        // Check for complex patterns first
        if (this.enhancedPatterns.counting.test(input) && this.enhancedPatterns.monthAnalysis.test(input)) {
            return 'complex_counting';
        }

        if (this.enhancedPatterns.expenseCategories.test(input)) {
            return 'expense_analysis';
        }

        if (this.enhancedPatterns.actionItems.test(input)) {
            return 'action_items';
        }

        if (this.enhancedPatterns.performanceAnalysis.test(input)) {
            return 'performance_analysis';
        }

        // Fall back to parent class method
        return super.analyzeIntent(input);
    }

    // Enhanced entity extraction
    extractEntities(input) {
        const entities = super.extractEntities(input);

        // Extract numbers for thresholds
        const numbers = input.match(/\d+/g);
        if (numbers) {
            entities.numbers = numbers.map(n => parseInt(n));
        }

        // Extract section references
        entities.sections = [];
        if (input.includes('outpaced growth') || input.includes('months outpaced')) {
            entities.sections.push('growthRiskTable');
        }
        if (input.includes('grew faster than gp')) {
            entities.sections.push('expenseOutpaced');
        }
        if (input.includes('immediate actions') || input.includes('should do next')) {
            entities.sections.push('immediateActions');
        }

        return entities;
    }
}

// Export the enhanced chatbot class
window.EnhancedDashboardChatbot = EnhancedDashboardChatbot;