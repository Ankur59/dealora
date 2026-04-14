import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Partners from './pages/Partners'
import Credentials from './pages/Credentials'
import Offers from './pages/Offers'
import Results from './pages/Results'
import Layout from './components/Layout'

function App() {
    const [isAuth, setIsAuth] = useState(!!localStorage.getItem('validator_token'));

    const handleLogin = (token) => {
        localStorage.setItem('validator_token', token);
        setIsAuth(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('validator_token');
        setIsAuth(false);
    };

    if (!isAuth) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <Layout onLogout={handleLogout}>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/partners" element={<Partners />} />
                <Route path="/credentials" element={<Credentials />} />
                <Route path="/offers" element={<Offers />} />
                <Route path="/results" element={<Results />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Layout>
    );
}

export default App
