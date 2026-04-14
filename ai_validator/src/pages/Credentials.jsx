import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Credentials() {
    const [credentials, setCredentials] = useState([]);
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ partnerName: '', loginUrl: '', username: '', password: '' });

    useEffect(() => {
        Promise.all([api.getCredentials(), api.getPartners()]).then(([cRes, pRes]) => {
            setCredentials(cRes.data);
            setPartners(pRes.data);
            if (pRes.data.length > 0) {
                setFormData(f => ({...f, partnerName: pRes.data[0].partnerName }));
            }
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    const fetchCreds = async () => {
        const res = await api.getCredentials();
        setCredentials(res.data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.createCredential(formData);
            setIsModalOpen(false);
            setFormData(f => ({ ...f, loginUrl: '', username: '', password: '' }));
            fetchCreds();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete these credentials?')) return;
        try {
            await api.deleteCredential(id);
            fetchCreds();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div>Loading credentials...</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Credentials</h1>
                    <p>Securely store login details for merchant sites. Passwords will be typed by the AI agent.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Add Credential</button>
            </div>

            <div className="table-card">
                <div className="table-card-header">
                    <h3>Stored Credentials</h3>
                </div>
                {credentials.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🔑</div>
                        <p>No credentials stored yet.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Partner</th>
                                <th>Login URL</th>
                                <th>Username</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {credentials.map(c => (
                                <tr key={c._id}>
                                    <td style={{ fontWeight: 600 }}>{c.partnerName}</td>
                                    <td><a href={c.loginUrl} target="_blank" rel="noreferrer" style={{color: 'var(--text-muted)'}}>{c.loginUrl || 'Auto-detect'}</a></td>
                                    <td style={{ fontFamily: 'monospace' }}>{c.username}</td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c._id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Add Credentials</h2>
                        {partners.length === 0 ? (
                            <p style={{ color: 'var(--red)' }}>Please add a Partner first.</p>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Select Partner</label>
                                    <select required value={formData.partnerName} onChange={e => setFormData({...formData, partnerName: e.target.value})}>
                                        {partners.map(p => <option key={p._id} value={p.partnerName}>{p.partnerName}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Login URL (Optional if standard)</label>
                                    <input type="url" value={formData.loginUrl} onChange={e => setFormData({...formData, loginUrl: e.target.value})} placeholder="https://amazon.com/login" />
                                </div>
                                <div className="form-group">
                                    <label>Username / Email</label>
                                    <input required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="test@email.com" />
                                </div>
                                <div className="form-group">
                                    <label>Password (Stored Plaintext for AI)</label>
                                    <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Enter password" />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--yellow)', marginTop: '0.4rem' }}>⚠️ Will be used by the automated browser to explicitly type into fields.</p>
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Save Credentials</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
