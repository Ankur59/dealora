import { NavLink, useLocation } from 'react-router-dom'

const navItems = [
    { path: '/', label: 'Overview', icon: '📊' },
    { path: '/partners', label: 'Partners', icon: '🤝' },
    { path: '/credentials', label: 'Credentials', icon: '🔑' },
    { path: '/offers', label: 'Offers', icon: '🎫' },
    { path: '/results', label: 'Results', icon: '📋' },
];

export default function Layout({ children, onLogout }) {
    const location = useLocation();

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h2>AI Validator</h2>
                    <span>Coupon Verification Dashboard</span>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        >
                            <span className="icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <button className="btn btn-ghost btn-full btn-sm" onClick={onLogout}>
                        🚪 Logout
                    </button>
                </div>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
