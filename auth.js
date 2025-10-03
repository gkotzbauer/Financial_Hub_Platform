/**
 * Authentication Manager for RMT Dashboard
 * Handles login, logout, token management, and authentication state
 */
class AuthManager {
    constructor(autoRedirect = true) {
        // Use relative URL for production, will work on any domain
        this.apiBase = window.location.origin + '/api';
        this.init(autoRedirect);
    }
    
    init(autoRedirect = true) {
        // Check if already logged in
        if (this.isAuthenticated()) {
            if (autoRedirect) {
                window.location.href = '/index.html';
            }
            return;
        }
        
        // Set up login form
        this.setupLoginForm();
        
        // Set up auto-focus
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.focus();
        }
    }
    
    setupLoginForm() {
        const form = document.getElementById('loginForm');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        
        // Only set up form if we're on the login page
        if (!form || !usernameInput || !passwordInput) {
            return;
        }
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Real-time validation
        usernameInput.addEventListener('input', () => this.clearMessages());
        passwordInput.addEventListener('input', () => this.clearMessages());
        
        // Enter key handling
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin();
            }
        });
    }
    
    async handleLogin() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const rememberMeInput = document.getElementById('rememberMe');
        
        if (!usernameInput || !passwordInput || !rememberMeInput) {
            console.error('Login form elements not found');
            return;
        }
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = rememberMeInput.checked;
        
        // Basic validation
        if (!username || !password) {
            this.showError('Please enter both username and password');
            return;
        }
        
        // Show loading state
        this.setLoadingState(true);
        this.clearMessages();
        
        try {
            console.log('Attempting login to:', `${this.apiBase}/login`);
            console.log('Request payload:', { username, password: '***', rememberMe });

            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, rememberMe })
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            const data = await response.json();
            console.log('Response data:', data);
            
            if (response.ok) {
                // Store token and user info
                this.setAuthToken(data.token, rememberMe);
                this.setUserInfo(data.user, rememberMe);
                
                // Show success message briefly
                this.showSuccess('Login successful! Redirecting...');
                
                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1000);
                
            } else {
                this.showError(data.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error details:', error);
            console.error('Error type:', error.name);
            console.error('Error message:', error.message);

            let errorMessage = 'Network error. Please check your connection and try again.';
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = `Failed to connect to server at ${this.apiBase}/login. Server may be down.`;
            }

            this.showError(errorMessage);
        } finally {
            this.setLoadingState(false);
        }
    }
    
    setLoadingState(loading) {
        const loginBtn = document.getElementById('loginBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const loginText = document.getElementById('loginText');
        
        if (!loginBtn || !loadingSpinner || !loginText) {
            console.error('Loading state elements not found');
            return;
        }
        
        if (loading) {
            loginBtn.disabled = true;
            loadingSpinner.style.display = 'inline-block';
            loginText.textContent = 'Signing In...';
        } else {
            loginBtn.disabled = false;
            loadingSpinner.style.display = 'none';
            loginText.textContent = 'Sign In';
        }
    }
    
    setAuthToken(token, rememberMe = false) {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('authToken', token);
    }
    
    setUserInfo(user, rememberMe = false) {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('userInfo', JSON.stringify(user));
    }
    
    getAuthToken() {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    }
    
    getUserInfo() {
        const userInfo = localStorage.getItem('userInfo') || sessionStorage.getItem('userInfo');
        return userInfo ? JSON.parse(userInfo) : null;
    }
    
    isAuthenticated() {
        const token = this.getAuthToken();
        if (!token) return false;

        // For demo purposes, just check if token exists and has the right format
        return token.startsWith('demo-token-');
    }
    
    async verifyToken() {
        const token = this.getAuthToken();
        if (!token) {
            console.log('No token to verify');
            return false;
        }
        
        try {
            console.log('Verifying token with server...');
            const response = await fetch(`${this.apiBase}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('Verification response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Token verification successful, user:', data.user);
                this.setUserInfo(data.user, localStorage.getItem('authToken') !== null);
                return true;
            } else {
                console.log('Token verification failed, status:', response.status);
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Token verification error:', error);
            this.logout();
            return false;
        }
    }
    
    logout() {
        // Clear all stored data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userInfo');
        
        // Redirect to login page
        window.location.href = '/login.html';
    }
    
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        
        if (!errorDiv || !successDiv) {
            console.error('Error message elements not found');
            return;
        }
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    
    showSuccess(message) {
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        
        if (!errorDiv || !successDiv) {
            console.error('Success message elements not found');
            return;
        }
        
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        errorDiv.style.display = 'none';
    }
    
    clearMessages() {
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }
}

/**
 * Dashboard Authentication Manager
 * Handles authentication for the main dashboard
 */
class DashboardAuth {
    constructor() {
        this.apiBase = window.location.origin + '/api';
        this.auth = new AuthManager(false); // Don't auto-redirect
        this.checkAuthentication();
    }
    
    async checkAuthentication() {
        console.log('Checking authentication...');
        const token = this.auth.getAuthToken();
        console.log('Token found:', !!token);

        if (!token) {
            console.log('No token found, redirecting to login');
            window.location.href = '/login.html';
            return;
        }

        // For demo purposes, just check if token exists and starts with 'demo-token-'
        console.log('Validating demo token...');
        if (!token.startsWith('demo-token-')) {
            console.log('Invalid demo token format, redirecting to login');
            window.location.href = '/login.html';
            return;
        }

        console.log('Authentication successful, displaying user info');
        // Display user info in header
        this.displayUserInfo();
    }
    
    displayUserInfo() {
        const user = this.auth.getUserInfo();
        if (!user) return;
        
        // Find the header element
        const header = document.querySelector('.header');
        if (!header) return;
        
        // Create user info section
        const userInfo = document.createElement('div');
        userInfo.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
        `;
        
        userInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                <div>
                    <h1 style="color: #2d3748; font-size: 2.5rem; font-weight: 700; margin-bottom: 10px; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        📊 RMT Margin Performance Dashboard
                    </h1>
                    <p style="color: #718096; font-size: 1.1rem;">Comprehensive margin insights to drive performance optimization and profitability management</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <div style="color: #2d3748; font-weight: 600; font-size: 1rem;">Welcome, ${user.username}</div>
                    <button onclick="dashboardAuth.logout()" style="
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 0.85rem;
                        transition: all 0.3s ease;
                        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                    " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102, 126, 234, 0.3)'">
                        Logout
                    </button>
                </div>
            </div>
            <div style="display: flex; gap: 15px; align-items: center; margin-top: 20px;">
                <nav style="display: flex; gap: 15px; align-items: center;">
                    <a href="/" style="
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white;
                        text-decoration: none;
                        padding: 10px 20px;
                        border-radius: 8px;
                        font-weight: 600;
                        transition: all 0.3s ease;
                        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102, 126, 234, 0.3)'">
                        📊 Margin Dashboard
                    </a>
                    <a href="/revenue-dashboard.html" style="
                        background: linear-gradient(135deg, #48bb78, #38a169);
                        color: white;
                        text-decoration: none;
                        padding: 10px 20px;
                        border-radius: 8px;
                        font-weight: 600;
                        transition: all 0.3s ease;
                        box-shadow: 0 2px 8px rgba(72, 187, 120, 0.3);
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(72, 187, 120, 0.4)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(72, 187, 120, 0.3)'">
                        💰 Revenue Analysis
                    </a>
                </nav>
            </div>
        `;
        
        // Replace header content
        header.innerHTML = userInfo.innerHTML;
    }
    
    logout() {
        // Call logout on API
        fetch(`${this.apiBase}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.auth.getAuthToken()}`
            }
        }).catch(error => {
            console.error('Logout API error:', error);
        });
        
        // Clear local data and redirect
        this.auth.logout();
    }
}

// Initialize based on current page
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname;
    console.log('Auth initialization - Current page:', currentPage);
    
    if (currentPage.includes('login.html') || currentPage === '/login.html') {
        console.log('Initializing login page');
        // Initialize login page
        window.auth = new AuthManager();
    } else if (currentPage.includes('index.html') || currentPage === '/' || currentPage === '/index.html') {
        console.log('Initializing dashboard authentication');
        // Initialize dashboard authentication
        window.dashboardAuth = new DashboardAuth();
    } else {
        console.log('Unknown page, initializing dashboard authentication as fallback');
        // Fallback to dashboard authentication
        window.dashboardAuth = new DashboardAuth();
    }
});

// Global logout function for easy access
window.logout = function() {
    if (window.dashboardAuth) {
        window.dashboardAuth.logout();
    } else if (window.auth) {
        window.auth.logout();
    }
};
