import { useState } from 'react'
import { api } from '../api'

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.login(username, password);
            if (res.success && res.token) {
                onLogin(res.token);
            }
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <form className="login-card" onSubmit={handleSubmit}>
                <h1>Dealora Validator</h1>
                <p>Sign in to access the AI coupon validation dashboard</p>

                {error && <div className="error-msg">{error}</div>}

                <div className="form-group">
                    <label htmlFor="login-user">Username</label>
                    <input
                        id="login-user"
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Enter admin username"
                        autoComplete="username"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="login-pass">Password</label>
                    <input
                        id="login-pass"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter admin password"
                        autoComplete="current-password"
                        required
                    />
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Sign In'}
                </button>
            </form>
        </div>
    );
}
