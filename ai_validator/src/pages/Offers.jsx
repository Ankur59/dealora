import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Offers() {
    const [offers, setOffers] = useState([]);
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [formData, setFormData] = useState({ partnerName: '', offerCode: '', offerUrl: '', offerTermsAndConditions: '', offerType: 'discount', isActive: true });

    useEffect(() => {
        Promise.all([api.getOffers(), api.getPartners()]).then(([oRes, pRes]) => {
            setOffers(oRes.data);
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

    const fetchOffers = async () => {
        const res = await api.getOffers();
        setOffers(res.data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.createOffer(formData);
            setIsModalOpen(false);
            setFormData(f => ({ ...f, offerCode: '', offerUrl: '', offerTermsAndConditions: '' }));
            fetchOffers();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this offer mapping?')) return;
        try {
            await api.deleteOffer(id);
            fetchOffers();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div>Loading offers...</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Offers for Validation</h1>
                    <p>Add coupons and specific URLs for the AI to test during runs.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Add Offer</button>
            </div>

            <div className="table-card">
                <div className="table-card-header">
                    <h3>Active Test Offers</h3>
                </div>
                {offers.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🎫</div>
                        <p>No offers configured for testing.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Partner</th>
                                <th>Code</th>
                                <th>Target URL</th>
                                <th>Conditions</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {offers.map(o => (
                                <tr key={o._id}>
                                    <td style={{ fontWeight: 600 }}>{o.partnerName}</td>
                                    <td><span style={{ fontFamily: 'monospace', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>{o.offerCode}</span></td>
                                    <td><a href={o.offerUrl} target="_blank" rel="noreferrer" style={{color: 'var(--accent)'}}>Link</a></td>
                                    <td title={o.offerTermsAndConditions}>{o.offerTermsAndConditions.substring(0, 30)}{o.offerTermsAndConditions.length > 30 ? '...' : ''}</td>
                                    <td>
                                        <span className={`badge badge-${o.lastStatus.toLowerCase()}`}>
                                            {o.lastStatus}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(o._id)}>Delete</button>
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
                        <h2>Add Offer to Validate</h2>
                        {partners.length === 0 ? (
                            <p style={{ color: 'var(--red)' }}>Please add a Partner first.</p>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label>Partner</label>
                                    <select required value={formData.partnerName} onChange={e => setFormData({...formData, partnerName: e.target.value})}>
                                        {partners.map(p => <option key={p._id} value={p.partnerName}>{p.partnerName}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Coupon Code to Test</label>
                                    <input required value={formData.offerCode} onChange={e => setFormData({...formData, offerCode: e.target.value})} placeholder="SAVE20" />
                                </div>
                                <div className="form-group">
                                    <label>Website / Product URL</label>
                                    <input required type="url" value={formData.offerUrl} onChange={e => setFormData({...formData, offerUrl: e.target.value})} placeholder="https://amazon.com/product/123" />
                                </div>
                                <div className="form-group">
                                    <label>Terms & Conditions (Instructions for AI)</label>
                                    <textarea required value={formData.offerTermsAndConditions} onChange={e => setFormData({...formData, offerTermsAndConditions: e.target.value})} placeholder='e.g. "Add a men`s t-shirt to the cart to satisfy the minimum spend."' rows={3} />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Save Offer</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
