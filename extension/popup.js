// popup.js - Dealora AI Verification Agent Admin UI
import { CONFIG } from './config.js';

let isLoggedIn = false;
let isAgentRunning = false;
let dbMerchants = [];
let dbPartners = [];

document.addEventListener('DOMContentLoaded', async () => {
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

    // Inner Tabs Admin logic
    document.getElementById('btnAdminCampaigns').addEventListener('click', (e) => {
        e.target.classList.add('active');
        e.target.style.borderColor = '#3b82f6';
        e.target.style.color = '#3b82f6';
        document.getElementById('btnAdminPartners').classList.remove('active');
        document.getElementById('btnAdminPartners').style.borderColor = '';
        document.getElementById('btnAdminPartners').style.color = '';
        document.getElementById('adminCampaignSection').style.display = 'block';
        document.getElementById('adminPartnerSection').style.display = 'none';
    });
    
    document.getElementById('btnAdminPartners').addEventListener('click', (e) => {
        e.target.classList.add('active');
        e.target.style.borderColor = '#3b82f6';
        e.target.style.color = '#3b82f6';
        document.getElementById('btnAdminCampaigns').classList.remove('active');
        document.getElementById('btnAdminCampaigns').style.borderColor = '';
        document.getElementById('btnAdminCampaigns').style.color = '';
        document.getElementById('adminPartnerSection').style.display = 'block';
        document.getElementById('adminCampaignSection').style.display = 'none';
    });

    // Tabs logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.getAttribute('data-tab')).classList.add('active');
        });
    });
});

function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    // Hardcoded for demo/simplicity, should ideally hit backend
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

async function showDashboard() {
    document.getElementById('stepLogin').classList.remove('active');
    document.getElementById('stepDashboard').classList.add('active');
    
    await fetchAdminData();
    await updateDashboardState();
    
    // Poll state every 3 seconds
    setInterval(updateDashboardState, 3000);
}

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
            // Filter to only those with a domain so they show up in our list
            dbMerchants = (data.campaigns || []).filter(c => c.domain);
            renderDbMerchants();
        }
    } catch (err) {
        console.error("Error fetching admin data:", err);
    }
}

function populatePartnerSelect() {
    const select = document.getElementById('newMerchantPartner');
    select.innerHTML = '<option value="">Select Partner...</option>';
    dbPartners.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.partnerName;
        opt.textContent = p.partnerName;
        select.appendChild(opt);
    });
}

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
            document.getElementById('newMerchantName').value = '';
            document.getElementById('newMerchantDomain').value = '';
            document.getElementById('newMerchantUrl').value = '';
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
        // Check active / inactive for visual cue
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
        statusDot.style.background = '#10b981'; // Green
    } else {
        btnToggle.textContent = 'Start AI Agent';
        btnToggle.className = 'btn btn-success';
        statusDot.style.background = '#ef4444'; // Red
    }
    
    // Update queue stats
    document.getElementById('activeTasks').textContent = tasks.length;
    
    // Check for OTP required tasks
    const taskNeedingOtp = tasks.find(t => t.status === 'waiting_for_otp');
    const otpContainer = document.getElementById('otpContainer');
    
    if (taskNeedingOtp) {
        otpContainer.style.display = 'block';
        document.getElementById('otpMessage').textContent = `Task ${taskNeedingOtp.id}: ${taskNeedingOtp.message || 'OTP needed'}`;
        otpContainer.setAttribute('data-task-id', taskNeedingOtp.id);
    } else {
        otpContainer.style.display = 'none';
    }
    
    // Render merchant list dynamically from dbMerchants instead of hardcoded requiredMerchants
    const merchantList = document.getElementById('merchantList');
    merchantList.innerHTML = '';
    
    if (dbMerchants.length === 0) {
        merchantList.innerHTML = '<p class="small-text">No merchants configured. Add them in the Admin tab.</p>';
    }
    
    for (let m of dbMerchants) {
        const status = statuses[m.domain];
        const isLogged = status && status.isLoggedIn;
        
        const el = document.createElement('div');
        el.className = 'merchant-item';
        el.innerHTML = `
            <div>
                <div class="merchant-name">${m.title}</div>
                <div class="merchant-status ${isLogged ? 'logged-in' : ''}">
                    ${isLogged ? 'Session Active' : 'Requires Login'}
                </div>
            </div>
            ${!isLogged ? `<button class="btn-open" data-url="${m.loginUrl || m.trackingLink}" data-domain="${m.domain}">Open</button>` : ''}
        `;
        merchantList.appendChild(el);
    }
    
    // Add listeners to open buttons
    document.querySelectorAll('.btn-open').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.target.getAttribute('data-url');
            const domain = e.target.getAttribute('data-domain');
            
            // Open tab
            chrome.tabs.create({ url });
            
            // Listen for login completion (in a real scenario, background script tracks cookies)
            // For now, we simulate user clicking a "mark logged in" after manual login
            if (confirm(`Did you log into ${domain}?`)) {
                chrome.runtime.sendMessage({ type: 'UPDATE_MERCHANT_LOGIN', domain });
                updateDashboardState();
            }
        });
    });
}

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
