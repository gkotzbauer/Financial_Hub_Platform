/**
 * Authentication Manager for RMT Dashboard
 * Handles login, logout, token management, and authentication state
 */
class AuthManager {
    constructor() {
        this.apiBase = 'http://localhost:3003/api';
        this.init();
    }
    
    init() {
        // Check if already logged in
        if (this.isAuthenticated()) {
            window.location.href = 'index.html';
            return;
        }
        
        // Set up login form
        this.setupLoginForm();
        
        // Set up auto-focus
        document.getElementById('username').focus();
    }
    
    setupLoginForm() {
        const form = document.getElementById('loginForm');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        
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
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // Basic validation
        if (!username || !password) {
            this.showError('Please enter both username and password');
            return;
        }
        
        // Show loading state
        this.setLoadingState(true);
        this.clearMessages();
        
        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, rememberMe })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store token and user info
                this.setAuthToken(data.token, rememberMe);
                this.setUserInfo(data.user, rememberMe);
                
                // Show success message briefly
                this.showSuccess('Login successful! Redirecting...');
                
                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                
            } else {
                this.showError(data.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setLoadingState(false);
        }
    }
    
    setLoadingState(loading) {
        const loginBtn = document.getElementById('loginBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const loginText = document.getElementById('loginText');
        
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
        
        try {
            // Basic token validation (check expiration)
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp > Date.now() / 1000;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }
    
    async verifyToken() {
        const token = this.getAuthToken();
        if (!token) return false;
        
        try {
            const response = await fetch(`${this.apiBase}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.setUserInfo(data.user, localStorage.getItem('authToken') !== null);
                return true;
            } else {
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
        window.location.href = 'login.html';
    }
    
    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        const successDiv = document.getElementById('successMessage');
        
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
        
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        errorDiv.style.display = 'none';
    }
    
    clearMessages() {
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('successMessage').style.display = 'none';
    }
}

/**
 * Dashboard Authentication Manager
 * Handles authentication for the main dashboard
 */
class DashboardAuth {
    constructor() {
        this.apiBase = 'http://localhost:3003/api';
        this.auth = new AuthManager();
        this.checkAuthentication();
    }
    
    async checkAuthentication() {
        const token = this.auth.getAuthToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
        
        // Verify token with server
        const isValid = await this.auth.verifyToken();
        if (!isValid) {
            window.location.href = 'login.html';
            return;
        }
        
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
            <div>
                <h1 style="color: #2d3748; font-size: 2.5rem; font-weight: 700; margin-bottom: 10px; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    RMT Margin Performance Dashboard
                </h1>
                <p style="color: #718096; font-size: 1.1rem;">Comprehensive financial analysis and insights</p>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="text-align: right;">
                    <div style="color: #2d3748; font-weight: 600; font-size: 0.9rem;">Welcome, ${user.username}</div>
                    <div style="color: #718096; font-size: 0.8rem; text-transform: capitalize;">${user.role}</div>
                </div>
                <button onclick="dashboardAuth.logout()" style="
                    background: linear-gradient(135deg, #e53e3e, #c53030);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(229, 62, 62, 0.4)'" 
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(229, 62, 62, 0.3)'">
                    Logout
                </button>
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
    
    if (currentPage.includes('login.html') || currentPage === '/login.html') {
        // Initialize login page
        window.auth = new AuthManager();
    } else if (currentPage.includes('index.html') || currentPage === '/' || currentPage === '/index.html') {
        // Initialize dashboard authentication
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
