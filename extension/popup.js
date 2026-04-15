/* ============================================================
   Dealora Cookie Sync — popup.js
   
   CONFIGURATION — update these two values before using:
     SERVER_URL : the full URL of your backend POST endpoint
     API_KEY    : the secret key your backend expects in the
                  X-Extension-Key header
   ============================================================ */

const CONFIG = {
    // ai-coupon-engine runs on port 8000 (or whatever PORT is set in .env)
    SERVER_URL: 'http://localhost:8000/api/v1/merchant-cookies',
    API_KEY:    'YOUR_EXTENSION_API_KEY_HERE', // optional – not enforced yet
};

/* ── DOM refs ── */
const stepSync        = document.getElementById('stepSync');
const stepSave        = document.getElementById('stepSave');
const siteUrlEl       = document.getElementById('siteUrl');
const btnSync         = document.getElementById('btnSync');
const btnSave         = document.getElementById('btnSave');
const btnBack         = document.getElementById('btnBack');
const cookieCount     = document.getElementById('cookieCount');
const cookieTableBody = document.getElementById('cookieTableBody');
const providerInput   = document.getElementById('providerName');
const statusDot       = document.getElementById('statusDot');
const toast           = document.getElementById('toast');

/* ── State ── */
let currentTab   = null;
let fetchedCookies = [];
let toastTimer   = null;

/* ============================================================
   Helpers
   ============================================================ */

/** Switch between steps */
function showStep(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

/** Status indicator */
function setStatus(state) {  // 'idle' | 'loading' | 'success' | 'error'
    statusDot.className = `status-dot ${state}`;
    statusDot.title = state.charAt(0).toUpperCase() + state.slice(1);
}

/** Toast notification */
function showToast(message, type = 'info') {   // type: 'info' | 'success' | 'error'
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className   = `toast toast-${type} show`;
    toastTimer = setTimeout(() => { toast.className = `toast toast-${type}`; }, 3500);
}

/** Set loading state on a button */
function setButtonLoading(btn, isLoading, originalHTML) {
    if (isLoading) {
        btn.disabled   = true;
        btn.innerHTML  = `<span class="spinner"></span>&nbsp;Please wait…`;
    } else {
        btn.disabled   = false;
        btn.innerHTML  = originalHTML;
    }
}

/** Truncate long strings for display */
function trunc(str, max = 28) {
    if (!str) return '—';
    return str.length > max ? str.slice(0, max) + '…' : str;
}

/** Extract readable domain from a URL */
function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

/* ============================================================
   Render cookie table
   ============================================================ */
function renderCookieTable(cookies) {
    cookieTableBody.innerHTML = '';

    if (!cookies || cookies.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3" style="text-align:center; color:#4b5563; padding:20px;">No cookies found for this site.</td>`;
        cookieTableBody.appendChild(tr);
        return;
    }

    cookies.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td title="${c.name}">${trunc(c.name, 22)}</td>
            <td title="${c.value}">${trunc(c.value, 22)}</td>
            <td title="${c.domain}">${trunc(c.domain, 20)}</td>
        `;
        cookieTableBody.appendChild(tr);
    });
}

/* ============================================================
   Initialise — read current tab URL
   ============================================================ */
async function init() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;

        if (!tab || !tab.url) {
            siteUrlEl.textContent = 'Cannot read current tab.';
            btnSync.disabled = true;
            return;
        }

        // Reject extension pages / chrome:// pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            siteUrlEl.textContent = 'Navigate to a merchant site first.';
            btnSync.disabled = true;
            return;
        }

        siteUrlEl.textContent = getDomain(tab.url);
    } catch (err) {
        siteUrlEl.textContent = 'Error reading tab.';
        console.error('[CookieSync] init error:', err);
    }
}

/* ============================================================
   Sync — fetch cookies for the current tab URL
   ============================================================ */
const SYNC_BTN_HTML = btnSync.innerHTML;

btnSync.addEventListener('click', async () => {
    if (!currentTab || !currentTab.url) return;

    setStatus('loading');
    setButtonLoading(btnSync, true, SYNC_BTN_HTML);

    try {
        // Fetch all cookies matching the current tab URL
        const cookies = await chrome.cookies.getAll({ url: currentTab.url });

        fetchedCookies = cookies;
        cookieCount.textContent = cookies.length;
        renderCookieTable(cookies);

        setStatus('success');
        showStep('stepSave');
        showToast(`${cookies.length} cookies fetched successfully`, 'success');

        // Restore provider input in case user came back
        providerInput.value = '';
        providerInput.focus();

    } catch (err) {
        console.error('[CookieSync] cookie fetch error:', err);
        setStatus('error');
        showToast('Failed to fetch cookies. Check extension permissions.', 'error');
    } finally {
        setButtonLoading(btnSync, false, SYNC_BTN_HTML);
    }
});

/* ============================================================
   Back — return to step 1
   ============================================================ */
btnBack.addEventListener('click', () => {
    showStep('stepSync');
    setStatus('idle');
    fetchedCookies = [];
});

/* ============================================================
   Save — POST cookies + providerName to backend
   ============================================================ */
const SAVE_BTN_HTML = btnSave.innerHTML;

btnSave.addEventListener('click', async () => {
    const providerName = providerInput.value.trim();

    if (!providerName) {
        showToast('Please enter a provider / merchant name.', 'error');
        providerInput.focus();
        providerInput.style.borderColor = 'rgba(239, 68, 68, 0.6)';
        setTimeout(() => { providerInput.style.borderColor = ''; }, 2000);
        return;
    }

    if (fetchedCookies.length === 0) {
        showToast('No cookies to save. Please sync first.', 'error');
        return;
    }

    setStatus('loading');
    setButtonLoading(btnSave, true, SAVE_BTN_HTML);

    const payload = {
        providerName,
        merchantUrl: currentTab ? currentTab.url : '',
        cookiesCount: fetchedCookies.length,
        cookies: fetchedCookies,
        syncedAt: new Date().toISOString(),
    };

    try {
        const response = await fetch(CONFIG.SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Extension-Key': CONFIG.API_KEY,
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            setStatus('success');
            showToast('Cookies saved to server successfully!', 'success');
            // Reset back to step 1 after short delay
            setTimeout(() => {
                showStep('stepSync');
                setStatus('idle');
                fetchedCookies = [];
            }, 2000);
        } else {
            const data = await response.json().catch(() => ({}));
            const msg  = data.message || `Server error (${response.status})`;
            setStatus('error');
            showToast(msg, 'error');
        }

    } catch (err) {
        console.error('[CookieSync] save error:', err);
        setStatus('error');
        showToast('Network error. Check server URL in config.', 'error');
    } finally {
        setButtonLoading(btnSave, false, SAVE_BTN_HTML);
    }
});

/* ── Boot ── */
init();
