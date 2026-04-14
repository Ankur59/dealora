import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [toast, setToast] = useState(null);

    const fetchStats = async () => {
        try {
            const res = await api.getStats();
            setStats(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStats(); }, []);

    const handleRun = async () => {
        setRunning(true);
        try {
            await api.triggerRun();
            setToast({ type: 'success', msg: 'Validation triggered! Check Results in a few minutes.' });
        } catch (err) {
            setToast({ type: 'error', msg: err.message });
        } finally {
            setRunning(false);
            setTimeout(() => setToast(null), 4000);
        }
    };

    if (loading) {
        return <div className="loading"><div className="spinner"></div> Loading dashboard...</div>;
    }

    const pendingOffers = (stats?.totalOffers || 0) - (stats?.validOffers || 0) - (stats?.invalidOffers || 0);

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Dashboard Overview</h1>
                    <p>AI-powered coupon validation system status</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleRun}
                    disabled={running}
                >
                    {running ? '⏳ Running...' : '🚀 Run Validation Now'}
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card accent">
                    <div className="stat-value">{stats?.totalPartners ?? 0}</div>
                    <div className="stat-label">Total Partners</div>
                </div>
                <div className="stat-card yellow">
                    <div className="stat-value">{stats?.totalOffers ?? 0}</div>
                    <div className="stat-label">Total Offers</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-value">{stats?.validOffers ?? 0}</div>
                    <div className="stat-label">Verified Valid</div>
                </div>
                <div className="stat-card red">
                    <div className="stat-value">{stats?.invalidOffers ?? 0}</div>
                    <div className="stat-label">Verified Invalid</div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--text-secondary)' }}>{pendingOffers}</div>
                    <div className="stat-label">Pending Validation</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--green)' }}>
                        {stats?.totalOffers ? Math.round((stats.validOffers / stats.totalOffers) * 100) : 0}%
                    </div>
                    <div className="stat-label">Success Rate</div>
                </div>
            </div>

            {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
        </>
    );
}
