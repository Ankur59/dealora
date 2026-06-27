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
let activeCouponsCount = 0;
let pendingCouponsCount = 0;
let expiredCouponsCount = 0;
let couponFilter = 'active'; // 'active', 'pending', 'expired'

function setCouponFilter(filter) {
    couponFilter = filter;
    
    document.getElementById('statActiveCard')?.classList.remove('active');
    document.getElementById('statPendingCard')?.classList.remove('active');
    document.getElementById('statExpiredCard')?.classList.remove('active');
    
    if (filter === 'active') {
        document.getElementById('statActiveCard')?.classList.add('active');
    } else if (filter === 'pending') {
        document.getElementById('statPendingCard')?.classList.add('active');
    } else if (filter === 'expired') {
        document.getElementById('statExpiredCard')?.classList.add('active');
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
    document.getElementById('statActiveCard').addEventListener('click', () => {
        setCouponFilter('active');
    });
    document.getElementById('statPendingCard').addEventListener('click', () => {
        setCouponFilter('pending');
    });
    document.getElementById('statExpiredCard').addEventListener('click', () => {
        setCouponFilter('expired');
    });

    // Deep Research button
    document.getElementById('btnDeepResearch').addEventListener('click', startDeepResearch);
    document.getElementById('btnExportExcel').addEventListener('click', exportCouponsCSV);

    // Poll deep research state every 2 seconds
    setInterval(pollDeepResearchState, 2000);

    // Inner Tabs — Admin
    const setAdminSubTab = (activeBtn, activeSec) => {
        ['btnAdminCampaigns', 'btnAdminPartners', 'btnAdminMetrics', 'btnAdminMacros'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('active');
                btn.style.borderColor = '';
                btn.style.color = '';
            }
        });
        ['adminCampaignSection', 'adminPartnerSection', 'adminMetricsSection', 'adminMacrosSection'].forEach(id => {
            const sec = document.getElementById(id);
            if (sec) sec.style.display = 'none';
        });
        activeBtn.classList.add('active');
        activeBtn.style.borderColor = '#3b82f6';
        activeBtn.style.color = '#3b82f6';
        const activeSecEl = document.getElementById(activeSec);
        if (activeSecEl) activeSecEl.style.display = 'block';

        if (activeSec === 'adminMetricsSection' && typeof loadAiMetrics === 'function') {
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
    const macroBtn = document.getElementById('btnAdminMacros');
    if (macroBtn) {
        macroBtn.addEventListener('click', (e) => {
            setAdminSubTab(e.target, 'adminMacrosSection');
        });
    }

    // Manual Macro Save
    const saveMacroBtn = document.getElementById('btnSaveMacroManual');
    if (saveMacroBtn) {
        saveMacroBtn.addEventListener('click', async () => {
            const domain = document.getElementById('macroDomain').value.trim();
            const flowType = document.getElementById('macroFlowType').value;
            const stepsStr = document.getElementById('macroStepsJson').value.trim();
            if (!domain || !stepsStr) return alert('Domain and Steps are required');
            let steps;
            try { steps = JSON.parse(stepsStr); } catch (e) { return alert('Invalid JSON in steps'); }
            
            saveMacroBtn.textContent = 'Saving...';
            try {
                const res = await fetch(`${CONFIG.BACKEND_URL}/agent/automation-map`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Extension-Key': CONFIG.EXTENSION_API_KEY },
                    body: JSON.stringify({ domain, flowType, steps })
                });
                if (res.ok) alert('Macro saved successfully');
                else alert('Failed to save macro');
            } catch (err) { alert('Network error'); }
            saveMacroBtn.textContent = 'Save Macro';
        });
    }

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
            const targetTab = e.target.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');
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
        let isVerifiedParam = '';
        if (couponFilter === 'active') {
            isVerifiedParam = 'active';
        } else if (couponFilter === 'pending') {
            isVerifiedParam = 'false';
        } else if (couponFilter === 'expired') {
            isVerifiedParam = 'expired';
        }

        const url = `${CONFIG.BACKEND_URL}/coupons?page=${currentCouponPage}&limit=20&search=${encodeURIComponent(searchTerm)}&isVerified=${isVerifiedParam}`;
        const couponsRes = await fetch(url);

        if (couponsRes.ok) {
            const data = await couponsRes.json();
            const resultData = data.data || {};
            dbCoupons = resultData.items || [];
            hasMoreCoupons = resultData.hasMore || false;

            if (resultData.counts) {
                activeCouponsCount = resultData.counts.active || 0;
                pendingCouponsCount = resultData.counts.pending || 0;
                expiredCouponsCount = resultData.counts.expired || 0;
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

    document.getElementById('activeCoupons').textContent = activeCouponsCount;
    document.getElementById('pendingCoupons').textContent = pendingCouponsCount;
    document.getElementById('expiredCoupons').textContent = expiredCouponsCount;

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
        const drConf = c.deepResearchConfidence || 0;
        const drBadge = drConf > 0
            ? `<span style="font-size: 10px; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 8px; margin-left: 4px;" title="Deep Research Confidence">🔬 ${drConf}%</span>`
            : '';

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
                ${drBadge}
            </div>
            ${c.verificationReason ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px; font-style: italic;">AI: ${c.verificationReason}</div>` : ''}
            <div class="coupon-actions">
                <button class="btn-verify" data-coupon-id="${c.id || c._id}">🤖 Verify Now</button>
                <button class="btn-blacklist btn-remove-blacklist" data-coupon-id="${c.id || c._id}" style="background: ${c.status === 'expired' ? '#fee2e2' : '#fef3c7'}; color: ${c.status === 'expired' ? '#b91c1b' : '#92400e'}; border: 1px solid ${c.status === 'expired' ? '#fca5a5' : '#f59e0b'}; padding: 5px 10px; font-size: 11px; font-weight: 600; border-radius: 4px; cursor: pointer;">
                    ${c.status === 'expired' ? '🗑 Remove & Blacklist' : '⛔ Expire & Remove'}
                </button>
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

    // Remove & Blacklist buttons
    document.querySelectorAll('.btn-remove-blacklist').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const couponId = e.target.getAttribute('data-coupon-id');
            const coupon = dbCoupons.find(c => (c.id || c._id) === couponId);
            const msg = coupon?.status === 'expired'
                ? 'Remove this coupon and blacklist it forever? It will never be re-ingested.'
                : 'Mark this coupon as expired, remove from DB, and blacklist it forever?';
            if (confirm(msg)) {
                btn.textContent = '…';
                btn.disabled = true;
                try {
                    const res = await fetch(`${CONFIG.BACKEND_URL}/coupons/${couponId}/remove-and-blacklist`, { method: 'POST' });
                    if (res.ok) {
                        await fetchCoupons();
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        alert('Failed: ' + (errData.message || 'Unknown error'));
                        btn.textContent = coupon?.status === 'expired' ? '🗑 Remove & Blacklist' : '⛔ Expire & Remove';
                        btn.disabled = false;
                    }
                } catch (err) {
                    console.error(err);
                    alert('Network error');
                    btn.textContent = 'Error';
                    btn.disabled = false;
                }
            }
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

    const regularMerchants = dbSyncMerchants.filter(m => m.manualVerificationNeeded !== true);

    if (regularMerchants.length === 0) {
        merchantList.innerHTML = '<p class="small-text">No merchants found. Sync coupons or add merchants via Admin tab.</p>';
        return;
    }

    for (let m of regularMerchants) {
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
                ${m.merchantUrl ? `<button data-action="open" data-url="${m.merchantUrl}" class="btn-open" data-open-for="${m.domain}" title="Open Website" style="padding: 6px; font-size: 14px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">🌐</button>` : ''}
                <button data-action="clear-cookies" data-id="${m._id}" data-domain="${m.domain}" style="background: #fee2e2; color: #b91c1c; padding: 6px; font-size: 14px; border-radius: 4px; border: 1px solid #fca5a5; cursor: pointer; display: none; align-items: center; justify-content: center;" data-clear-for="${m.domain}" title="Clear Cookies">🗑️</button>
                <button data-action="record-map" data-url="${m.merchantUrl || m.loginUrl || m.trackingLink}" data-domain="${m.domain}" style="background: #e0e7ff; color: #1e40af; padding: 6px; font-size: 14px; border-radius: 4px; border: 1px solid #bfdbfe; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Record Map">⏺️</button>
                <button class="btn-force-auth" data-url="${m.merchantUrl || m.loginUrl || m.trackingLink}" data-domain="${m.domain}" data-brand="${m.merchantName || m.title}" style="background: #fef3c7; color: #92400e; padding: 6px; font-size: 14px; border-radius: 4px; border: 1px solid #f59e0b; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="${mapStatus === 'mapped' ? 'Re-Map' : 'Map'}">${mapStatus === 'mapped' ? '🗺️' : '📍'}</button>
                <button data-action="sync" data-domain="${m.domain}" data-title="${m.merchantName || m.title}" style="background: #dbeafe; color: #1d4ed8; padding: 6px; font-size: 14px; border-radius: 4px; border: 1px solid #93c5fd; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Sync Cookies">🔄</button>
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

            e.target.textContent = '⏳';
            e.target.disabled = true;

            chrome.runtime.sendMessage({ type: 'TRIGGER_AUTH', domain, url, brand }, (resp) => {
                if (resp && resp.status === 'queued') {
                    e.target.textContent = '⏳';
                } else {
                    alert('Error: ' + (resp?.message || 'Unknown'));
                    e.target.textContent = '❌';
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

        if (btn.getAttribute('data-action') === 'record-map') {
            const domain = btn.getAttribute('data-domain');
            const url = btn.getAttribute('data-url');
            const flowType = prompt('Flow type to record ("login" or "verify")?', 'verify');
            if (!flowType || !['login', 'verify'].includes(flowType.toLowerCase())) {
                return alert('Invalid flow type. Must be "login" or "verify".');
            }
            chrome.runtime.sendMessage({ type: 'START_RECORDING', domain, url, flowType: flowType.toLowerCase() }, () => {
                alert(`Recording started for ${domain} (${flowType}). Check the newly opened tab.`);
            });
            return;
        }

        if (btn.getAttribute('data-action') === 'clear-cookies') {
            const id = btn.getAttribute('data-id');
            const domain = btn.getAttribute('data-domain');
            if (!confirm(`Clear session and delete saved cookies for ${domain}?`)) return;

            btn.textContent = '⏳';
            btn.disabled = true;

            try {
                const res = await fetch(`${CONFIG.BACKEND_URL}/merchant-cookies/${id}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    chrome.runtime.sendMessage({ type: 'CLEAR_LOCAL_COOKIE_STATE', domain }, () => {
                        updateDashboardState();
                    });
                } else {
                    alert('Failed to delete cookies from database');
                    btn.textContent = '🗑️';
                    btn.disabled = false;
                }
            } catch (err) {
                console.error(err);
                alert('Network error');
                btn.textContent = '🗑️';
                btn.disabled = false;
            }
        }

        if (btn.getAttribute('data-action') === 'sync') {
            const domain       = btn.getAttribute('data-domain');
            const merchantName = btn.getAttribute('data-title');

            btn.textContent = '⏳';
            btn.disabled = true;

            chrome.runtime.sendMessage(
                { type: 'UPDATE_MERCHANT_LOGIN', domain, merchantName },
                (resp) => {
                    if (resp && resp.status === 'error') {
                        btn.textContent = '❌';
                        btn.style.background = '#fee2e2';
                        btn.style.color = '#991b1b';
                        btn.style.borderColor = '#fca5a5';
                    } else {
                        btn.textContent = '✅';
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

        // Show/hide the Clear button based on session state
        const clearBtn = document.querySelector(`[data-clear-for="${m.domain}"]`);
        if (clearBtn) clearBtn.style.display = isLogged ? '' : 'none';
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
            }
        }
    } catch (err) {
        console.error("Error loading AI metrics:", err);
    }
}

// ─── Deep Research ───────────────────────────────────────────
async function startDeepResearch() {
    const btn = document.getElementById('btnDeepResearch');
    btn.textContent = '⏳ Starting...';
    btn.disabled = true;

    chrome.runtime.sendMessage({ type: 'DEEP_RESEARCH' }, (resp) => {
        if (resp?.status === 'started') {
            const progressEl = document.getElementById('deepResearchProgress');
            progressEl.style.display = 'block';
            document.getElementById('drStatus').textContent = '🔬 Deep Research: Fetching coupons...';
            document.getElementById('drProgressFill').style.width = '5%';
            document.getElementById('drMessage').textContent = 'Starting deep research...';
            btn.textContent = '🔄 Running...';
        } else {
            btn.textContent = '❌ Error';
            btn.disabled = false;
            setTimeout(() => { btn.textContent = '🔬 Deep Research'; btn.disabled = false; }, 3000);
        }
    });
}

function pollDeepResearchState() {
    chrome.runtime.sendMessage({ type: 'GET_DEEP_RESEARCH_STATE' }, (state) => {
        if (!state || state.status === 'idle') return;

        const progressEl = document.getElementById('deepResearchProgress');
        const fillEl = document.getElementById('drProgressFill');
        const statusEl = document.getElementById('drStatus');
        const msgEl = document.getElementById('drMessage');
        const btn = document.getElementById('btnDeepResearch');

        if (progressEl.style.display === 'none') progressEl.style.display = 'block';

        if (state.status === 'fetching') {
            statusEl.textContent = '🔬 Deep Research: Fetching coupons...';
            fillEl.style.width = '10%';
            msgEl.textContent = 'Loading unverified coupons from database...';
        } else if (state.status === 'researching') {
            const pct = state.totalBatches > 0 ? Math.round((state.batch / state.totalBatches) * 100) : 0;
            statusEl.textContent = `🔬 Deep Research: Batch ${state.batch || 0}/${state.totalBatches || 0}`;
            fillEl.style.width = `${Math.min(pct, 95)}%`;
            msgEl.textContent = `Processed ~${state.processed || 0} of ${state.total || 0} coupons...`;
        } else if (state.status === 'saving') {
            statusEl.textContent = '💾 Saving results to database...';
            fillEl.style.width = '98%';
            msgEl.textContent = state.message || '';
        } else if (state.status === 'done') {
            statusEl.textContent = '✅ Deep Research Complete!';
            fillEl.style.width = '100%';
            fillEl.style.background = '#10b981';
            msgEl.textContent = state.message || '';
            btn.textContent = '🔬 Deep Research';
            btn.disabled = false;
            fetchCoupons();
            // Auto-hide after 10 seconds
            setTimeout(() => {
                progressEl.style.display = 'none';
                fillEl.style.background = '#f59e0b';
                fillEl.style.width = '0%';
            }, 10000);
        } else if (state.status === 'error') {
            statusEl.textContent = '❌ Deep Research Failed';
            fillEl.style.background = '#ef4444';
            msgEl.textContent = state.message || 'Unknown error';
            btn.textContent = '🔬 Deep Research';
            btn.disabled = false;
            setTimeout(() => {
                progressEl.style.display = 'none';
                fillEl.style.background = '#f59e0b';
                fillEl.style.width = '0%';
            }, 10000);
        }
    });
}

// ─── Export CSV ──────────────────────────────────────────────
async function exportCouponsCSV() {
    try {
        // Fetch all coupons (no pagination limit)
        const res = await fetch(`${CONFIG.BACKEND_URL}/coupons?limit=10000&isVerified=all`);
        if (!res.ok) throw new Error('Backend fetch failed');

        const data = await res.json();
        const coupons = data.data?.items || data.data || [];

        if (coupons.length === 0) {
            alert('No coupons to export.');
            return;
        }

        const headers = ['Brand', 'Code', 'Description', 'Discount', 'Type', 'Status', 'Partner', 'Verified', 'AI Score', 'Deep Research'];
        const rows = coupons.map(c => [
            c.brandName || '',
            c.code || c.couponCode || '',
            (c.description || '').replace(/,/g, ';'),
            c.discount || c.discountValue || '',
            c.type || '',
            c.status || '',
            c.partner || '',
            c.isVerified ? 'Yes' : 'No',
            c.discountWeight || '',
            c.deepResearchConfidence ? `${c.deepResearchConfidence}%` : ''
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dealora_coupons_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('CSV export failed:', err);
        alert('Failed to export CSV. Check console.');
    }
}
