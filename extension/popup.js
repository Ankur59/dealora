// popup.js - Dealora AI Verification Agent Admin UI
import { CONFIG } from './config.js';

// Auto-inject X-Extension-Key header in all fetches to backend
const originalFetch = window.fetch;
window.fetch = function (resource, options = {}) {
    if (typeof resource === 'string' && resource.startsWith(CONFIG.BACKEND_URL)) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
            options.headers.set('X-Extension-Key', CONFIG.EXTENSION_API_KEY);
        } else if (Array.isArray(options.headers)) {
            options.headers.push(['X-Extension-Key', CONFIG.EXTENSION_API_KEY]);
        } else {
            options.headers['X-Extension-Key'] = CONFIG.EXTENSION_API_KEY;
        }
    }
    return originalFetch(resource, options);
};

let isLoggedIn = false;
let isAgentRunning = false;
let dbMerchants = [];     // Admin tab — campaigns from /campaigns
let dbSyncMerchants = []; // AI Agent tab — merchants from /merchants
let dbPartners = [];
let dbCoupons = [];
let currentCouponPage = 0;
let hasMoreCoupons = false;
let totalCouponsCount = 0;
let verifiedCouponsCount = 0;
let pendingCouponsCount = 0;
let couponFilter = 'all'; // 'all', 'verified', 'pending'

function setCouponFilter(filter) {
    couponFilter = filter;
    
    // Update active class on stats cards
    document.getElementById('statTotalCard')?.classList.remove('active');
    document.getElementById('statVerifiedCard')?.classList.remove('active');
    document.getElementById('statPendingCard')?.classList.remove('active');
    
    if (filter === 'all') {
        document.getElementById('statTotalCard')?.classList.add('active');
    } else if (filter === 'verified') {
        document.getElementById('statVerifiedCard')?.classList.add('active');
    } else if (filter === 'pending') {
        document.getElementById('statPendingCard')?.classList.add('active');
    }
    
    currentCouponPage = 0;
    fetchCoupons();
}

// ─── Form State Persistence ─────────────────────────────────
// IDs of all inputs/selects/textareas whose values should survive popup close
const PERSISTED_FIELDS = [
    'username', 'password',
    'newMerchantPartner', 'newMerchantName', 'newMerchantDomain', 'newMerchantUrl',
    'newPartnerName', 'newPartnerStatus',
    'couponPartner', 'couponBrandName', 'couponCode', 'couponDescription',
    'couponDiscount', 'couponType', 'couponLink', 'couponStart', 'couponEnd',
    'couponSearchInput'
];

async function restoreFormState() {
    const stored = await chrome.storage.local.get(['formState']);
    const state = stored.formState || {};
    for (const id of PERSISTED_FIELDS) {
        const el = document.getElementById(id);
        if (el && state[id] !== undefined && state[id] !== '') {
            el.value = state[id];
        }
    }
}

function saveFormState() {
    const state = {};
    for (const id of PERSISTED_FIELDS) {
        const el = document.getElementById(id);
        if (el) state[id] = el.value;
    }
    chrome.storage.local.set({ formState: state });
}

function attachFormPersistence() {
    for (const id of PERSISTED_FIELDS) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', saveFormState);
            el.addEventListener('change', saveFormState);
        }
    }
}

// ─── DOMContentLoaded ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Restore form values before anything else
    await restoreFormState();

    // Check login state
    const authData = await chrome.storage.local.get(['adminToken']);
    if (authData.adminToken) {
        showDashboard();
    }

    // UI Listeners
    document.getElementById('btnLogin').addEventListener('click', handleLogin);
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
    document.getElementById('btnToggleAgent').addEventListener('click', toggleAgent);
    document.getElementById('btnSubmitOtp').addEventListener('click', submitOtp);
    document.getElementById('btnAddMerchant').addEventListener('click', handleAddMerchant);
    document.getElementById('btnAddPartner').addEventListener('click', handleAddPartner);
    document.getElementById('btnSaveCoupon').addEventListener('click', handleSaveCoupon);

    // Coupon status stats cards filters
    document.getElementById('statTotalCard').addEventListener('click', () => {
        setCouponFilter('all');
    });
    document.getElementById('statVerifiedCard').addEventListener('click', () => {
        setCouponFilter('verified');
    });
    document.getElementById('statPendingCard').addEventListener('click', () => {
        setCouponFilter('pending');
    });

    // Inner Tabs — Admin
    const setAdminSubTab = (activeBtn, activeSec) => {
        ['btnAdminCampaigns', 'btnAdminPartners', 'btnAdminMetrics'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('active');
                btn.style.borderColor = '';
                btn.style.color = '';
            }
        });
        ['adminCampaignSection', 'adminPartnerSection', 'adminMetricsSection'].forEach(id => {
            const sec = document.getElementById(id);
            if (sec) sec.style.display = 'none';
        });
        activeBtn.classList.add('active');
        activeBtn.style.borderColor = '#3b82f6';
        activeBtn.style.color = '#3b82f6';
        const activeSecEl = document.getElementById(activeSec);
        if (activeSecEl) activeSecEl.style.display = 'block';

        if (activeSec === 'adminMetricsSection') {
            loadAiMetrics();
        }
    };

    document.getElementById('btnAdminCampaigns').addEventListener('click', (e) => {
        setAdminSubTab(e.target, 'adminCampaignSection');
    });
    document.getElementById('btnAdminPartners').addEventListener('click', (e) => {
        setAdminSubTab(e.target, 'adminPartnerSection');
    });
    document.getElementById('btnAdminMetrics').addEventListener('click', (e) => {
        setAdminSubTab(e.target, 'adminMetricsSection');
    });

    // Run controls
    document.getElementById('btnRunAgent').addEventListener('click', runAgent);
    document.getElementById('btnPauseAgent').addEventListener('click', handlePauseResume);
    document.getElementById('btnCancelAgent').addEventListener('click', cancelAgent);

    // Inner Tabs — Coupons
    document.getElementById('btnCouponsList').addEventListener('click', (e) => {
        setSubTab(e.target, 'btnCouponsAdd', 'couponListSection', 'couponAddSection');
    });
    document.getElementById('btnCouponsAdd').addEventListener('click', (e) => {
        setSubTab(e.target, 'btnCouponsList', 'couponAddSection', 'couponListSection');
    });

    // Coupon search
    document.getElementById('couponSearchInput').addEventListener('input', () => {
        currentCouponPage = 0;
        fetchCoupons();
    });

    // Coupon pagination
    document.getElementById('btnPrevPage').addEventListener('click', () => {
        if (currentCouponPage > 0) {
            currentCouponPage--;
            fetchCoupons();
        }
    });
    document.getElementById('btnNextPage').addEventListener('click', () => {
        if (hasMoreCoupons) {
            currentCouponPage++;
            fetchCoupons();
        }
    });

    // Main Tabs logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.getAttribute('data-tab')).classList.add('active');
        });
    });

    // Attach persistence listeners AFTER restoring state
    attachFormPersistence();
});

// ─── Helpers ─────────────────────────────────────────────────
function setSubTab(activeBtn, inactiveBtnId, showSectionId, hideSectionId) {
    activeBtn.classList.add('active');
    activeBtn.style.borderColor = '#3b82f6';
    activeBtn.style.color = '#3b82f6';
    const other = document.getElementById(inactiveBtnId);
    other.classList.remove('active');
    other.style.borderColor = '';
    other.style.color = '';
    document.getElementById(showSectionId).style.display = 'block';
    document.getElementById(hideSectionId).style.display = 'none';
}

// ─── Auth ────────────────────────────────────────────────────
function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    if (user && pass) {
        chrome.storage.local.set({ adminToken: 'dummy-jwt-token' });
        showDashboard();
    } else {
        alert('Please enter username and password');
    }
}

function handleLogout() {
    chrome.storage.local.remove(['adminToken']);
    document.getElementById('stepLogin').classList.add('active');
    document.getElementById('stepDashboard').classList.remove('active');
    chrome.runtime.sendMessage({ type: 'STOP_AGENT' });
}

// ─── Dashboard init ──────────────────────────────────────────
async function showDashboard() {
    document.getElementById('stepLogin').classList.remove('active');
    document.getElementById('stepDashboard').classList.add('active');

    await fetchAdminData();
    await fetchSyncMerchants();
    await renderMerchantList();   // full render once on load
    await fetchCoupons();
    await updateDashboardState(); // set button/OTP state once on load

    // Poll agent state every 3s — only lightweight DOM patches, never a full rebuild
    setInterval(async () => {
        updateDashboardState();
    }, 3000);

    // Refresh merchant data (from /merchants) every 15s and re-render list only if changed
    setInterval(async () => {
        const prevCount = dbSyncMerchants.length;
        const prevKeys  = dbSyncMerchants.map(m => m.domain).join(',');
        await fetchSyncMerchants();
        const newKeys = dbSyncMerchants.map(m => m.domain).join(',');
        if (dbSyncMerchants.length !== prevCount || newKeys !== prevKeys) {
            await renderMerchantList();
        }
    }, 15000);
}

// ─── Data Fetching ───────────────────────────────────────────
async function fetchAdminData() {
    try {
        const [partnersRes, merchantsRes] = await Promise.all([
            fetch(`${CONFIG.BACKEND_URL}/partners`),
            fetch(`${CONFIG.BACKEND_URL}/campaigns`)
        ]);

        if (partnersRes.ok) {
            const data = await partnersRes.json();
            dbPartners = (data.data && Array.isArray(data.data.partners))
                ? data.data.partners
                : (Array.isArray(data.data) ? data.data : (data.partners || []));
            populatePartnerSelect();
            renderDbPartners();
        }

        if (merchantsRes.ok) {
            const data = await merchantsRes.json();
            dbMerchants = (data.campaigns || []).filter(c => c.domain);
            renderDbMerchants();
        }
    } catch (err) {
        console.error("Error fetching admin data:", err);
    }
}

// ─── Merchant Sessions Fetcher (AI Agent tab) ─────────────────
async function fetchSyncMerchants() {
    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/merchants`);
        if (res.ok) {
            const data = await res.json();
            dbSyncMerchants = (data.data || []).filter(m => m.domain);
        }
    } catch (err) {
        console.error("Error fetching sync merchants:", err);
    }
}

async function fetchCoupons() {
    const searchTerm = (document.getElementById('couponSearchInput')?.value || '').trim();
    try {
        let isVerifiedParam = 'all';
        if (couponFilter === 'verified') {
            isVerifiedParam = 'true';
        } else if (couponFilter === 'pending') {
            isVerifiedParam = 'false';
        }

        const url = `${CONFIG.BACKEND_URL}/coupons?page=${currentCouponPage}&limit=20&search=${encodeURIComponent(searchTerm)}&isVerified=${isVerifiedParam}`;
        const couponsRes = await fetch(url);

        if (couponsRes.ok) {
            const data = await couponsRes.json();
            const resultData = data.data || {};
            dbCoupons = resultData.items || [];
            hasMoreCoupons = resultData.hasMore || false;

            if (resultData.counts) {
                totalCouponsCount = resultData.counts.total || 0;
                verifiedCouponsCount = resultData.counts.verified || 0;
                pendingCouponsCount = resultData.counts.pending || 0;
            } else {
                totalCouponsCount = resultData.total || 0;
            }
        }

        renderCoupons();
    } catch (err) {
        console.error("Error fetching all coupons:", err);
    }
}

// ─── Partner Select Population ───────────────────────────────
function populatePartnerSelect() {
    const selects = [
        document.getElementById('newMerchantPartner'),
        document.getElementById('couponPartner')
    ];
    selects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">Select Partner...</option>';
        dbPartners.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.partnerName;
            opt.textContent = p.partnerName;
            select.appendChild(opt);
        });
        // Restore current value after re-population
        if (currentVal) select.value = currentVal;
    });
}

// ─── Render Merchants ────────────────────────────────────────
function renderDbMerchants() {
    const container = document.getElementById('dbMerchantList');
    container.innerHTML = '';

    if (dbMerchants.length === 0) {
        container.innerHTML = '<p class="small-text">No merchants found. Add one above.</p>';
        return;
    }

    dbMerchants.forEach(m => {
        const div = document.createElement('div');
        div.className = 'merchant-item';
        div.innerHTML = `
            <div>
                <div class="merchant-name">${m.title} <span style="font-size: 10px; color: #6b7280;">(${m.partner || 'Unknown'})</span></div>
                <div class="merchant-status" style="color: #6b7280;">${m.domain}</div>
            </div>
            <button class="btn-danger btn-delete-merchant" data-id="${m._id}" style="padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Del</button>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.btn-delete-merchant').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Delete this campaign?')) {
                const id = e.target.getAttribute('data-id');
                try {
                    const res = await fetch(`${CONFIG.BACKEND_URL}/campaigns/${id}`, { method: 'DELETE' });
                    if (res.ok) await fetchAdminData();
                } catch (err) { console.error(err); }
            }
        });
    });
}

// ─── Render Partners ─────────────────────────────────────────
function renderDbPartners() {
    const container = document.getElementById('dbPartnerList');
    container.innerHTML = '';

    if (dbPartners.length === 0) {
        container.innerHTML = '<p class="small-text">No partners found. Add one above.</p>';
        return;
    }

    dbPartners.forEach(p => {
        const div = document.createElement('div');
        div.className = 'merchant-item';
        const statusColor = p.status === 'active' ? '#10b981' : '#6b7280';
        div.innerHTML = `
            <div>
                <div class="merchant-name">${p.partnerName}</div>
                <div class="merchant-status" style="color: ${statusColor};">${p.status}</div>
            </div>
            <button class="btn-danger btn-delete-partner" data-id="${p._id}" style="padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Del</button>
        `;
        container.appendChild(div);
    });

    document.querySelectorAll('.btn-delete-partner').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Delete this partner?')) {
                const id = e.target.getAttribute('data-id');
                try {
                    const res = await fetch(`${CONFIG.BACKEND_URL}/partners/${id}`, { method: 'DELETE' });
                    if (res.ok) await fetchAdminData();
                } catch (err) { console.error(err); }
            }
        });
    });
}

// ─── Render Coupons ──────────────────────────────────────────
function renderCoupons() {
    const container = document.getElementById('couponList');
    container.innerHTML = '';

    const isVerified = c => c.verified === true || c.isVerified === true;

    document.getElementById('totalCoupons').textContent = totalCouponsCount;
    document.getElementById('verifiedCoupons').textContent = verifiedCouponsCount;
    document.getElementById('pendingCoupons').textContent = pendingCouponsCount;

    // Update pagination controls
    document.getElementById('couponPageInfo').textContent = `Page ${currentCouponPage + 1}`;
    document.getElementById('btnPrevPage').disabled = (currentCouponPage === 0);
    document.getElementById('btnNextPage').disabled = !hasMoreCoupons;

    if (dbCoupons.length === 0) {
        container.innerHTML = '<p class="small-text">No coupons found.</p>';
        return;
    }

    dbCoupons.forEach(c => {
        const card = document.createElement('div');
        card.className = 'coupon-card';

        const isV = isVerified(c);
        const statusClass = `badge-${c.status || 'pending'}`;
        const verifiedClass = isV ? 'badge-verified' : 'badge-unverified';
        const code = c.couponCode || c.code || 'NO CODE';
        const desc = c.description || c.couponDetails || c.terms || '';
        const disc = c.discountValue || c.discount || '';
        const label = c.couponName || c.couponTitle || '';

        card.innerHTML = `
            <div class="coupon-card-header">
                <div>
                    <span class="coupon-code">${code}</span>
                    <span class="coupon-brand" style="margin-left: 6px;">${c.brandName || ''}</span>
                </div>
            </div>
            ${label && code === 'NO CODE' ? `<div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">${label}</div>` : ''}
            ${desc ? `<div class="coupon-desc">${desc}</div>` : ''}
            ${disc ? `<div style="font-size: 12px; color: #059669; font-weight: 600; margin-bottom: 4px;">💰 ${disc}</div>` : ''}
            <div class="coupon-meta">
                <span class="coupon-badge ${statusClass}">${c.status || 'pending'}</span>
                <span class="coupon-badge ${verifiedClass}">${isV ? (c.status === 'expired' || c.status === 'invalid' ? 'Verified by AI' : '✓ Verified') : 'Unverified'}</span>
                ${c.partner ? `<span style="font-size: 10px; color: #9ca3af;">${c.partner}</span>` : ''}
            </div>
            ${c.verificationReason ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px; font-style: italic;">AI: ${c.verificationReason}</div>` : ''}
            <div class="coupon-actions">
                <button class="btn-verify" data-coupon-id="${c.id || c._id}">🤖 Verify Now</button>
                <button class="btn-sm-danger btn-delete-coupon" data-coupon-id="${c.id || c._id}">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });

    // Verify buttons
    document.querySelectorAll('.btn-verify').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const couponId = e.target.getAttribute('data-coupon-id');
            e.target.textContent = '⏳ Queuing...';
            e.target.disabled = true;
            await triggerManualVerification(couponId);
            e.target.textContent = '✓ Queued';
        });
    });

    // Delete buttons
    document.querySelectorAll('.btn-delete-coupon').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Delete this coupon?')) {
                const couponId = e.target.getAttribute('data-coupon-id');
                try {
                    const res = await fetch(`${CONFIG.BACKEND_URL}/coupons/${couponId}`, { method: 'DELETE' });
                    if (res.ok) await fetchCoupons();
                } catch (err) { console.error(err); }
            }
        });
    });
}

// ─── Manual Verification Trigger ─────────────────────────────
async function triggerManualVerification(couponId) {
    try {
        await fetch(`${CONFIG.BACKEND_URL}/coupons/${couponId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isVerified: false, verified: false, verifiedOn: null, status: 'pending' })
        });

        chrome.runtime.sendMessage({ type: 'TRIGGER_VERIFY', couponId }, (resp) => {
            console.log('[Popup] Manual verify triggered:', resp);
        });
    } catch (err) {
        console.error('Error triggering manual verification:', err);
        alert('Failed to queue verification');
    }
}

// ─── Save Coupon ─────────────────────────────────────────────
async function handleSaveCoupon() {
    const partner = document.getElementById('couponPartner').value;
    const brandName = document.getElementById('couponBrandName').value.trim();
    const code = document.getElementById('couponCode').value.trim();
    const description = document.getElementById('couponDescription').value.trim();
    const discount = document.getElementById('couponDiscount').value.trim();
    const type = document.getElementById('couponType').value;
    const couponVisitingLink = document.getElementById('couponLink').value.trim();
    const start = document.getElementById('couponStart').value;
    const end = document.getElementById('couponEnd').value;

    if (!brandName || !code) {
        return alert('Brand Name and Coupon Code are required');
    }

    const payload = {
        partner: partner || 'manual',
        couponId: `manual_${Date.now()}`,
        brandName,
        code,
        couponCode: code,
        description,
        discount,
        discountValue: discount,
        type,
        status: 'pending',
        isVerified: false,
        verified: false,
        couponVisitingLink,
        trackingLink: couponVisitingLink
    };
    if (start) payload.start = new Date(start).toISOString();
    if (end) payload.end = new Date(end).toISOString();

    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/coupons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            // Clear fields & persisted state for coupon form
            ['couponBrandName', 'couponCode', 'couponDescription', 'couponDiscount', 'couponLink', 'couponStart', 'couponEnd'].forEach(id => {
                document.getElementById(id).value = '';
            });
            saveFormState();
            await fetchCoupons();
            // Switch to list view
            document.getElementById('btnCouponsList').click();
        } else {
            const err = await res.json();
            alert(err.message || 'Failed to save coupon');
        }
    } catch (err) {
        console.error(err);
        alert('Network error');
    }
}

// ─── Add Merchant ────────────────────────────────────────────
async function handleAddMerchant() {
    const partner = document.getElementById('newMerchantPartner').value;
    const title = document.getElementById('newMerchantName').value;
    const domain = document.getElementById('newMerchantDomain').value;
    const loginUrl = document.getElementById('newMerchantUrl').value;

    if (!partner || !title || !domain || !loginUrl) {
        return alert("Please fill all fields");
    }

    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/campaigns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partner, title, domain, loginUrl, trackingLink: loginUrl })
        });

        if (res.ok) {
            ['newMerchantName', 'newMerchantDomain', 'newMerchantUrl'].forEach(id => {
                document.getElementById(id).value = '';
            });
            saveFormState();
            await fetchAdminData();
        } else {
            const err = await res.json();
            alert(err.message || 'Failed to add campaign');
        }
    } catch (err) {
        console.error(err);
        alert('Network error');
    }
}

// ─── Add Partner ─────────────────────────────────────────────
async function handleAddPartner() {
    const partnerName = document.getElementById('newPartnerName').value;
    const status = document.getElementById('newPartnerStatus').value;

    if (!partnerName) {
        return alert("Please enter a Partner Name");
    }

    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/partners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partnerName, status, partnerApis: [] })
        });

        if (res.ok) {
            document.getElementById('newPartnerName').value = '';
            saveFormState();
            await fetchAdminData();
        } else {
            const err = await res.json();
            alert(err.message || 'Failed to add partner');
        }
    } catch (err) {
        console.error(err);
        alert('Network error');
    }
}

// ─── Merchant List — Full Render (called once on load / on data change) ─────
async function renderMerchantList() {
    const merchantList = document.getElementById('merchantList');
    merchantList.innerHTML = '';

    if (dbSyncMerchants.length === 0) {
        merchantList.innerHTML = '<p class="small-text">No merchants found. Sync coupons or add merchants via Admin tab.</p>';
        return;
    }

    for (let m of dbSyncMerchants) {
        const hasLoginMap = m.automationMacros && 
            (m.automationMacros.login || m.automationMacros['login']) && 
            ((m.automationMacros.login && m.automationMacros.login.length > 0) || 
             (m.automationMacros['login'] && m.automationMacros['login'].length > 0));
        const mapStatus = hasLoginMap ? 'mapped' : 'unmapped';

        const el = document.createElement('div');
        el.className = 'merchant-item';
        // Give each row a stable ID so the poll can patch status in-place
        el.setAttribute('data-merchant-domain', m.domain);
        el.innerHTML = `
            <div style="flex: 1; min-width: 0; overflow: hidden;">
                <div class="merchant-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${m.merchantName || m.title || m.domain}">
                    ${m.merchantName || m.title || m.domain}
                    <span style="font-size: 10px; color: #6b7280;">(${(m.domain || '').length > 22 ? m.domain.slice(0, 22) + '\u2026' : m.domain})</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; margin-top: 2px;">
                    <div class="merchant-status" data-status-for="${m.domain}">
                        Requires Login
                    </div>
                    <div class="map-badge ${mapStatus === 'mapped' ? 'mapped' : ''}" title="${mapStatus === 'mapped' ? 'Deterministic map available' : 'No map found, will use AI'}">
                        ${mapStatus === 'mapped' ? '\u26a1 Mapped' : '\ud83e\udd16 AI'}
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0; margin-left: 6px;">
                ${m.merchantUrl ? `<button data-action="open" data-url="${m.merchantUrl}" class="btn-open" data-open-for="${m.domain}">Open</button>` : ''}
                <button class="btn-force-auth" data-url="${m.merchantUrl || m.loginUrl || m.trackingLink}" data-domain="${m.domain}" data-brand="${m.merchantName || m.title}" style="background: #fef3c7; color: #92400e; padding: 5px 8px; font-size: 11px; border-radius: 4px; border: 1px solid #f59e0b; cursor: pointer; white-space: nowrap;">${mapStatus === 'mapped' ? 'Re-Map' : 'Map'}</button>
                <button data-action="sync" data-domain="${m.domain}" data-title="${m.merchantName || m.title}" style="background: #dbeafe; color: #1d4ed8; padding: 5px 8px; font-size: 11px; border-radius: 4px; border: 1px solid #93c5fd; cursor: pointer; white-space: nowrap;">Sync</button>
            </div>
        `;
        merchantList.appendChild(el);
    }

    // Force Auth — attach once, survives polling
    merchantList.querySelectorAll('.btn-force-auth').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const domain = e.target.getAttribute('data-domain');
            const url    = e.target.getAttribute('data-url');
            const brand  = e.target.getAttribute('data-brand');

            e.target.textContent = 'Queuing...';
            e.target.disabled = true;

            chrome.runtime.sendMessage({ type: 'TRIGGER_AUTH', domain, url, brand }, (resp) => {
                if (resp && resp.status === 'queued') {
                    e.target.textContent = 'Running...';
                } else {
                    alert('Error: ' + (resp?.message || 'Unknown'));
                    e.target.textContent = 'Failed';
                    e.target.disabled = false;
                }
            });
        });
    });

    // Event delegation for Open + Sync — attached once to container
    merchantList.onclick = async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.getAttribute('data-action') === 'open') {
            const url = btn.getAttribute('data-url');
            if (url) chrome.tabs.create({ url });
        }

        if (btn.getAttribute('data-action') === 'sync') {
            const domain       = btn.getAttribute('data-domain');
            const merchantName = btn.getAttribute('data-title');

            btn.textContent = '…';
            btn.disabled = true;

            chrome.runtime.sendMessage(
                { type: 'UPDATE_MERCHANT_LOGIN', domain, merchantName },
                (resp) => {
                    if (resp && resp.status === 'error') {
                        btn.textContent = '✕ No cookies';
                        btn.style.background = '#fee2e2';
                        btn.style.color = '#991b1b';
                        btn.style.borderColor = '#fca5a5';
                    } else {
                        btn.textContent = 'Synced ✓';
                        btn.style.background = '#d1fae5';
                        btn.style.color = '#065f46';
                        btn.style.borderColor = '#6ee7b7';
                    }
                    btn.disabled = false;
                }
            );
        }
    };
}

// ─── Dashboard State Polling — lightweight, never rebuilds merchant DOM ───────
async function updateDashboardState() {
    const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'GET_STATE' }, resolve);
    });

    if (!response) return;

    isAgentRunning = response.isRunning;
    const tasks    = response.currentTasks || [];
    const statuses = response.merchantStatuses || {};

    // Update Agent button and controls
    const btnToggle = document.getElementById('btnToggleAgent');
    const statusDot = document.getElementById('statusDot');
    
    currentAgentRunState = response.agentRunState || 'idle';
    const checked = response.agentCheckedCount || 0;
    const total = response.agentTotalCount || 0;

    const btnRun = document.getElementById('btnRunAgent');
    const btnPause = document.getElementById('btnPauseAgent');
    const btnCancel = document.getElementById('btnCancelAgent');
    const progressContainer = document.getElementById('progressBarContainer');
    const progressLabel = document.getElementById('progressBarLabel');
    const progressRatio = document.getElementById('progressBarRatio');
    const progressFill = document.getElementById('progressBarFill');

    if (currentAgentRunState === 'idle') {
        btnRun.style.display = '';
        btnPause.style.display = 'none';
        btnCancel.style.display = 'none';
        progressContainer.style.display = 'none';
        statusDot.style.background = '#ef4444';
        
        btnToggle.textContent = 'Start AI Agent';
        btnToggle.className   = 'btn btn-success';
    } else if (currentAgentRunState === 'running') {
        btnRun.style.display = 'none';
        btnPause.style.display = '';
        btnPause.textContent = 'Pause';
        btnPause.className = 'btn btn-warning';
        btnCancel.style.display = '';
        progressContainer.style.display = '';
        progressLabel.textContent = 'Progress: Running...';
        progressRatio.textContent = `${checked} / ${total} Checked`;
        const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
        progressFill.style.width = `${percentage}%`;
        statusDot.style.background = '#10b981';

        btnToggle.textContent = 'Stop AI Agent';
        btnToggle.className   = 'btn btn-danger';
    } else if (currentAgentRunState === 'paused') {
        btnRun.style.display = 'none';
        btnPause.style.display = '';
        btnPause.textContent = 'Resume';
        btnPause.className = 'btn btn-success';
        btnCancel.style.display = '';
        progressContainer.style.display = '';
        progressLabel.textContent = 'Progress: Paused';
        progressRatio.textContent = `${checked} / ${total} Checked`;
        const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
        progressFill.style.width = `${percentage}%`;
        statusDot.style.background = '#f59e0b';

        btnToggle.textContent = 'Stop AI Agent';
        btnToggle.className   = 'btn btn-danger';
    }

    // If metrics section is visible, update it in real-time
    const metricsSec = document.getElementById('adminMetricsSection');
    if (metricsSec && metricsSec.style.display === 'block') {
        loadAiMetrics();
    }

    // Update queue stats
    document.getElementById('activeTasks').textContent = tasks.length;

    // OTP
    const taskNeedingOtp = tasks.find(t => t.status === 'waiting_for_otp');
    const otpContainer = document.getElementById('otpContainer');
    if (taskNeedingOtp) {
        otpContainer.style.display = 'block';
        document.getElementById('otpMessage').textContent =
            `Task ${taskNeedingOtp.id}: ${taskNeedingOtp.message || 'OTP needed'}`;
        otpContainer.setAttribute('data-task-id', taskNeedingOtp.id);
    } else {
        otpContainer.style.display = 'none';
    }

    // Patch merchant status badges IN-PLACE — no DOM teardown, no scroll reset
    for (const m of dbSyncMerchants) {
        const isLogged = statuses[m.domain]?.isLoggedIn;

        // Update status text + class
        const badge = document.querySelector(`[data-status-for="${m.domain}"]`);
        if (badge) {
            badge.textContent = isLogged ? 'Session Active ✓' : 'Requires Login';
            badge.className   = `merchant-status${isLogged ? ' logged-in' : ''}`;
        }

        // Show/hide the Open button based on session state
        const openBtn = document.querySelector(`[data-open-for="${m.domain}"]`);
        if (openBtn) openBtn.style.display = isLogged ? 'none' : '';
    }
}

// ─── Agent Toggle & Controls ──────────────────────────────────
let currentAgentRunState = 'idle';

function runAgent() {
    chrome.runtime.sendMessage({ type: 'START_AGENT' }, () => {
        updateDashboardState();
    });
}

function pauseAgent() {
    chrome.runtime.sendMessage({ type: 'PAUSE_AGENT' }, () => {
        updateDashboardState();
    });
}

function resumeAgent() {
    chrome.runtime.sendMessage({ type: 'RESUME_AGENT' }, () => {
        updateDashboardState();
    });
}

function cancelAgent() {
    chrome.runtime.sendMessage({ type: 'CANCEL_AGENT' }, () => {
        updateDashboardState();
    });
}

function handlePauseResume() {
    if (currentAgentRunState === 'paused') {
        resumeAgent();
    } else {
        pauseAgent();
    }
}

function toggleAgent() {
    if (isAgentRunning) {
        cancelAgent();
    } else {
        runAgent();
    }
}

function submitOtp() {
    const otpInput = document.getElementById('otpInput');
    const otp = otpInput.value.trim();
    const taskId = document.getElementById('otpContainer').getAttribute('data-task-id');

    if (!otp) {
        alert('Please enter an OTP');
        return;
    }

    chrome.runtime.sendMessage({ type: 'SUBMIT_OTP', taskId, otp }, () => {
        otpInput.value = '';
        document.getElementById('otpContainer').style.display = 'none';
        updateDashboardState();
    });
}

async function loadAiMetrics() {
    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/automation/model-metrics`);
        if (res.ok) {
            const result = await res.json();
            if (result.success && result.data) {
                const metrics = result.data;
                if (document.getElementById('metricAccuracy')) {
                    document.getElementById('metricAccuracy').textContent = `${metrics.accuracy || 0}%`;
                }
                document.getElementById('metricTotal').textContent = metrics.total || 0;
                document.getElementById('metricAvgAttempts').textContent = metrics.averageAttempts || 0;
                document.getElementById('metricOverrides').textContent = metrics.manualOverrideCount || 0;

                // Render error distribution
                const errorList = document.getElementById('errorDistributionList');
                if (metrics.errorTypeBreakdown && Object.keys(metrics.errorTypeBreakdown).length > 0) {
                    let html = '<ul style="margin: 0; padding-left: 20px;">';
                    for (const [errType, count] of Object.entries(metrics.errorTypeBreakdown)) {
                        html += `<li><strong>${errType}:</strong> ${count}</li>`;
                    }
                    html += '</ul>';
                    errorList.innerHTML = html;
                } else {
                    errorList.innerHTML = '<p class="small-text" style="margin:0;">No errors logged yet.</p>';
                }
            }
        }
    } catch (err) {
        console.error("Error loading AI metrics:", err);
    }
}
