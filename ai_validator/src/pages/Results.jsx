import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Results() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);

    useEffect(() => {
        fetchResults();
    }, []);

    const fetchResults = async () => {
        try {
            const res = await api.getResults();
            setResults(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div>Loading validation logs...</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Validation Results</h1>
                    <p>Audit trail of all executed AI validation runs</p>
                </div>
                <button className="btn btn-ghost" onClick={fetchResults}>🔄 Refresh</button>
            </div>

            <div className="table-card">
                {results.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>No results have been recorded yet. Run a validation first.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Partner</th>
                                <th>Code</th>
                                <th>Result</th>
                                <th>Steps</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(r => (
                                <React.Fragment key={r._id}>
                                    <tr>
                                        <td>{new Date(r.testedAt).toLocaleString()}</td>
                                        <td style={{ fontWeight: 600 }}>{r.partnerName}</td>
                                        <td><span style={{ fontFamily: 'monospace' }}>{r.offerCode}</span></td>
                                        <td>
                                            <span className={`badge badge-${r.status.toLowerCase()}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>{r.stepsTaken}</td>
                                        <td>
                                            <button 
                                                className="btn btn-ghost btn-sm" 
                                                onClick={() => setExpandedRow(expandedRow === r._id ? null : r._id)}
                                            >
                                                {expandedRow === r._id ? 'Hide Logs' : 'View Logs'}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedRow === r._id && (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '0.5rem 1.5rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                                                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                                                    <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem'}}>URL:</span> {r.merchantLink || 'N/A'}</div>
                                                    <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem'}}>Conditions:</span> {r.offerTermsAndConditions || 'N/A'}</div>
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem'}}>AI Execution Log:</div>
                                                <div className="result-detail">
                                                    {r.aiResponse || 'No execution logs available.'}
                                                </div>
                                                {r.errorMessage && (
                                                    <div style={{ marginTop: '0.5rem', color: 'var(--red)', fontSize: '0.85rem' }}>
                                                        <strong>Error Context:</strong> {r.errorMessage}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
