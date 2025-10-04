/**
 * Dashboard Chatbot UI Component
 * Creates and manages the floating chat interface
 */

class ChatbotUI {
    constructor() {
        this.isOpen = false;
        this.isMinimized = false;
        this.chatbot = null;
        this.messagesContainer = null;
        this.inputField = null;
        this.isTyping = false;

        this.init();
    }

    init() {
        this.createChatbotStyles();
        this.createChatbotHTML();
        this.attachEventListeners();
        this.initializeChatbot();
        this.showWelcomeMessage();
    }

    createChatbotStyles() {
        const styles = `
            <style id="chatbot-styles">
                /* Chatbot Container */
                .chatbot-widget {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 10000;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                /* Chat Button */
                .chatbot-toggle {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border: none;
                    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    transition: all 0.3s ease;
                    position: relative;
                }

                .chatbot-toggle:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4);
                }

                .chatbot-toggle.active {
                    background: linear-gradient(135deg, #764ba2, #667eea);
                }

                /* Notification Badge */
                .chatbot-notification {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    width: 20px;
                    height: 20px;
                    background: #e53e3e;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    transform: scale(0);
                    transition: transform 0.3s ease;
                }

                .chatbot-notification.show {
                    transform: scale(1);
                }

                /* Chat Window */
                .chatbot-window {
                    position: absolute;
                    bottom: 70px;
                    right: 0;
                    width: 350px;
                    height: 500px;
                    background: white;
                    border-radius: 15px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }

                .chatbot-window.open {
                    display: flex;
                    animation: slideUp 0.3s ease-out;
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* Chat Header */
                .chatbot-header {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .chatbot-title {
                    font-weight: 600;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .chatbot-controls {
                    display: flex;
                    gap: 10px;
                }

                .chatbot-control-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 30px;
                    height: 30px;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s ease;
                }

                .chatbot-control-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                /* Messages Container */
                .chatbot-messages {
                    flex: 1;
                    padding: 15px;
                    overflow-y: auto;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .chatbot-messages::-webkit-scrollbar {
                    width: 6px;
                }

                .chatbot-messages::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }

                .chatbot-messages::-webkit-scrollbar-thumb {
                    background: #c1c1c1;
                    border-radius: 3px;
                }

                /* Message Bubbles */
                .message {
                    max-width: 80%;
                    padding: 10px 14px;
                    border-radius: 18px;
                    font-size: 14px;
                    line-height: 1.4;
                    animation: messageSlide 0.3s ease-out;
                }

                @keyframes messageSlide {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .message.user {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    align-self: flex-end;
                    margin-left: auto;
                }

                .message.bot {
                    background: white;
                    color: #2d3748;
                    align-self: flex-start;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                /* Typing Indicator */
                .typing-indicator {
                    background: white;
                    border: 1px solid #e2e8f0;
                    padding: 10px 14px;
                    border-radius: 18px;
                    align-self: flex-start;
                    display: none;
                    max-width: 80px;
                }

                .typing-indicator.show {
                    display: block;
                    animation: messageSlide 0.3s ease-out;
                }

                .typing-dots {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                }

                .typing-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #cbd5e0;
                    animation: typingBounce 1.4s infinite;
                }

                .typing-dot:nth-child(2) {
                    animation-delay: 0.2s;
                }

                .typing-dot:nth-child(3) {
                    animation-delay: 0.4s;
                }

                @keyframes typingBounce {
                    0%, 60%, 100% {
                        transform: translateY(0);
                    }
                    30% {
                        transform: translateY(-10px);
                    }
                }

                /* Quick Actions */
                .chatbot-quick-actions {
                    padding: 10px 15px;
                    background: white;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .quick-action-btn {
                    background: #f7fafc;
                    border: 1px solid #e2e8f0;
                    padding: 6px 12px;
                    border-radius: 15px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #4a5568;
                }

                .quick-action-btn:hover {
                    background: #edf2f7;
                    border-color: #cbd5e0;
                }

                /* Input Area */
                .chatbot-input-area {
                    padding: 15px;
                    background: white;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .chatbot-input {
                    flex: 1;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 10px 15px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s ease;
                }

                .chatbot-input:focus {
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }

                .chatbot-send-btn {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border: none;
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .chatbot-send-btn:hover {
                    transform: scale(1.05);
                }

                .chatbot-send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                /* Mobile Responsiveness */
                @media (max-width: 768px) {
                    .chatbot-window {
                        width: 300px;
                        height: 450px;
                        bottom: 70px;
                        right: -10px;
                    }
                }

                @media (max-width: 480px) {
                    .chatbot-widget {
                        bottom: 15px;
                        right: 15px;
                    }

                    .chatbot-window {
                        width: calc(100vw - 30px);
                        height: 400px;
                        right: -15px;
                    }
                }
            </style>
        `;

        if (!document.getElementById('chatbot-styles')) {
            document.head.insertAdjacentHTML('beforeend', styles);
        }
    }

    createChatbotHTML() {
        const chatbotHTML = `
            <div class="chatbot-widget" id="chatbot-widget">
                <!-- Toggle Button -->
                <button class="chatbot-toggle" id="chatbot-toggle">
                    <span id="chatbot-icon">💬</span>
                    <div class="chatbot-notification" id="chatbot-notification">1</div>
                </button>

                <!-- Chat Window -->
                <div class="chatbot-window" id="chatbot-window">
                    <!-- Header -->
                    <div class="chatbot-header">
                        <div class="chatbot-title">
                            <span>🤖</span>
                            Dashboard Assistant
                        </div>
                        <div class="chatbot-controls">
                            <button class="chatbot-control-btn" id="chatbot-minimize" title="Minimize">
                                <span>−</span>
                            </button>
                            <button class="chatbot-control-btn" id="chatbot-close" title="Close">
                                <span>×</span>
                            </button>
                        </div>
                    </div>

                    <!-- Messages -->
                    <div class="chatbot-messages" id="chatbot-messages">
                        <!-- Messages will be added here -->
                    </div>

                    <!-- Typing Indicator -->
                    <div class="typing-indicator" id="typing-indicator">
                        <div class="typing-dots">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="chatbot-quick-actions" id="chatbot-quick-actions">
                        <button class="quick-action-btn" data-question="What's our profit margin?">Profit Margin</button>
                        <button class="quick-action-btn" data-question="How many expenses outpaced growth?">Outpaced Growth</button>
                        <button class="quick-action-btn" data-question="What expenses grew faster than GP?">Grew Faster</button>
                        <button class="quick-action-btn" data-question="What immediate actions should I take?">Actions</button>
                    </div>

                    <!-- Input Area -->
                    <div class="chatbot-input-area">
                        <input
                            type="text"
                            class="chatbot-input"
                            id="chatbot-input"
                            placeholder="Ask about your dashboard data..."
                            maxlength="500"
                        >
                        <button class="chatbot-send-btn" id="chatbot-send" disabled>
                            <span>➤</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
        this.messagesContainer = document.getElementById('chatbot-messages');
        this.inputField = document.getElementById('chatbot-input');
    }

    attachEventListeners() {
        // Toggle button
        document.getElementById('chatbot-toggle').addEventListener('click', () => {
            this.toggleChat();
        });

        // Control buttons
        document.getElementById('chatbot-close').addEventListener('click', () => {
            this.closeChat();
        });

        document.getElementById('chatbot-minimize').addEventListener('click', () => {
            this.minimizeChat();
        });

        // Input handling
        this.inputField.addEventListener('input', () => {
            this.handleInputChange();
        });

        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('chatbot-send').addEventListener('click', () => {
            this.sendMessage();
        });

        // Quick action buttons
        document.getElementById('chatbot-quick-actions').addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const question = e.target.getAttribute('data-question');
                if (question) {
                    this.inputField.value = question;
                    this.sendMessage();
                }
            }
        });
    }

    initializeChatbot() {
        // Use the complete standalone chatbot
        if (typeof CompleteChatbot !== 'undefined') {
            this.chatbot = new CompleteChatbot();
        } else {
            console.error('CompleteChatbot not found');
            this.chatbot = null;
        }
    }

    showWelcomeMessage() {
        setTimeout(() => {
            this.addMessage('bot', "👋 Hi! I'm your dashboard assistant. I can help you understand all your financial data, from basic metrics to detailed analysis. Try asking: 'How many expenses outpaced growth?', 'What immediate actions should I take?', or 'What expenses grew faster than GP?'");
            this.showNotification();
        }, 1000);
    }

    toggleChat() {
        const window = document.getElementById('chatbot-window');
        const toggle = document.getElementById('chatbot-toggle');
        const icon = document.getElementById('chatbot-icon');

        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        const window = document.getElementById('chatbot-window');
        const toggle = document.getElementById('chatbot-toggle');
        const icon = document.getElementById('chatbot-icon');

        window.classList.add('open');
        toggle.classList.add('active');
        icon.textContent = '×';
        this.isOpen = true;
        this.hideNotification();

        // Focus input
        setTimeout(() => {
            this.inputField.focus();
        }, 300);
    }

    closeChat() {
        const window = document.getElementById('chatbot-window');
        const toggle = document.getElementById('chatbot-toggle');
        const icon = document.getElementById('chatbot-icon');

        window.classList.remove('open');
        toggle.classList.remove('active');
        icon.textContent = '💬';
        this.isOpen = false;
    }

    minimizeChat() {
        this.closeChat();
        this.isMinimized = true;
    }

    handleInputChange() {
        const sendBtn = document.getElementById('chatbot-send');
        const hasText = this.inputField.value.trim().length > 0;
        sendBtn.disabled = !hasText;
    }

    async sendMessage() {
        const message = this.inputField.value.trim();
        if (!message || this.isTyping) return;

        // Add user message
        this.addMessage('user', message);
        this.inputField.value = '';
        this.handleInputChange();

        // Show typing indicator
        this.showTyping();

        try {
            // Get response from chatbot
            const response = await this.chatbot.processQuestion(message);

            // Hide typing and show response
            setTimeout(() => {
                this.hideTyping();
                this.addMessage('bot', response);
            }, 1000 + Math.random() * 1000); // Simulate realistic typing time

        } catch (error) {
            console.error('Error processing message:', error);
            this.hideTyping();
            this.addMessage('bot', "I'm sorry, I'm having trouble processing that question. Please try again.");
        }
    }

    addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = text;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTyping() {
        this.isTyping = true;
        const typingIndicator = document.getElementById('typing-indicator');
        typingIndicator.classList.add('show');
        this.scrollToBottom();
    }

    hideTyping() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        typingIndicator.classList.remove('show');
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }

    showNotification() {
        const notification = document.getElementById('chatbot-notification');
        notification.classList.add('show');
    }

    hideNotification() {
        const notification = document.getElementById('chatbot-notification');
        notification.classList.remove('show');
    }

    // Public methods for external use
    addSystemMessage(message) {
        this.addMessage('bot', message);
    }

    clearConversation() {
        this.messagesContainer.innerHTML = '';
        if (this.chatbot) {
            this.chatbot.clearHistory();
        }
        this.showWelcomeMessage();
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure other scripts are loaded
    setTimeout(() => {
        // Check for CompleteChatbot
        if (typeof CompleteChatbot !== 'undefined') {
            console.log('Loading complete chatbot...');
            window.dashboardChatbotUI = new ChatbotUI();
        } else {
            console.error('CompleteChatbot not loaded');
        }
    }, 1500);
});

// Export for use in other files
window.ChatbotUI = ChatbotUI;