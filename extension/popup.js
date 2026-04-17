// popup.js - Dealora AI Verification Agent Admin UI
import { CONFIG } from './config.js';

let isLoggedIn = false;
let isAgentRunning = false;
let dbMerchants = [];
let dbPartners = [];
let dbCoupons = [];

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

    // Inner Tabs — Admin
    document.getElementById('btnAdminCampaigns').addEventListener('click', (e) => {
        setSubTab(e.target, 'btnAdminPartners', 'adminCampaignSection', 'adminPartnerSection');
    });
    document.getElementById('btnAdminPartners').addEventListener('click', (e) => {
        setSubTab(e.target, 'btnAdminCampaigns', 'adminPartnerSection', 'adminCampaignSection');
    });

    // Inner Tabs — Coupons
    document.getElementById('btnCouponsList').addEventListener('click', (e) => {
        setSubTab(e.target, 'btnCouponsAdd', 'couponListSection', 'couponAddSection');
    });
    document.getElementById('btnCouponsAdd').addEventListener('click', (e) => {
        setSubTab(e.target, 'btnCouponsList', 'couponAddSection', 'couponListSection');
    });

    // Coupon search
    document.getElementById('couponSearchInput').addEventListener('input', renderCoupons);

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
    await fetchCoupons();
    await updateDashboardState();
    
    // Poll state every 3 seconds
    setInterval(updateDashboardState, 3000);
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
            dbPartners = data.data || data.partners || [];
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

async function fetchCoupons() {
    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/agent/pending-tasks`);
        if (!res.ok) return;
        const data = await res.json();
        // pending-tasks only returns unverified — also get all coupons if we have a generic endpoint
        // For now we'll use a dedicated coupon list fetch
    } catch(err) {
        console.error("Error fetching coupons:", err);
    }

    // Fetch ALL coupons via a generic search
    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/coupons`);
        if (res.ok) {
            const data = await res.json();
            dbCoupons = data.data || data.coupons || [];
            renderCoupons();
        }
    } catch(err) {
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
                } catch(err) { console.error(err); }
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
                } catch(err) { console.error(err); }
            }
        });
    });
}

// ─── Render Coupons ──────────────────────────────────────────
function renderCoupons() {
    const searchTerm = (document.getElementById('couponSearchInput')?.value || '').toLowerCase();
    const container = document.getElementById('couponList');
    container.innerHTML = '';

    let filtered = dbCoupons;
    if (searchTerm) {
        filtered = dbCoupons.filter(c =>
            (c.code || '').toLowerCase().includes(searchTerm) ||
            (c.brandName || '').toLowerCase().includes(searchTerm) ||
            (c.description || '').toLowerCase().includes(searchTerm)
        );
    }

    // Stats
    document.getElementById('totalCoupons').textContent = dbCoupons.length;
    document.getElementById('verifiedCoupons').textContent = dbCoupons.filter(c => c.isVerified).length;
    document.getElementById('pendingCoupons').textContent = dbCoupons.filter(c => !c.isVerified).length;

    if (filtered.length === 0) {
        container.innerHTML = '<p class="small-text">No coupons found.</p>';
        return;
    }

    filtered.forEach(c => {
        const card = document.createElement('div');
        card.className = 'coupon-card';

        const statusClass = `badge-${c.status || 'pending'}`;
        const verifiedClass = c.isVerified ? 'badge-verified' : 'badge-unverified';

        card.innerHTML = `
            <div class="coupon-card-header">
                <div>
                    <span class="coupon-code">${c.code || 'NO CODE'}</span>
                    <span class="coupon-brand" style="margin-left: 6px;">${c.brandName || ''}</span>
                </div>
            </div>
            ${c.description ? `<div class="coupon-desc">${c.description}</div>` : ''}
            ${c.discount ? `<div style="font-size: 12px; color: #059669; font-weight: 600; margin-bottom: 4px;">💰 ${c.discount}</div>` : ''}
            <div class="coupon-meta">
                <span class="coupon-badge ${statusClass}">${c.status || 'pending'}</span>
                <span class="coupon-badge ${verifiedClass}">${c.isVerified ? '✓ Verified' : 'Unverified'}</span>
                ${c.partner ? `<span style="font-size: 10px; color: #9ca3af;">${c.partner}</span>` : ''}
            </div>
            ${c.verificationReason ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px; font-style: italic;">AI: ${c.verificationReason}</div>` : ''}
            <div class="coupon-actions">
                <button class="btn-verify" data-coupon-id="${c._id}" ${c.isVerified ? '' : ''}>🤖 Verify Now</button>
                <button class="btn-sm-danger btn-delete-coupon" data-coupon-id="${c._id}">Delete</button>
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
                } catch(err) { console.error(err); }
            }
        });
    });
}

// ─── Manual Verification Trigger ─────────────────────────────
async function triggerManualVerification(couponId) {
    try {
        // First, reset the coupon to unverified so it becomes a pending task
        await fetch(`${CONFIG.BACKEND_URL}/coupons/${couponId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isVerified: false, verifiedOn: null, status: 'pending' })
        });

        // Then, tell the background script to pick up a new task immediately
        chrome.runtime.sendMessage({ type: 'TRIGGER_VERIFY', couponId }, (resp) => {
            console.log('[Popup] Manual verify triggered:', resp);
        });
    } catch(err) {
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
        description,
        discount,
        type,
        status: 'pending',
        isVerified: false,
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
    } catch(err) {
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
    } catch(err) {
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
    } catch(err) {
        console.error(err);
        alert('Network error');
    }
}

// ─── Dashboard State Polling ─────────────────────────────────
async function updateDashboardState() {
    const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'GET_STATE' }, resolve);
    });
    
    if (!response) return;
    
    isAgentRunning = response.isRunning;
    const tasks = response.currentTasks || [];
    const statuses = response.merchantStatuses || {};
    
    // Update Agent button
    const btnToggle = document.getElementById('btnToggleAgent');
    const statusDot = document.getElementById('statusDot');
    if (isAgentRunning) {
        btnToggle.textContent = 'Stop AI Agent';
        btnToggle.className = 'btn btn-danger';
        statusDot.style.background = '#10b981';
    } else {
        btnToggle.textContent = 'Start AI Agent';
        btnToggle.className = 'btn btn-success';
        statusDot.style.background = '#ef4444';
    }
    
    // Update queue stats
    document.getElementById('activeTasks').textContent = tasks.length;
    
    // OTP
    const taskNeedingOtp = tasks.find(t => t.status === 'waiting_for_otp');
    const otpContainer = document.getElementById('otpContainer');
    if (taskNeedingOtp) {
        otpContainer.style.display = 'block';
        document.getElementById('otpMessage').textContent = `Task ${taskNeedingOtp.id}: ${taskNeedingOtp.message || 'OTP needed'}`;
        otpContainer.setAttribute('data-task-id', taskNeedingOtp.id);
    } else {
        otpContainer.style.display = 'none';
    }
    
    // Merchant list
    const merchantList = document.getElementById('merchantList');
    merchantList.innerHTML = '';
    
    if (dbMerchants.length === 0) {
        merchantList.innerHTML = '<p class="small-text">No merchants configured. Add them in the Admin tab.</p>';
    }
    
    for (let m of dbMerchants) {
        const status = statuses[m.domain];
        const isLogged = status && status.isLoggedIn;
        
        // Get map status
        const mapStatus = await new Promise(resolve => {
            chrome.runtime.sendMessage({ type: 'GET_MAP_STATUS', domain: m.domain }, (resp) => {
                resolve(resp?.status || 'unknown');
            });
        });

        const el = document.createElement('div');
        el.className = 'merchant-item';
        el.innerHTML = `
            <div style="flex: 1;">
                <div class="merchant-name">${m.title}</div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <div class="merchant-status ${isLogged ? 'logged-in' : ''}">
                        ${isLogged ? 'Session Active ✓' : 'Requires Login'}
                    </div>
                    <div class="map-badge ${mapStatus === 'mapped' ? 'mapped' : ''}" title="${mapStatus === 'mapped' ? 'Deterministic map available' : 'No map found, will use AI'}">
                        ${mapStatus === 'mapped' ? '⚡ Mapped' : '🤖 AI Mode'}
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 4px;">
                <button class="btn-force-auth" data-url="${m.loginUrl || m.trackingLink}" data-domain="${m.domain}" data-brand="${m.title}" style="background: #fef3c7; color: #92400e; padding: 5px 8px; font-size: 11px; border-radius: 4px; border: 1px solid #f59e0b; cursor: pointer;">${mapStatus === 'mapped' ? 'Re-Map' : 'Map Site'}</button>
                <button class="btn-sync-session" data-domain="${m.domain}" data-title="${m.title}" style="background: #dbeafe; color: #1d4ed8; padding: 5px 8px; font-size: 11px; border-radius: 4px; border: 1px solid #93c5fd; cursor: pointer;">Sync</button>
            </div>
        `;
        merchantList.appendChild(el);
    }
    
    // Force Auth buttons
    document.querySelectorAll('.btn-force-auth').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const domain = e.target.getAttribute('data-domain');
            const url = e.target.getAttribute('data-url');
            const brand = e.target.getAttribute('data-brand');
            
            e.target.textContent = 'Queuing...';
            e.target.disabled = true;

            chrome.runtime.sendMessage({ type: 'TRIGGER_AUTH', domain, url, brand }, (resp) => {
                if (resp.status === 'queued') {
                    e.target.textContent = 'Running...';
                } else {
                    alert('Error: ' + resp.message);
                    e.target.textContent = 'Failed';
                    e.target.disabled = false;
                }
            });
        });
    });

    // Sync buttons
    document.querySelectorAll('.btn-sync-session').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const domain = e.target.getAttribute('data-domain');
            const merchantName = e.target.getAttribute('data-title');
            
            e.target.textContent = '…';
            e.target.disabled = true;

            chrome.runtime.sendMessage(
                { type: 'UPDATE_MERCHANT_LOGIN', domain, merchantName },
                (resp) => {
                    e.target.textContent = 'Synced ✓';
                    e.target.style.background = '#d1fae5';
                    e.target.style.color = '#065f46';
                    e.target.style.borderColor = '#6ee7b7';
                    updateDashboardState();
                }
            );
        });
    });
}

// ─── Agent Toggle ─────────────────────────────────────────────
function toggleAgent() {
    if (isAgentRunning) {
        chrome.runtime.sendMessage({ type: 'STOP_AGENT' }, () => {
            updateDashboardState();
        });
    } else {
        chrome.runtime.sendMessage({ type: 'START_AGENT' }, () => {
            updateDashboardState();
        });
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
