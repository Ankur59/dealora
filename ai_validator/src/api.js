const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1/validator';

function getAuthHeader() {
    const token = localStorage.getItem('validator_token');
    return token ? { 'Authorization': `Basic ${token}` } : {};
}

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
            ...options.headers,
        },
        ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

export const api = {
    login: (username, password) =>
        request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

    getStats: () => request('/stats'),

    getPartners: () => request('/partners'),
    createPartner: (body) => request('/partners', { method: 'POST', body: JSON.stringify(body) }),
    deletePartner: (id) => request(`/partners/${id}`, { method: 'DELETE' }),

    getCredentials: () => request('/credentials'),
    createCredential: (body) => request('/credentials', { method: 'POST', body: JSON.stringify(body) }),
    deleteCredential: (id) => request(`/credentials/${id}`, { method: 'DELETE' }),

    getOffers: () => request('/offers'),
    createOffer: (body) => request('/offers', { method: 'POST', body: JSON.stringify(body) }),
    deleteOffer: (id) => request(`/offers/${id}`, { method: 'DELETE' }),

    getResults: () => request('/results'),
    triggerRun: () => request('/run', { method: 'POST' }),
};
