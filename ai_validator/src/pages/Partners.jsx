import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Partners() {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ partnerName: '', merchantLink: '', isActive: true });

    useEffect(() => {
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        try {
            const res = await api.getPartners();
            setPartners(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.createPartner(formData);
            setIsModalOpen(false);
            setFormData({ partnerName: '', merchantLink: '', isActive: true });
            fetchPartners();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this partner?')) return;
        try {
            await api.deletePartner(id);
            fetchPartners();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div>Loading partners...</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Partners</h1>
                    <p>Manage merchant partners for validation.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Add Partner</button>
            </div>

            <div className="table-card">
                <div className="table-card-header">
                    <h3>Registered Partners</h3>
                </div>
                {partners.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🤝</div>
                        <p>No partners added yet.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Merchant Link</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partners.map(p => (
                                <tr key={p._id}>
                                    <td style={{ fontWeight: 600 }}>{p.partnerName}</td>
                                    <td><a href={p.merchantLink} target="_blank" rel="noreferrer" style={{color: 'var(--accent)'}}>{p.merchantLink}</a></td>
                                    <td>
                                        <span className={`badge ${p.isActive ? 'badge-active' : 'badge-inactive'}`}>
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p._id)}>Delete</button>
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
                        <h2>Add New Partner</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Partner Name</label>
                                <input required value={formData.partnerName} onChange={e => setFormData({...formData, partnerName: e.target.value})} placeholder="e.g. Amazon" />
                            </div>
                            <div className="form-group">
                                <label>Merchant Link</label>
                                <input required type="url" value={formData.merchantLink} onChange={e => setFormData({...formData, merchantLink: e.target.value})} placeholder="https://amazon.com" />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none' }}>
                                    <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} style={{width: 'auto'}} />
                                    Active (Will be included in validation runs)
                                </label>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Partner</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
