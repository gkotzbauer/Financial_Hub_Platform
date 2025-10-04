/**
 * Dashboard Chatbot Engine
 * Processes user questions and generates contextual responses based on dashboard data
 */

class DashboardChatbot {
    constructor() {
        this.knowledgeBase = new ChatbotKnowledgeBase();
        this.conversationHistory = [];
        this.isInitialized = false;
        this.currentData = null;

        this.init();
    }

    init() {
        this.currentData = this.knowledgeBase.extractDashboardData();
        this.isInitialized = true;
        console.log('Chatbot initialized with data:', this.currentData);
    }

    // Main method to process user questions
    async processQuestion(userInput) {
        if (!this.isInitialized) {
            return "I'm still loading dashboard data. Please try again in a moment.";
        }

        // Update current data
        this.currentData = this.knowledgeBase.extractDashboardData();

        // Clean and normalize input
        const cleanInput = userInput.toLowerCase().trim();

        // Add to conversation history
        this.conversationHistory.push({
            type: 'user',
            message: userInput,
            timestamp: new Date()
        });

        // Analyze the question
        const intent = this.analyzeIntent(cleanInput);
        const entities = this.extractEntities(cleanInput);

        // Generate response
        const response = this.generateResponse(intent, entities, cleanInput);

        // Add response to history
        this.conversationHistory.push({
            type: 'bot',
            message: response,
            timestamp: new Date()
        });

        return response;
    }

    // Analyze user intent
    analyzeIntent(input) {
        const patterns = this.knowledgeBase.questionPatterns;

        for (const [intentType, keywords] of Object.entries(patterns)) {
            for (const keyword of keywords) {
                if (input.includes(keyword)) {
                    return intentType;
                }
            }
        }

        // Check for common question patterns
        for (const commonQ of this.knowledgeBase.commonQuestions) {
            for (const pattern of commonQ.patterns) {
                if (input.includes(pattern)) {
                    return commonQ.response_type;
                }
            }
        }

        return 'general';
    }

    // Extract entities (metrics, values, etc.) from user input
    extractEntities(input) {
        const entities = {
            metrics: [],
            timeframes: [],
            values: []
        };

        // Look for metric mentions
        const metricKeywords = {
            'profit_margin': ['profit margin', 'margin', 'profitability'],
            'total_revenue': ['revenue', 'income', 'earnings', 'sales'],
            'total_expenses': ['expenses', 'costs', 'spending', 'expenditure'],
            'profit_per_visit': ['profit per visit', 'profit visit', 'per visit', 'visit profit']
        };

        for (const [metric, keywords] of Object.entries(metricKeywords)) {
            for (const keyword of keywords) {
                if (input.includes(keyword)) {
                    entities.metrics.push(metric);
                    break;
                }
            }
        }

        // Look for timeframes
        const timeframes = ['this month', 'last month', 'this year', 'ytd', 'current', 'now'];
        for (const timeframe of timeframes) {
            if (input.includes(timeframe)) {
                entities.timeframes.push(timeframe);
            }
        }

        return entities;
    }

    // Generate contextual response
    generateResponse(intent, entities, input) {
        try {
            switch (intent) {
                case 'metric_query':
                case 'metric_analysis':
                    return this.handleMetricQuery(entities, input);

                case 'trend':
                    return this.handleTrendQuery(entities, input);

                case 'explanation':
                    return this.handleExplanationQuery(entities, input);

                case 'recommendation':
                case 'recommendations':
                    return this.handleRecommendationQuery(entities, input);

                case 'comparison':
                    return this.handleComparisonQuery(entities, input);

                case 'performance':
                case 'overall_performance':
                    return this.handlePerformanceQuery(entities, input);

                default:
                    return this.handleGeneralQuery(input);
            }
        } catch (error) {
            console.error('Error generating response:', error);
            return "I'm having trouble processing that question. Could you try rephrasing it?";
        }
    }

    // Handle metric-specific queries
    handleMetricQuery(entities, input) {
        if (entities.metrics.length === 0) {
            return "I can help you with metrics like profit margin, revenue, expenses, and profit per visit. What would you like to know?";
        }

        const metric = entities.metrics[0];
        const data = this.currentData.metrics;

        switch (metric) {
            case 'profit_margin':
                if (data.profitMargin) {
                    const context = this.knowledgeBase.getBusinessContext('profit_margin', data.profitMargin.value);
                    return `Your profit margin is ${data.profitMargin.formatted}. ${context}`;
                }
                break;

            case 'total_revenue':
                if (data.totalRevenue) {
                    return `Your total revenue is ${data.totalRevenue.formatted}. This represents all income generated from patient visits and services.`;
                }
                break;

            case 'total_expenses':
                if (data.totalExpenses) {
                    const ratio = data.totalRevenue ?
                        Math.round((data.totalExpenses.value / data.totalRevenue.value) * 100) : null;
                    const ratioText = ratio ? ` This represents ${ratio}% of your total revenue.` : '';
                    return `Your total expenses are ${data.totalExpenses.formatted}.${ratioText}`;
                }
                break;

            case 'profit_per_visit':
                if (data.profitPerVisit) {
                    const context = this.knowledgeBase.getBusinessContext('profit_per_visit', data.profitPerVisit.value);
                    return `Your profit per visit is ${data.profitPerVisit.formatted}. ${context}`;
                }
                break;
        }

        return `I don't have current data for ${metric.replace('_', ' ')} on this page. Try asking about profit margin, revenue, expenses, or profit per visit.`;
    }

    // Handle trend queries
    handleTrendQuery(entities, input) {
        return `Based on your current metrics, I can see your profit margin is ${this.currentData.metrics.profitMargin?.formatted || 'unavailable'}. For detailed trend analysis, visit the Margin Optimization dashboard where you can see year-over-year changes and growth patterns.`;
    }

    // Handle explanation queries
    handleExplanationQuery(entities, input) {
        // Look for terms that need explanation
        for (const [term, definition] of Object.entries(this.knowledgeBase.definitions)) {
            if (input.includes(term)) {
                return `${term.charAt(0).toUpperCase() + term.slice(1)}: ${definition}`;
            }
        }

        return "I can explain terms like profit margin, profit per visit, revenue cycle, and expense ratio. What would you like me to explain?";
    }

    // Handle recommendation queries
    handleRecommendationQuery(entities, input) {
        const data = this.currentData.metrics;
        let recommendations = [];

        if (data.profitMargin && data.profitMargin.value < 15) {
            recommendations.push("Focus on expense optimization to improve your profit margin");
        }

        if (data.profitPerVisit && data.profitPerVisit.value < 25) {
            recommendations.push("Consider strategies to increase revenue per patient visit");
        }

        if (recommendations.length > 0) {
            return `Based on your current performance, I recommend: ${recommendations.join('; ')}. Visit the Margin Optimization dashboard for detailed analysis and action plans.`;
        }

        return "Your current metrics look healthy! Continue monitoring your margin optimization dashboard for ongoing insights and opportunities.";
    }

    // Handle comparison queries
    handleComparisonQuery(entities, input) {
        const data = this.currentData.metrics;

        if (data.totalRevenue && data.totalExpenses) {
            const ratio = Math.round((data.totalExpenses.value / data.totalRevenue.value) * 100);
            return `Your expenses (${data.totalExpenses.formatted}) represent ${ratio}% of your revenue (${data.totalRevenue.formatted}). This means ${100-ratio}% of revenue converts to profit.`;
        }

        return "I can compare metrics like revenue vs expenses. What specific comparison would you like to see?";
    }

    // Handle performance queries
    handlePerformanceQuery(entities, input) {
        const data = this.currentData.metrics;
        let performance = [];

        if (data.profitMargin) {
            if (data.profitMargin.value >= 15) {
                performance.push(`Excellent profit margin (${data.profitMargin.formatted})`);
            } else if (data.profitMargin.value >= 10) {
                performance.push(`Good profit margin (${data.profitMargin.formatted})`);
            } else {
                performance.push(`Profit margin needs improvement (${data.profitMargin.formatted})`);
            }
        }

        if (data.profitPerVisit) {
            if (data.profitPerVisit.value >= 30) {
                performance.push(`Strong profit per visit (${data.profitPerVisit.formatted})`);
            } else if (data.profitPerVisit.value >= 20) {
                performance.push(`Solid profit per visit (${data.profitPerVisit.formatted})`);
            } else {
                performance.push(`Profit per visit has room for growth (${data.profitPerVisit.formatted})`);
            }
        }

        if (performance.length > 0) {
            return `Here's your current performance summary: ${performance.join('; ')}.`;
        }

        return "I need more data to assess your performance. Make sure you're on a page with your key metrics displayed.";
    }

    // Handle general queries
    handleGeneralQuery(input) {
        const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon'];
        if (greetings.some(greeting => input.includes(greeting))) {
            return `Hello! I'm here to help you understand your ${this.currentData.pageContext?.name || 'dashboard'} data. You can ask me about your profit margin, revenue, expenses, or performance trends.`;
        }

        if (input.includes('help') || input.includes('what can you do')) {
            return "I can help you understand your financial metrics! Try asking: 'What's our profit margin?', 'How are our expenses?', 'What should we improve?', or 'How are we performing?'";
        }

        return "I'm here to help with your dashboard data. You can ask me about profit margins, revenue, expenses, trends, or performance. What would you like to know?";
    }

    // Get conversation history
    getConversationHistory() {
        return this.conversationHistory;
    }

    // Clear conversation history
    clearHistory() {
        this.conversationHistory = [];
    }
}

// Export for use in other files
window.DashboardChatbot = DashboardChatbot;