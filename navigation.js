/**
 * Unified Navigation Component for RMT Dashboard
 */
class NavigationManager {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    init() {
        // Check authentication first
        if (!this.checkAuth()) {
            console.warn('User not authenticated, navigation may not work properly');
            // Don't redirect, let the page handle authentication
        }

        // Inject navigation HTML
        this.injectNavigation();

        // Set active state
        this.setActiveState();

        // Set user info
        this.setUserInfo();
    }

    checkAuth() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('username');
        return token && user;
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('expense-dashboard')) return 'expense';
        if (path.includes('revenue-dashboard')) return 'revenue';
        if (path.includes('dashboard')) return 'home';
        return '';
    }

    injectNavigation() {
        const navHTML = `
            <nav class="unified-nav">
                <div class="nav-container">
                    <div class="nav-brand">
                        <a href="dashboard.html" class="brand-link">
                            <span class="brand-text">RMT Analytics</span>
                        </a>
                    </div>

                    <div class="nav-menu">
                        <a href="dashboard.html" class="nav-item" data-page="home">
                            <span class="nav-icon">🏠</span>
                            <span class="nav-text">Home</span>
                        </a>
                        <a href="expense-dashboard.html" class="nav-item" data-page="expense">
                            <span class="nav-icon">💰</span>
                            <span class="nav-text">Expenses</span>
                        </a>
                        <a href="revenue-dashboard.html" class="nav-item" data-page="revenue">
                            <span class="nav-icon">📊</span>
                            <span class="nav-text">Revenue</span>
                        </a>
                    </div>

                    <div class="nav-user">
                        <div class="user-info">
                            <span class="user-name" id="navUserName">User</span>
                            <span class="user-role" id="navUserRole">Member</span>
                        </div>
                        <button class="nav-logout" onclick="handleNavLogout()">
                            <span class="logout-icon">🚪</span>
                            <span class="logout-text">Logout</span>
                        </button>
                    </div>
                </div>
            </nav>
        `;

        const navStyles = `
            <style>
                .unified-nav {
                    background: rgba(255, 255, 255, 0.98);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    margin-bottom: 20px;
                }

                .nav-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    height: 70px;
                }

                .nav-brand {
                    flex-shrink: 0;
                }

                .brand-link {
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .brand-text {
                    font-size: 1.5rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .nav-menu {
                    display: flex;
                    gap: 10px;
                    flex: 1;
                    justify-content: center;
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 10px;
                    text-decoration: none;
                    color: #4a5568;
                    transition: all 0.3s ease;
                    font-weight: 500;
                }

                .nav-item:hover {
                    background: rgba(102, 126, 234, 0.1);
                    color: #667eea;
                    transform: translateY(-2px);
                }

                .nav-item.active {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }

                .nav-icon {
                    font-size: 1.2rem;
                }

                .nav-user {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .user-info {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 2px;
                }

                .user-name {
                    font-weight: 600;
                    color: #2d3748;
                    font-size: 0.95rem;
                }

                .user-role {
                    font-size: 0.8rem;
                    color: #718096;
                }

                .nav-logout {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .nav-logout:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
                }

                .logout-icon {
                    font-size: 1rem;
                }

                /* Mobile Responsive */
                @media (max-width: 768px) {
                    .nav-container {
                        flex-wrap: wrap;
                        height: auto;
                        padding: 15px;
                    }

                    .nav-brand {
                        width: 100%;
                        margin-bottom: 15px;
                        text-align: center;
                    }

                    .nav-menu {
                        width: 100%;
                        justify-content: space-around;
                        margin-bottom: 15px;
                    }

                    .nav-item {
                        padding: 8px 12px;
                        font-size: 0.9rem;
                    }

                    .nav-text {
                        display: none;
                    }

                    .nav-user {
                        width: 100%;
                        justify-content: space-between;
                    }
                }

                @media (max-width: 480px) {
                    .nav-text {
                        display: inline;
                    }

                    .nav-menu {
                        flex-direction: column;
                        gap: 5px;
                    }

                    .nav-item {
                        width: 100%;
                        justify-content: center;
                    }
                }
            </style>
        `;

        // Add styles to head if not already present
        if (!document.querySelector('#unified-nav-styles')) {
            const styleElement = document.createElement('div');
            styleElement.id = 'unified-nav-styles';
            styleElement.innerHTML = navStyles;
            document.head.appendChild(styleElement);
        }

        // Add navigation to body
        const navElement = document.createElement('div');
        navElement.innerHTML = navHTML;
        document.body.insertBefore(navElement.firstElementChild, document.body.firstChild);
    }

    setActiveState() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.getAttribute('data-page') === this.currentPage) {
                item.classList.add('active');
            }
        });
    }

    setUserInfo() {
        const username = localStorage.getItem('username') || 'User';
        const isAdmin = localStorage.getItem('isAdmin') === 'true';

        document.getElementById('navUserName').textContent = username;
        document.getElementById('navUserRole').textContent = isAdmin ? 'Administrator' : 'Member';
    }
}

// Global logout function
function handleNavLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    window.location.href = 'login.html';
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new NavigationManager();
});