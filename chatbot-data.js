/**
 * Chatbot Knowledge Base and Data Corpus
 * Contains all the information needed for the dashboard chatbot to respond to questions
 */

class ChatbotKnowledgeBase {
    constructor() {
        this.definitions = {
            "profit margin": "The percentage of revenue that remains after all expenses are deducted. It shows how efficiently your business converts revenue into profit.",
            "profit per visit": "The average profit generated from each patient visit. This is calculated by dividing total profit by the number of visits.",
            "total revenue": "The total amount of money generated from all patient visits and services during a specific period.",
            "total expenses": "The sum of all operational costs including staff, supplies, rent, and other business expenses.",
            "yoy analysis": "Year-over-year comparison that shows growth or decline trends by comparing the same period in different years.",
            "expense ratio": "The percentage of revenue consumed by expenses. Lower ratios indicate better cost control.",
            "revenue cycle": "The process from patient registration through payment collection, measuring how efficiently revenue is generated and collected.",
            "margin optimization": "The process of maximizing profit margins through strategic expense management and revenue enhancement."
        };

        this.businessContext = {
            type: "Urgent Care Facility",
            industry_benchmarks: {
                profit_margin: {
                    excellent: "> 15%",
                    good: "10-15%",
                    needs_improvement: "< 10%"
                },
                profit_per_visit: {
                    excellent: "> $30",
                    good: "$20-30",
                    needs_improvement: "< $20"
                }
            }
        };

        this.questionPatterns = {
            metric_query: [
                "what is", "what's", "how much", "current", "show me", "tell me about"
            ],
            comparison: [
                "vs", "versus", "compared to", "difference between", "higher", "lower"
            ],
            trend: [
                "trend", "trending", "growing", "increasing", "decreasing", "improving", "declining", "going up", "going down"
            ],
            explanation: [
                "why", "how", "what does", "explain", "meaning", "definition", "help me understand"
            ],
            recommendation: [
                "should", "recommend", "suggest", "what can", "how to improve", "how to increase", "advice"
            ],
            performance: [
                "performance", "performing", "good", "bad", "well", "poorly"
            ]
        };

        this.responseTemplates = {
            metric_value: "Your {metric} is {value}{unit}. {context}",
            trend_positive: "Great news! Your {metric} has improved by {percentage}%, showing {trend_description}.",
            trend_negative: "Your {metric} has declined by {percentage}%. {recommendation}",
            comparison: "{metric1} is {value1} while {metric2} is {value2}. {analysis}",
            explanation: "{metric} {definition} In your case, {contextual_explanation}",
            recommendation: "Based on your {metric} of {value}, I recommend: {suggestions}",
            performance_good: "Your {metric} of {value} is {performance_level}! {encouragement}",
            performance_concern: "Your {metric} of {value} {concern_description} {actionable_advice}"
        };

        this.commonQuestions = [
            {
                patterns: ["profit margin", "margin", "profitable", "profitability"],
                response_type: "metric_analysis",
                metric: "profit_margin"
            },
            {
                patterns: ["revenue", "income", "earnings", "sales"],
                response_type: "metric_analysis",
                metric: "total_revenue"
            },
            {
                patterns: ["expenses", "costs", "spending", "expenditure"],
                response_type: "metric_analysis",
                metric: "total_expenses"
            },
            {
                patterns: ["profit per visit", "profit visit", "visit profit"],
                response_type: "metric_analysis",
                metric: "profit_per_visit"
            },
            {
                patterns: ["performance", "how are we doing", "how am I doing"],
                response_type: "overall_performance"
            },
            {
                patterns: ["improve", "increase profit", "better margins", "optimization"],
                response_type: "recommendations"
            }
        ];

        this.pageContexts = {
            "dashboard.html": {
                name: "Main Dashboard",
                focus: "overview",
                available_metrics: ["totalRevenue", "totalExpenses", "profitPerVisit", "profitMargin"],
                context_intro: "Looking at your main dashboard overview"
            },
            "expense-dashboard.html": {
                name: "Margin Optimization",
                focus: "expense_analysis",
                available_metrics: ["all_expense_metrics", "profitability_analysis", "cost_trends"],
                context_intro: "Analyzing your margin optimization data"
            },
            "revenue-dashboard.html": {
                name: "Revenue Performance",
                focus: "revenue_analysis",
                available_metrics: ["weekly_performance", "revenue_trends", "payer_insights"],
                context_intro: "Looking at your revenue performance analytics"
            }
        };
    }

    // Extract current dashboard data
    extractDashboardData() {
        const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
        const pageContext = this.pageContexts[currentPath];

        const data = {
            currentPage: currentPath,
            pageContext: pageContext,
            metrics: {}
        };

        // Extract metrics from DOM elements
        try {
            const revenueEl = document.getElementById('totalRevenue');
            const expensesEl = document.getElementById('totalExpenses');
            const profitPerVisitEl = document.getElementById('profitPerVisit');
            const profitMarginEl = document.getElementById('profitMargin');

            if (revenueEl) data.metrics.totalRevenue = this.parseValue(revenueEl.textContent);
            if (expensesEl) data.metrics.totalExpenses = this.parseValue(expensesEl.textContent);
            if (profitPerVisitEl) data.metrics.profitPerVisit = this.parseValue(profitPerVisitEl.textContent);
            if (profitMarginEl) data.metrics.profitMargin = this.parseValue(profitMarginEl.textContent);

        } catch (error) {
            console.warn('Could not extract all dashboard data:', error);
        }

        return data;
    }

    // Parse values from DOM text content
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

    // Format numbers for display
    formatCurrency(value) {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        } else {
            return `$${value.toLocaleString()}`;
        }
    }

    // Get business context for a metric
    getBusinessContext(metric, value) {
        const benchmarks = this.businessContext.industry_benchmarks[metric];
        if (!benchmarks) return "";

        if (metric === 'profit_margin') {
            if (value > 15) return "This is excellent for an urgent care facility!";
            if (value >= 10) return "This is a healthy margin for your industry.";
            return "This indicates room for improvement in cost management or revenue optimization.";
        }

        if (metric === 'profit_per_visit') {
            if (value > 30) return "Excellent profit efficiency per patient visit!";
            if (value >= 20) return "Good profit generation per visit.";
            return "There's opportunity to improve profit per patient visit.";
        }

        return "";
    }
}

// Export for use in other files
window.ChatbotKnowledgeBase = ChatbotKnowledgeBase;