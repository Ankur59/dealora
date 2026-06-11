// background.js - Dealora AI Verification Agent
import { CONFIG } from './config.js';

const {
    GEMINI_API_KEYS,
    MODEL_NAME,
    FALLBACK_MODEL_NAME,
    BACKEND_URL,
    EXTENSION_API_KEY,
    DEFAULT_CREDENTIALS,
    COUPONS_PER_MINUTE,
    MIN_DELAY_BETWEEN_ACTIONS_MS,
    MAX_DELAY_BETWEEN_ACTIONS_MS,
    MIN_DELAY_BETWEEN_COUPONS_MS,
    MAX_DELAY_BETWEEN_COUPONS_MS,
    MAX_STEPS_PER_VERIFICATION,
    MAX_STEPS_PER_AUTH,
    GEMINI_MAX_KEYS_PER_CALL,
    GEMINI_STEP_RETRIES,
    GEMINI_RETRY_DELAY_MS,
    KEEP_WINDOW_OPEN_ON_FAILURE,
    MAX_BLOCK_RETRIES,
    BLOCK_COOLDOWN_MS
} = CONFIG;

// ─── State ───────────────────────────────────────────────────
let isRunning = false;
let currentTasks = [];
let merchantStatuses = {};
let knownMerchantDomains = {}; 
let cookieSyncTimers = {};     
let lastSyncTimes = {};        
let geminiKeyIndex = 0;        
let disabledAutosyncDomains = {};        

let agentRunState = 'idle'; // 'idle', 'running', 'paused'
let agentCheckedCount = 0;
let agentTotalCount = 0;

// Multi-merchant parallel execution state
let activeMerchants = new Set();
let merchantQueues = {};
let pendingDomains = [];
let activeWindows = {};

// AbortControllers for in-flight Gemini requests — aborted on pause/stop
let activeGeminiControllers = new Map(); // taskId -> AbortController

// Load initial state
chrome.storage.local.get(['isRunning', 'currentTasks', 'merchantStatuses', 'agentRunState', 'agentCheckedCount', 'agentTotalCount', 'disabledAutosyncDomains'], (res) => {
    isRunning = res.isRunning || false;
    currentTasks = res.currentTasks || [];
    merchantStatuses = res.merchantStatuses || {};
    agentRunState = res.agentRunState || 'idle';
    agentCheckedCount = res.agentCheckedCount || 0;
    agentTotalCount = res.agentTotalCount || 0;
    disabledAutosyncDomains = res.disabledAutosyncDomains || {};
});

// ─── Lifecycle ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
    log('INFO', 'Extension installed.');
    chrome.storage.local.set({ 
        isRunning: false, 
        currentTasks: [], 
        merchantStatuses: {},
        agentRunState: 'idle',
        agentCheckedCount: 0,
        agentTotalCount: 0
    });
    bootstrapMerchantSessions();
});

bootstrapMerchantSessions();

function log(level, ...args) {
    const prefix = `[Dealora AI ${level}]`;
    if (level === 'ERROR') console.error(prefix, ...args);
    else if (level === 'WARN') console.warn(prefix, ...args);
    else console.log(prefix, ...args);
}

// ─── Bootstrap ───────────────────────────────────────────────
async function bootstrapMerchantSessions() {
    try {
        const headers = { 'X-Extension-Key': EXTENSION_API_KEY };
        const merchantRes = await fetch(`${BACKEND_URL}/merchants`, { headers });
        if (merchantRes.ok) {
            const data = await merchantRes.json();
            const merchants = (data.data || []).filter(m => m.domain);
            knownMerchantDomains = {};
            merchants.forEach(m => { knownMerchantDomains[m.domain] = m.merchantName; });
            log('INFO', `Tracking ${Object.keys(knownMerchantDomains).length} merchant domains`);
        }
        const cookieRes = await fetch(`${BACKEND_URL}/merchant-cookies`, { headers });
        if (cookieRes.ok) {
            const data = await cookieRes.json();
            (data.data || []).forEach(r => {
                try {
                    const domain = new URL(r.merchantUrl).hostname.replace(/^www\./, '');
                    if (r.cookiesCount > 0) merchantStatuses[domain] = { isLoggedIn: true, lastChecked: new Date(r.syncedAt).getTime() };
                } catch(e) {}
            });
            chrome.storage.local.set({ merchantStatuses });
        }
    } catch(err) { log('ERROR', 'bootstrapMerchantSessions:', err); }
}

// ─── Auto cookie tracking (Throttled) ────────────────────────
chrome.cookies.onChanged.addListener((changeInfo) => {
    const cookieDomain = (changeInfo.cookie.domain || '').replace(/^\./, '');
    const matchedDomain = Object.keys(knownMerchantDomains).find(d =>
        cookieDomain === d || cookieDomain.endsWith('.' + d) || d.endsWith('.' + cookieDomain)
    );
    if (!matchedDomain) return;

    if (disabledAutosyncDomains[matchedDomain]) {
        return;
    }

    // Cooldown: 10 seconds between syncs for the same domain
    const now = Date.now();
    if (lastSyncTimes[matchedDomain] && (now - lastSyncTimes[matchedDomain] < 10000)) return;

    clearTimeout(cookieSyncTimers[matchedDomain]);
    cookieSyncTimers[matchedDomain] = setTimeout(() => {
        lastSyncTimes[matchedDomain] = Date.now();
        const merchantName = knownMerchantDomains[matchedDomain];
        merchantStatuses[matchedDomain] = { isLoggedIn: true, lastChecked: Date.now() };
        chrome.storage.local.set({ merchantStatuses });
        captureAndSyncCookies(matchedDomain, merchantName);
    }, 5000);
});

// ─── Messages ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'START_AGENT') {
        isRunning = true;
        agentRunState = 'running';
        agentCheckedCount = 0;
        agentTotalCount = 0;
        activeMerchants.clear();
        merchantQueues = {};
        pendingDomains = [];
        activeWindows = {};
        chrome.storage.local.set({ isRunning, agentRunState, agentCheckedCount, agentTotalCount });
        startAgentLoop();
        fetchAndQueueTasks().then(count => {
            if (count > 0) {
                agentTotalCount = count;
                chrome.storage.local.set({ agentTotalCount });
            }
        });
        sendResponse({ status: 'started' });
    } else if (request.type === 'STOP_AGENT' || request.type === 'CANCEL_AGENT') {
        isRunning = false;
        agentRunState = 'idle';
        agentCheckedCount = 0;
        agentTotalCount = 0;
        chrome.storage.local.set({ isRunning, agentRunState, agentCheckedCount, agentTotalCount });
        // Abort all in-flight Gemini requests
        for (const ctrl of activeGeminiControllers.values()) { try { ctrl.abort(); } catch(e) {} }
        activeGeminiControllers.clear();
        for (let t of currentTasks) {
            t.status = 'cancelled';
            if (t._resumeResolver) t._resumeResolver();
        }
        currentTasks = [];
        chrome.storage.local.set({ currentTasks });
        for (const dom of Object.keys(activeWindows)) {
            const winId = activeWindows[dom];
            if (winId) {
                try { chrome.windows.remove(winId); } catch(e) {}
            }
        }
        activeWindows = {};
        activeMerchants.clear();
        merchantQueues = {};
        pendingDomains = [];
        sendResponse({ status: 'cancelled' });
    } else if (request.type === 'PAUSE_AGENT') {
        agentRunState = 'paused';
        chrome.storage.local.set({ agentRunState });
        // Immediately abort all in-flight Gemini requests so the loop can reach pause checkpoint
        for (const ctrl of activeGeminiControllers.values()) { try { ctrl.abort(); } catch(e) {} }
        activeGeminiControllers.clear();
        sendResponse({ status: 'paused' });
    } else if (request.type === 'RESUME_AGENT') {
        agentRunState = 'running';
        chrome.storage.local.set({ agentRunState });
        // Restart any merchants that were paused (loop will now continue)
        processNextMerchants();
        sendResponse({ status: 'resumed' });
    } else if (request.type === 'GET_STATE') {
        sendResponse({ isRunning, currentTasks, merchantStatuses, agentRunState, agentCheckedCount, agentTotalCount });
    } else if (request.type === 'UPDATE_MERCHANT_LOGIN') {
        const { domain, merchantName } = request;
        if (disabledAutosyncDomains && disabledAutosyncDomains[domain]) {
            delete disabledAutosyncDomains[domain];
            chrome.storage.local.set({ disabledAutosyncDomains });
            log('INFO', `Autosync re-enabled for domain "${domain}" via manual Sync.`);
        }
        captureAndSyncCookies(domain, merchantName || domain)
            .then(result => {
                if (result.status === 'updated') {
                    merchantStatuses[domain] = { isLoggedIn: true, lastChecked: Date.now() };
                } else {
                    merchantStatuses[domain] = { isLoggedIn: false, lastChecked: Date.now() };
                }
                chrome.storage.local.set({ merchantStatuses });
                sendResponse(result);
            })
            .catch(() => sendResponse({ status: 'error', message: 'Sync failed' }));
    } else if (request.type === 'SUBMIT_OTP') {
        const task = currentTasks.find(t => t.id === request.taskId);
        if (task && task.status === 'waiting_for_otp') {
            task.providedOtp = request.otp;
            task.status = 'running';
            chrome.storage.local.set({ currentTasks });
            if (task._resumeResolver) task._resumeResolver();
        }
        sendResponse({ status: 'resumed' });
    } else if (request.type === 'TRIGGER_AUTH') {
        triggerAuthFlow(request.domain, request.url, request.brand)
            .then(() => sendResponse({ status: 'queued' }))
            .catch(err => sendResponse({ status: 'error', message: err.message }));
    } else if (request.type === 'GET_MAP_STATUS') {
        checkMapStatus(request.domain)
            .then(status => sendResponse({ status }))
            .catch(err => sendResponse({ status: 'error', message: err.message }));
    } else if (request.type === 'TRIGGER_VERIFY') {
        triggerSingleVerification(request.couponId)
            .then(() => sendResponse({ status: 'queued' }))
            .catch(err => sendResponse({ status: 'error', message: err.message }));
    } else if (request.type === 'CLEAR_LOCAL_COOKIE_STATE') {
        const { domain } = request;
        disabledAutosyncDomains[domain] = true;
        chrome.storage.local.set({ disabledAutosyncDomains });

        merchantStatuses[domain] = { isLoggedIn: false, lastChecked: Date.now() };
        chrome.storage.local.set({ merchantStatuses });

        clearBrowserCookies(domain)
            .then(() => sendResponse({ status: 'cleared' }))
            .catch(err => {
                log('ERROR', `clearBrowserCookies error: ${err.message}`);
                sendResponse({ status: 'cleared', error: err.message });
            });
        return true;
    }
    return true; 
});

async function triggerAuthFlow(domain, url, brand) {
    if (currentTasks.some(t => t.type === 'auth' && t.domain === domain)) {
        throw new Error('Auth task already in progress for this domain');
    }
    const authTask = { 
        id: `auth_${domain}_${Date.now()}`, 
        type: 'auth', 
        domain, 
        url, 
        brand, 
        status: 'running', 
        message: 'Manual Authenticating...' 
    };
    currentTasks.push(authTask);
    chrome.storage.local.set({ currentTasks });
    runAgentSequence(authTask).finally(() => {
        currentTasks = currentTasks.filter(t => t.id !== authTask.id);
        chrome.storage.local.set({ currentTasks });
    });
}

async function checkMapStatus(domain) {
    try {
        const headers = { 'X-Extension-Key': EXTENSION_API_KEY };
        const res = await fetch(`${BACKEND_URL}/agent/automation-map/${domain}/login`, { headers });
        if (res.ok) {
            const data = await res.json();
            return data.map ? 'mapped' : 'unmapped';
        }
    } catch (e) {}
    return 'unknown';
}

async function startAgentLoop() {
    chrome.alarms.create('agentLoop', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'agentLoop' && isRunning && activeMerchants.size < 3) await fetchAndQueueTasks();
    });
}

function onTaskFinished() {
    // Don't update counters or state when paused — we'll resume later
    if (agentRunState === 'paused') return;
    
    if (agentRunState && agentRunState !== 'idle') {
        agentCheckedCount += 1;
        let stateUpdate = { agentCheckedCount };
        if (agentCheckedCount >= agentTotalCount) {
            agentRunState = 'idle';
            isRunning = false;
            stateUpdate.agentRunState = 'idle';
            stateUpdate.isRunning = false;
            // Clean up any remaining controllers
            for (const ctrl of activeGeminiControllers.values()) { try { ctrl.abort(); } catch(e) {} }
            activeGeminiControllers.clear();
        }
        chrome.storage.local.set(stateUpdate);
    }
}

async function fetchAndQueueTasks() {
    try {
        const headers = { 'X-Extension-Key': EXTENSION_API_KEY };
        const res = await fetch(`${BACKEND_URL}/agent/pending-tasks`, { headers });
        if (!res.ok) return 0;
        const data = await res.json();
        const newTasks = data.coupons || [];
        if (newTasks.length === 0) return 0;

        for (let task of newTasks) {
            const domain = new URL(task.url).hostname.replace(/^www\./, '');
            if (!merchantQueues[domain]) {
                merchantQueues[domain] = [];
            }
            if (!merchantQueues[domain].some(t => t.id === task.id)) {
                merchantQueues[domain].push(task);
            }
        }

        for (const domain of Object.keys(merchantQueues)) {
            if (merchantQueues[domain].length > 0 && !activeMerchants.has(domain) && !pendingDomains.includes(domain)) {
                pendingDomains.push(domain);
            }
        }

        processNextMerchants();
        return newTasks.length;
    } catch (err) {
        log('ERROR', 'fetchAndQueueTasks error:', err);
        return 0;
    }
}

async function processNextMerchants() {
    if (!isRunning || agentRunState === 'idle' || agentRunState === 'paused') return;

    while (activeMerchants.size < 3 && pendingDomains.length > 0) {
        const domain = pendingDomains.shift();
        if (domain) {
            activeMerchants.add(domain);
            runMerchantWorker(domain).catch(err => {
                log('ERROR', `Worker failed for ${domain}:`, err);
                activeMerchants.delete(domain);
                delete merchantQueues[domain];
                processNextMerchants();
            });
        }
    }
}

async function runMerchantWorker(domain) {
    const queue = merchantQueues[domain] || [];
    if (queue.length === 0) {
        activeMerchants.delete(domain);
        processNextMerchants();
        return;
    }

    const firstTask = queue[0];
    let windowInfo;
    try {
        windowInfo = await chrome.windows.create({ url: firstTask.url, state: 'normal', width: 1280, height: 900, focused: false });
        activeWindows[domain] = windowInfo.id;
    } catch (err) {
        log('ERROR', `Failed to create window for ${domain}:`, err);
        activeMerchants.delete(domain);
        delete merchantQueues[domain];
        processNextMerchants();
        return;
    }

    const tabId = windowInfo.tabs[0].id;
    log('INFO', `Window ${windowInfo.id}, tab ${tabId} created for domain ${domain}`);

    log('INFO', 'Waiting for page load...');
    await waitForTabLoad(tabId, 30000);
    log('INFO', 'Page loaded. Settling for 3s...');
    await new Promise(r => setTimeout(r, 3000));

    log('INFO', 'Ensuring content script...');
    await ensureContentScript(tabId);
    log('INFO', 'Content script ready.');

    if (!merchantStatuses[domain]?.isLoggedIn) {
        log('INFO', `Merchant ${domain} not logged in. Running auth flow first.`);
        const authTask = {
            id: `auth_${domain}_${Date.now()}`,
            type: 'auth',
            domain,
            url: firstTask.url,
            code: 'LOGIN_FLOW',
            brand: knownMerchantDomains[domain] || domain,
            status: 'running',
            message: 'Authenticating...'
        };

        currentTasks.push(authTask);
        chrome.storage.local.set({ currentTasks });

        try {
            await runTaskSequenceInTab(tabId, authTask);
        } catch (err) {
            log('ERROR', `Auth failed for ${domain}:`, err);
        } finally {
            currentTasks = currentTasks.filter(t => t.id !== authTask.id);
            chrome.storage.local.set({ currentTasks });
        }
    }

    // Refresh loggedIn status after auth attempt
    const loggedIn = merchantStatuses[domain]?.isLoggedIn;

    for (let i = 0; i < queue.length; i++) {
        if (!isRunning || agentRunState === 'idle') break;

        // Wait while paused
        while (agentRunState === 'paused') {
            await new Promise(r => setTimeout(r, 1000));
            if (agentRunState === 'idle' || !isRunning) break;
        }
        if (agentRunState === 'idle' || !isRunning) break;

        const task = queue[i];
        task.type = 'verify';
        task.status = 'running';
        currentTasks.push(task);
        chrome.storage.local.set({ currentTasks });

        try {
            if (!loggedIn) {
                log('WARN', `Skipping coupon ${task.code} for ${domain} because auth failed.`);
                await reportResultToBackend(task.id, 'invalid', 'Authentication failed for merchant.');
            } else {
                if (i > 0) {
                    log('INFO', `Navigating tab ${tabId} to next coupon URL: ${task.url}`);
                    await chrome.tabs.update(tabId, { url: task.url });
                    await waitForTabLoad(tabId, 30000);
                    await new Promise(r => setTimeout(r, 3000));
                    await ensureContentScript(tabId);
                }
                await runTaskSequenceInTab(tabId, task);
            }
        } catch (err) {
            log('ERROR', `Error verifying ${task.code} for ${domain}:`, err);
        } finally {
            currentTasks = currentTasks.filter(t => t.id !== task.id);
            chrome.storage.local.set({ currentTasks });
            onTaskFinished();
        }

        if (i < queue.length - 1 && isRunning && agentRunState !== 'idle') {
            const waitMs = Math.random() * (MAX_DELAY_BETWEEN_COUPONS_MS - MIN_DELAY_BETWEEN_COUPONS_MS) + MIN_DELAY_BETWEEN_COUPONS_MS;
            await new Promise(r => setTimeout(r, waitMs));
        }
    }

    if (windowInfo?.id) {
        try {
            await chrome.windows.remove(windowInfo.id);
        } catch (e) {}
    }
    delete activeWindows[domain];
    activeMerchants.delete(domain);
    delete merchantQueues[domain];

    processNextMerchants();
}

async function triggerSingleVerification(couponId) {
    const headers = { 'X-Extension-Key': EXTENSION_API_KEY };
    const res = await fetch(`${BACKEND_URL}/coupons/${couponId}`, { headers });
    const { data: coupon } = await res.json();
    const url = coupon.couponVisitingLink || coupon.trackingLink;
    const code = coupon.couponCode || coupon.code;
    if (!url) throw new Error('No URL');
    if (!code) throw new Error('No coupon code');
    const task = { id: coupon.id || coupon._id, url, code, brand: coupon.brandName, description: coupon.description || '', status: 'running', type: 'verify', message: 'Starting...' };

    chrome.storage.local.get(['agentRunState'], (resState) => {
        if (!resState.agentRunState || resState.agentRunState === 'idle') {
            agentRunState = 'running';
            agentCheckedCount = 0;
            agentTotalCount = 1;
            chrome.storage.local.set({
                agentRunState: 'running',
                agentCheckedCount: 0,
                agentTotalCount: 1
            });
        }
    });

    currentTasks.push(task);
    chrome.storage.local.set({ currentTasks });
    runAgentSequence(task).finally(() => {
        currentTasks = currentTasks.filter(t => t.id !== task.id);
        chrome.storage.local.set({ currentTasks });
        onTaskFinished();
    });
}

// ─── Verification & Auto-Login Logic ─────────────────────────────
async function runAgentSequence(task) {
    log('INFO', `🔍 STARTING SINGLE SEQUENCE: ${task.type.toUpperCase()}:`, task.code, 'on', task.url);
    let windowInfo;
    try {
        windowInfo = await chrome.windows.create({ url: task.url, state: 'normal', width: 1280, height: 900, focused: false });
    } catch (err) {
        log('ERROR', 'Failed to create window:', err);
        return;
    }
    const tabId = windowInfo.tabs[0].id;
    log('INFO', `Window ${windowInfo.id}, tab ${tabId} created.`);

    log('INFO', 'Waiting for page load...');
    await waitForTabLoad(tabId, 30000);
    log('INFO', 'Page loaded. Settling for 3s...');
    await new Promise(r => setTimeout(r, 3000));

    log('INFO', 'Ensuring content script...');
    await ensureContentScript(tabId);
    log('INFO', 'Content script ready.');

    let verificationSucceeded = false;
    try {
        const result = await runTaskSequenceInTab(tabId, task);
        verificationSucceeded = result?.verificationSucceeded || false;
    } catch (err) {
        log('ERROR', 'runAgentSequence error:', err);
    } finally {
        if (windowInfo?.id) {
            const userStopped = agentRunState === 'idle' || task.status === 'cancelled';
            const keepOpen = KEEP_WINDOW_OPEN_ON_FAILURE
                && task.type === 'verify'
                && !verificationSucceeded
                && !userStopped;
            if (keepOpen) {
                log('INFO', 'Browser window kept open after incomplete verification.');
            } else {
                try { await chrome.windows.remove(windowInfo.id); } catch (e) {}
            }
        }
        log('INFO', `🔍 ${task.type.toUpperCase()} task finished for ${task.code}`);
    }
}

function extractDomainFromUrl(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return '';
    }
}

function isCouponPhase(pageContext) {
    if (!pageContext) return false;
    if (pageContext.hasCouponInput) return true;
    return pageContext.phase === 'checkout';
}

function isCartPrepPhase(pageContext) {
    if (!pageContext || pageContext.hasCouponInput) return false;
    if (pageContext.phase === 'checkout') return false;
    return ['listing', 'product', 'other', 'cart'].includes(pageContext.phase);
}

function findBestProduct(elements, terms, requireTermsMatch = false) {
    const products = (elements || []).filter((el) => el.intent === 'product' || (el.href && /\/products\//i.test(el.href)));
    if (!products.length) return null;

    const scored = products
        .map((el) => ({ el, score: el.relevanceScore || 0 }))
        .sort((a, b) => b.score - a.score);

    if (requireTermsMatch && terms) {
        const categories = terms.applicableCategories || [];
        const minOrder = terms.minOrderValue || 0;
        const matching = scored.filter(({ el }) => {
            const textLower = `${el.text || ''} ${el.href || ''}`.toLowerCase();
            const catMatch = !categories.length || categories.some((c) => c && textLower.includes(String(c).toLowerCase()));
            const priceMatch = !minOrder || (el.price && el.price >= minOrder);
            return catMatch && priceMatch;
        });
        if (matching.length) return matching[0].el;
        if (requireTermsMatch) return null;
    }
    return scored[0].el;
}

function pickCartPrepAction(domState, task, consecutiveScrolls) {
    const ctx = domState.pageContext;
    if (!ctx || !isCartPrepPhase(ctx)) return null;

    if (ctx.phase === 'product') {
        const addBtn = domState.actionableElements.find((el) => el.intent === 'addToCart');
        if (addBtn) return { action: 'click', selector: addBtn.selector, _deterministic: true };
        return null;
    }

    if (ctx.phase === 'listing' || ctx.phase === 'other') {
        const atBottom = domState.scrollPosition?.atBottom;
        const forcePick = consecutiveScrolls >= 3 || atBottom;

        if (!forcePick) {
            const match = findBestProduct(
                domState.actionableElements.filter((el) => el.inViewport),
                task.termsSummary,
                true
            );
            if (match) return { action: 'click', selector: match.selector, _deterministic: true };
            return null;
        }

        const best = findBestProduct(domState.actionableElements, task.termsSummary, false)
            || domState.actionableElements.find((el) => el.intent === 'product' || (el.href && /\/products\//i.test(el.href)));
        if (best) return { action: 'click', selector: best.selector, _deterministic: true };
        return null;
    }

    if (ctx.phase === 'cart' && !ctx.hasCouponInput) {
        const checkout = domState.actionableElements.find((el) => el.intent === 'checkout');
        if (checkout) return { action: 'click', selector: checkout.selector, _deterministic: true };
        try {
            const origin = new URL(domState.url).origin;
            return { action: 'navigate', url: `${origin}/checkout`, _deterministic: true };
        } catch { /* fall through */ }
    }

    return null;
}

function parseCouponTermsLocal(description) {
    const fallback = { minOrderValue: 0, applicableCategories: [], excludedProducts: [], userTypes: ['all_users'] };
    if (!description || !description.trim()) return fallback;

    const text = description.toLowerCase();
    let minOrderValue = 0;

    const minPatterns = [
        /(?:min(?:imum)?\s*(?:order|purchase|cart|spend|value)|orders?\s*(?:above|over|worth|of))\s*(?:of\s*)?(?:₹|rs\.?|inr)?\s*([\d,]+)/i,
        /(?:₹|rs\.?|inr)\s*([\d,]+)\s*(?:and\s*)?(?:above|minimum|min)/i,
        /([\d,]+)\s*(?:₹|rs\.?|inr)\s*(?:and\s*)?(?:above|minimum|min)/i,
    ];
    for (const re of minPatterns) {
        const m = description.match(re);
        if (m) {
            minOrderValue = parseInt(m[1].replace(/,/g, ''), 10) || 0;
            if (minOrderValue > 0) break;
        }
    }

    const catKeywords = [
        'fashion', 'jewellery', 'jewelry', 'electronics', 'beauty', 'grocery',
        'footwear', 'apparel', 'clothing', 'accessories', 'home', 'kitchen',
        'sports', 'health', 'wellness', 'skincare', 'makeup',
    ];
    const applicableCategories = catKeywords.filter((kw) => text.includes(kw));

    const excludedProducts = [];
    const excludeMatch = description.match(/(?:not\s+valid\s+on|excluded?|except)\s*[:\-]?\s*([^.]+)/i);
    if (excludeMatch) {
        excludeMatch[1].split(/,|and/).forEach((part) => {
            const trimmed = part.trim();
            if (trimmed.length > 2 && trimmed.length < 60) excludedProducts.push(trimmed);
        });
    }

    const userTypes = [];
    if (/new\s+user|first\s+order|first\s+time/i.test(description)) userTypes.push('new_user');
    if (!userTypes.length) userTypes.push('all_users');

    return { minOrderValue, applicableCategories, excludedProducts, userTypes };
}

async function saveAutomationMap(task, actionHistory, flowType) {
    if (!task.domain) return;
    try {
        const stepsToSave = actionHistory.map((h, i) => ({
            step: i + 1,
            action: h.action,
            selector: ['navigate'].includes(h.action) ? null : h.selector,
            url: h.action === 'navigate' ? h.selector : h.url,
            value: h.valuePlaceholder || null,
        })).filter((h) => h.action !== 'evaluate');

        await fetch(`${BACKEND_URL}/agent/automation-map`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Extension-Key': EXTENSION_API_KEY,
            },
            body: JSON.stringify({ domain: task.domain, flowType, steps: stepsToSave }),
        });
        log('INFO', `Saved ${flowType} automation map for ${task.domain}`);
    } catch (e) {
        log('WARN', `Failed to save ${flowType} map:`, e.message);
    }
}

async function runTaskSequenceInTab(tabId, task) {
    let isComplete = false, attempts = 0, actionHistory = [], consecutiveErrors = 0, blockRetries = 0;
    let consecutiveScrolls = 0, lastUrl = '', verificationSucceeded = false;
    
    let mappedSequence = null;
    let credentials = null;
    let fallbackToAI = false;
    
    const headers = { 'X-Extension-Key': EXTENSION_API_KEY };

    if (task.type === 'verify') {
        if (!task.domain && task.url) task.domain = extractDomainFromUrl(task.url);
        if (!task.termsSummary) {
            log('INFO', 'Parsing coupon T&C...');
            task.termsSummary = parseCouponTermsLocal(task.description || '');
            log('INFO', `T&C: min order ${task.termsSummary.minOrderValue}, categories: ${(task.termsSummary.applicableCategories || []).join(', ') || 'none'}`);
        }
        try {
            const mapRes = await fetch(`${BACKEND_URL}/agent/automation-map/${task.domain}/verify`, { headers });
            if (mapRes.ok) {
                const mapData = await mapRes.json();
                if (mapData.map && mapData.map.steps && mapData.map.steps.length > 0) {
                    mappedSequence = mapData.map.steps;
                    log('INFO', 'Found deterministic sequence for verify. Proceeding with fast-path.');
                }
            }
        } catch (e) { log('WARN', 'Failed fetching verify map', e.message); }
    }

    if (task.type === 'auth') {
        try {
            const mapRes = await fetch(`${BACKEND_URL}/agent/automation-map/${task.domain}/login`, { headers });
            if (mapRes.ok) {
                const mapData = await mapRes.json();
                if (mapData.map && mapData.map.steps && mapData.map.steps.length > 0) {
                    mappedSequence = mapData.map.steps;
                    log('INFO', 'Found deterministic sequence for login. Proceeding with fast-path.');
                }
            }
            const credRes = await fetch(`${BACKEND_URL}/agent/credentials/${task.domain}`, { headers });
            if (credRes.ok) {
                const credData = await credRes.json();
                if (credData.credentials) {
                    credentials = credData.credentials;
                }
            }
        } catch(e) { log('WARN', 'Failed fetching auth map', e.message); }
    }

    const maxAttempts = task.type === 'auth' ? MAX_STEPS_PER_AUTH : MAX_STEPS_PER_VERIFICATION;

    while (!isComplete && attempts < maxAttempts) {
        attempts++;
        log('INFO', `────── Step ${attempts}/${maxAttempts} ──────`);

        // Check if agent state is idle/cancelled
        if (agentRunState === 'idle' || task.status === 'cancelled') {
            log('INFO', '⏹ Task cancelled by user.');
            isComplete = true;
            break;
        }

        // Wait while paused
        while (agentRunState === 'paused') {
            log('INFO', '⏸ Agent paused. Waiting...');
            await new Promise(r => setTimeout(r, 1000));
            if (agentRunState === 'idle' || task.status === 'cancelled') {
                break;
            }
        }

        if (agentRunState === 'idle' || task.status === 'cancelled') {
            log('INFO', '⏹ Task cancelled by user.');
            isComplete = true;
            break;
        }

        while (task.status === 'waiting_for_otp') {
            log('INFO', '⏸ Waiting for OTP...');
            await new Promise(r => { task._resumeResolver = r; });
        }

        log('INFO', 'Fetching DOM...');
        const domResponse = await safeSendMessage(tabId, { type: 'GET_DOM', termsSummary: task.termsSummary || null });

        if (!domResponse || domResponse.status !== 'success') {
            const errMsg = domResponse?.message || 'Unknown error';
            log('ERROR', `DOM fetch failed: ${errMsg}`);
            consecutiveErrors++;
            if (consecutiveErrors >= 3) {
                log('ERROR', 'Too many DOM errors. Aborting verification.');
                break;
            }
            log('INFO', 'Re-injecting content script...');
            await ensureContentScript(tabId);
            await new Promise(r => setTimeout(r, 2000));
            continue;
        }

        consecutiveErrors = 0;
        const domState = domResponse.domState;

        // Check block / CAPTCHA signals
        if (domState.blockStatus && domState.blockStatus.blocked) {
            log('WARN', `Block detected: ${domState.blockStatus.type}`);
            if (blockRetries < MAX_BLOCK_RETRIES) {
                blockRetries++;
                log('INFO', `Block retry ${blockRetries}/${MAX_BLOCK_RETRIES}. Waiting ${BLOCK_COOLDOWN_MS}ms for user to solve or cooldown.`);
                await new Promise(r => setTimeout(r, BLOCK_COOLDOWN_MS));
                // Reload and try again
                await chrome.tabs.reload(tabId);
                await waitForTabLoad(tabId, 30000);
                await ensureContentScript(tabId);
                continue;
            } else {
                log('ERROR', 'Max block retries reached. Aborting.');
                await reportResultToBackend(task.id, 'invalid', `Blocked by target site: ${domState.blockStatus.type}`);
                isComplete = true;
                break;
            }
        }

        log('INFO', `Page: "${domState.title}"`);
        log('INFO', `URL:  ${domState.url}`);
        log('INFO', `Elements: ${domState.actionableElements.length}${domState.totalElements ? ` (${domState.totalElements} total)` : ''}`);
        if (domState.pageContext) {
            log('INFO', `Phase: ${domState.pageContext.phase}, coupon input: ${domState.pageContext.hasCouponInput}`);
        }

        if (domState.url !== lastUrl) consecutiveScrolls = 0;
        lastUrl = domState.url;

        let stuckWarning = '';
        if (consecutiveScrolls >= 2 && isCartPrepPhase(domState.pageContext)) {
            stuckWarning = `You have scrolled ${consecutiveScrolls} times without progress. STOP scrolling. Click a product link (intent=product) from Actionable Elements immediately. Prefer products matching T&C categories and min order value.`;
            log('WARN', 'Scroll loop warning injected.');
        } else if (actionHistory.length >= 2) {
            const last2 = actionHistory.slice(-2);
            const allSameAction = last2.every(
                (h) => h.action === last2[0].action
                    && h.selector === last2[0].selector
                    && h.url === domState.url
            );
            if (allSameAction && last2[0].action !== 'scroll' && last2[0].action !== 'wait') {
                const couponHint = isCouponPhase(domState.pageContext)
                    ? 'look for "View all coupons", "Apply coupon", or the coupon text input.'
                    : 'click a product (intent=product), then Add to cart, then open cart/checkout.';
                stuckWarning = `You already tried "${last2[0].selector}" repeatedly. DO NOT repeat. ${couponHint}`;
                log('WARN', 'Loop detected. Injecting stuck warning.');
            }
        }

        let cmd = null;

        // Auto-detect applied coupon success to bypass AI calling
        if (task.type === 'verify' && detectCouponSuccess(domState, task.code)) {
            log('INFO', `🎯 Auto-Detected applied coupon: ${task.code}! Marking valid.`);
            cmd = { 
                action: 'evaluate', 
                status: 'valid', 
                reason: `Auto-detected coupon code "${task.code}" successfully applied on checkout/cart page.` 
            };
        }

        if (!cmd) {
            if (mappedSequence && mappedSequence.length > 0 && !fallbackToAI) {
                cmd = mappedSequence.shift(); 
                cmd._isDeterministic = true; 
                log('INFO', `⚡ Fast-Path Step: ${cmd.action} on ${cmd.selector || cmd.url}`);
                
                if (cmd.value === '<USERNAME>') {
                    cmd.value = credentials?.username || DEFAULT_CREDENTIALS.EMAIL;
                    cmd.valuePlaceholder = '<USERNAME>';
                }
                if (cmd.value === '<PASSWORD>') {
                    cmd.value = credentials?.password || DEFAULT_CREDENTIALS.PASSWORD;
                    cmd.valuePlaceholder = '<PASSWORD>';
                }
            } else if (task.type === 'verify' && isCartPrepPhase(domState.pageContext)) {
                const cartAction = pickCartPrepAction(domState, task, consecutiveScrolls);
                if (cartAction) {
                    log('INFO', `Deterministic cart-prep: ${cartAction.action} on ${cartAction.selector || cartAction.url}`);
                    cmd = cartAction;
                }
            }

            if (!cmd) {
                log('INFO', 'Calling Gemini...');
                const prompt = buildPrompt(task, domState, actionHistory, stuckWarning);
                let aiResponse = null;

                for (let geminiTry = 0; geminiTry < GEMINI_STEP_RETRIES && !aiResponse; geminiTry++) {
                    if (agentRunState === 'paused' || agentRunState === 'idle' || task.status === 'cancelled') break;
                    aiResponse = await callGemini(prompt, task.id);
                    if (!aiResponse && geminiTry < GEMINI_STEP_RETRIES - 1) {
                        log('WARN', `Gemini unavailable (batch ${geminiTry + 1}/${GEMINI_STEP_RETRIES}). Retrying in ${GEMINI_RETRY_DELAY_MS}ms...`);
                        await new Promise((r) => setTimeout(r, GEMINI_RETRY_DELAY_MS));
                    }
                }

                if (!aiResponse) {
                    if (agentRunState === 'paused') {
                        log('INFO', '⏸ Gemini aborted by pause. Will retry after resume.');
                        attempts--;
                        continue;
                    }
                    if (task.type === 'verify') {
                        const fallback = pickCartPrepAction(domState, task, consecutiveScrolls);
                        if (fallback) {
                            log('WARN', 'Gemini unavailable. Using deterministic cart-prep fallback.');
                            cmd = fallback;
                        }
                    }
                    if (!cmd) {
                        log('WARN', 'Gemini unavailable. Will retry step (browser stays open).');
                        consecutiveErrors++;
                        if (consecutiveErrors >= 5) {
                            log('ERROR', 'Too many consecutive Gemini failures.');
                            break;
                        }
                        await new Promise((r) => setTimeout(r, GEMINI_RETRY_DELAY_MS));
                        continue;
                    }
                } else {
                    try {
                        cmd = parseGeminiJSON(aiResponse);
                    } catch (e) {
                        log('ERROR', 'Failed to parse Gemini JSON:', aiResponse.substring(0, 200));
                        consecutiveErrors++;
                        if (consecutiveErrors >= 3) break;
                        continue;
                    }
                }
            }
        }

        if (!cmd) {
            log('WARN', 'No command resolved this step. Retrying...');
            consecutiveErrors++;
            if (consecutiveErrors >= 5) break;
            continue;
        }

        consecutiveErrors = 0;

        // Auto-convert wait-with-scroll-intent to explicit scroll action
        if (cmd.action === 'wait' && (cmd.reason || '').toLowerCase().includes('scroll')) {
            log('INFO', '📜 Auto-converting wait+scroll intent to scroll action');
            cmd = { action: 'scroll', direction: 'down', amount: cmd.amount, reason: cmd.reason };
        }

        log('INFO', `🤖 Agent choice: ${JSON.stringify(cmd)}`);
        if (cmd.value === credentials?.username && credentials?.username) { cmd.valuePlaceholder = '<USERNAME>'; }
        if (cmd.value === credentials?.password && credentials?.password) { cmd.valuePlaceholder = '<PASSWORD>'; }

        const historySelector = cmd.action === 'scroll'
            ? `scroll:${domState.scrollPosition?.top ?? 0}`
            : (cmd.selector || cmd.url || 'N/A');

        actionHistory.push({ 
            step: attempts, 
            action: cmd.action, 
            selector: historySelector, 
            url: domState.url,
            valuePlaceholder: cmd.valuePlaceholder 
        });
        if (actionHistory.length > 10) actionHistory.shift();

        // Random delay between actions to mimic human behaviour
        const actionDelay = Math.random() * (MAX_DELAY_BETWEEN_ACTIONS_MS - MIN_DELAY_BETWEEN_ACTIONS_MS) + MIN_DELAY_BETWEEN_ACTIONS_MS;
        await new Promise(r => setTimeout(r, actionDelay));

        // Execute Action
        if (cmd.action === 'evaluate') {
            log('INFO', `🏁 RESULT: ${cmd.status} — ${cmd.reason}`);
            if (cmd.status === 'valid') verificationSucceeded = true;
            await reportResultToBackend(task.id, cmd.status, cmd.reason);
            isComplete = true;
        } else if (cmd.action === 'request_otp') {
            task.status = 'waiting_for_otp';
            task.message = cmd.message;
            chrome.storage.local.set({ currentTasks });
        } else if (cmd.action === 'click') {
            log('INFO', `👆 Clicking: ${cmd.selector}`);
            const clickedEl = domState.actionableElements.find((el) => el.selector === cmd.selector);
            const clickedIntent = clickedEl?.intent;
            const clickedHref = clickedEl?.href || '';
            const result = await executeActionOnTab(tabId, cmd);
            log('INFO', `   Click result: ${result?.status} — ${result?.message || ''}`);
            if (result?.status === 'error' && (cmd._isDeterministic || cmd._deterministic)) {
                log('WARN', 'Deterministic step failed. Falling back to AI for healing.');
                fallbackToAI = true;
                task._healingContext = `The deterministic step "${cmd.action} on ${cmd.selector}" failed with error: ${result?.message}. Please solve this step manually and proceed.`;
                continue;
            }
            consecutiveScrolls = 0;
            if (clickedIntent === 'product' || /\/products\//i.test(clickedHref)) {
                log('INFO', 'Product link clicked. Waiting for navigation...');
                await waitForTabLoad(tabId, 30000);
                await new Promise(r => setTimeout(r, 3000));
                await ensureContentScript(tabId);
            } else if (clickedIntent === 'addToCart') {
                await new Promise(r => setTimeout(r, 4000));
                const freshDom = await safeSendMessage(tabId, { type: 'GET_DOM', termsSummary: task.termsSummary || null });
                const freshPhase = freshDom?.domState?.pageContext?.phase;
                const hasCheckoutBtn = freshDom?.domState?.actionableElements?.some(el => el.intent === 'checkout');
                if ((freshPhase === 'product' || freshPhase === 'listing') && !hasCheckoutBtn) {
                    const cartBtn = freshDom.domState.actionableElements.find((el) => el.intent === 'cart');
                    if (cartBtn) {
                        log('INFO', 'Navigating to cart via cart button...');
                        await executeActionOnTab(tabId, { action: 'click', selector: cartBtn.selector });
                        await waitForTabLoad(tabId, 30000);
                        await new Promise(r => setTimeout(r, 3000));
                        await ensureContentScript(tabId);
                    } else {
                        try {
                            const origin = new URL(freshDom.domState.url).origin;
                            log('INFO', `Navigating to ${origin}/cart`);
                            await chrome.tabs.update(tabId, { url: `${origin}/cart` });
                            await waitForTabLoad(tabId, 30000);
                            await ensureContentScript(tabId);
                        } catch (e) { log('WARN', 'Cart navigation fallback failed:', e.message); }
                    }
                }
            } else {
                await waitForTabLoad(tabId, 15000);
                await new Promise(r => setTimeout(r, 2000));
            }
        } else if (cmd.action === 'type') {
            log('INFO', `⌨️  Typing ${cmd.valuePlaceholder ? cmd.valuePlaceholder : '...'} into ${cmd.selector}`);
            const result = await executeActionOnTab(tabId, cmd);
            log('INFO', `   Type result: ${result?.status} — ${result?.message || ''}`);
            if (result?.status === 'error' && cmd._isDeterministic) {
                log('WARN', 'Deterministic step failed. Falling back to AI for healing.');
                fallbackToAI = true;
                task._healingContext = `The deterministic step "${cmd.action} on ${cmd.selector}" failed with error: ${result?.message}. Please solve this step manually and proceed.`;
                continue; 
            }
            await new Promise(r => setTimeout(r, 2000));
        } else if (cmd.action === 'navigate') {
            log('INFO', `🧭 Navigating to: ${cmd.url}`);
            await chrome.tabs.update(tabId, { url: cmd.url });
            await waitForTabLoad(tabId, 30000);
            await new Promise(r => setTimeout(r, 3000));
            await ensureContentScript(tabId);
        } else if (cmd.action === 'wait') {
            log('INFO', `⏳ Waiting ${cmd.ms || cmd.value || 2000}ms`);
            await executeActionOnTab(tabId, cmd);
        } else if (cmd.action === 'scroll') {
            const dir = cmd.direction || 'down';
            const amt = cmd.amount || 'viewport';
            log('INFO', `📜 Scrolling ${dir} (${amt}px)`);
            const result = await executeActionOnTab(tabId, cmd);
            log('INFO', `   Scroll result: ${result?.status} — scrollY=${result?.scrollY ?? '?'}`);
            if (isCartPrepPhase(domState.pageContext)) consecutiveScrolls++;
        } else {
            log('WARN', `Unknown action: ${cmd.action}`);
        }
    }

    if (!isComplete && task.type === 'verify') {
        // Don't mark as invalid if paused or cancelled — we'll resume later
        if (agentRunState === 'paused') {
            log('INFO', '⏸ Verification not complete but agent is paused. Skipping invalid mark.');
        } else if (agentRunState === 'idle' || task.status === 'cancelled') {
            log('INFO', '⏹ Task was cancelled. Skipping invalid mark.');
        } else {
            log('WARN', `Verification did not complete. Marking as invalid.`);
            await reportResultToBackend(task.id, 'invalid', 'Verification timed out or could not complete.');
        }
    } else if (isComplete && task.type === 'auth') {
        log('INFO', `Auth completed. Saving map to DB for ${task.domain}`);
        await saveAutomationMap(task, actionHistory, 'login');
        try {
            if (disabledAutosyncDomains && disabledAutosyncDomains[task.domain]) {
                delete disabledAutosyncDomains[task.domain];
                chrome.storage.local.set({ disabledAutosyncDomains });
                log('INFO', `Autosync re-enabled for domain "${task.domain}" due to successful auth flow.`);
            }
            captureAndSyncCookies(task.domain, task.brand);
        } catch (e) {}
    } else if (verificationSucceeded && task.type === 'verify') {
        log('INFO', `Verify completed. Saving map to DB for ${task.domain}`);
        await saveAutomationMap(task, actionHistory, 'verify');
    }

    return { verificationSucceeded };
}

function buildPrompt(task, dom, history, warn) {
    const histLines = history.map(h => `- Step ${h.step}: ${h.action} on ${h.selector}`).join('\n');
    const terms = task.termsSummary || { minOrderValue: 0, applicableCategories: [], excludedProducts: [] };
    const ctx = dom.pageContext || {};
    const termsLine = `min order ${terms.minOrderValue || 'none'}, categories [${(terms.applicableCategories || []).join(', ') || 'any'}], exclusions [${(terms.excludedProducts || []).join(', ') || 'none'}]`;

    let objectiveStr;

    if (task.type === 'auth') {
        objectiveStr = `You are an AI browser agent tasked with logging into the website for ${task.brand}.
${task._healingContext ? `HEALING CONTEXT: ${task._healingContext}\n` : ''}
DECIDE:
1. Click login buttons or Navigate to the login page.
2. Type the username and password (you can guess them if standard flow, they will be replaced dynamically but for now output dummy values).
3. Check for OTP requirements. If OTP is requested by the site, use {"action":"request_otp","message":"Enter the OTP sent to email/phone"}.
4. If you have successfully logged in (dashboard visible, logout button visible, or "My Account"), use {"action":"evaluate","status":"valid","reason":"Logged in successfully"}.
5. SELECTORS: Use the EXACT "selector" string from the Actionable Elements list below (e.g. "[data-dl-id='...']").`;
    } else if (isCartPrepPhase(ctx)) {
        objectiveStr = `You are an AI browser agent preparing a cart to verify coupon "${task.code}" for ${task.brand}.

PHASE: CART_PREPARATION (required before coupon can be applied)
Coupon: "${task.code}" | T&C: ${termsLine}
${task.description ? `Full description: "${task.description}"` : ''}

Page context: phase=${ctx.phase}, product links=${ctx.productLinkCount || 0}
You are NOT on a cart/checkout page with a coupon field. Coupon inputs do NOT exist here yet.

REQUIRED STEPS (follow in order):
${ctx.phase === 'cart' ? '1. PROCEED TO CHECKOUT: Click checkout button (intent=checkout) or navigate to /checkout — coupon field is likely there.' : `1. CLICK A PRODUCT: Choose a product link (intent=product, href contains /products/) that best matches T&C categories and min order value. Elements are sorted by relevanceScore — prefer higher scores and inViewport=true.
2. ON PRODUCT PAGE: Click "Add to cart" / "Add to bag" (intent=addToCart).
3. OPEN CART: Click cart icon or link (intent=cart) or navigate to /cart.
4. CHECKOUT: If coupon field only appears at checkout, click checkout (intent=checkout).`}

RULES:
- Do NOT scroll more than once. Prefer clicking visible product links over scrolling.
- Do NOT look for coupon input yet — it does not exist on this page.
- Do NOT evaluate as invalid yet — you must reach cart/checkout first.
- Use EXACT "selector" from Actionable Elements below.`;
    } else {
        objectiveStr = `You are an AI browser agent verifying coupon "${task.code}" for ${task.brand}.
PHASE: COUPON_APPLICATION
Coupon: "${task.code}" | T&C: ${termsLine}
Page context: phase=${ctx.phase || 'unknown'}, hasCouponInput=${ctx.hasCouponInput || false}

CRITICAL RULE — EXACT CODE ONLY:
You MUST verify EXACTLY this coupon code: "${task.code}"
You MUST type "${task.code}" into a text input field yourself. NEVER click "Apply" on a pre-existing/pre-shown coupon — those are DIFFERENT coupons, not yours to verify.

STEPS (follow in order):
1. OPEN COUPON SECTION FIRST: Scan for "View all coupons", "Apply coupon", "Have a coupon?", "Got a discount code?", "Enter promo code" — click to reveal input if hidden.
2. REMOVE PRE-APPLIED COUPONS: If another coupon is applied, click "Remove" first.
3. FIND COUPON INPUT: Look for text input (intent=coupon) where you can TYPE "${task.code}". If no input after step 1, evaluate as "invalid" with reason "Could not find coupon entry field".
4. TYPE THE CODE: Type "${task.code}" into the coupon input.
5. VERIFY BEFORE APPLY: Confirm Apply button applies "${task.code}", not a different pre-listed coupon.
6. APPLY: Click Apply/Submit nearest to the input where you typed "${task.code}".
7. EVALUATE: Use {"action":"evaluate","status":"valid"|"invalid"|"expired","reason":"..."} with the site's actual response.

SELECTORS: Use EXACT "selector" from Actionable Elements (intent=coupon for inputs).`;
    }

    const scrollInfo = dom.scrollPosition
        ? `Scroll: ${dom.scrollPosition.top}px / ${dom.scrollPosition.height}px${dom.scrollPosition.atBottom ? ' (AT BOTTOM)' : ''}`
        : 'Scroll: unknown';

    const footerRules = task.type === 'auth'
        ? `- For "wait": only use when waiting for page load (value in seconds).`
        : isCartPrepPhase(ctx)
            ? `- Prefer {"action":"click"} on intent=product, addToCart, cart, or checkout elements.
- Scroll at most once if no product links are visible: {"action":"scroll","direction":"down"}
- Do NOT use scroll on cart/checkout pages.`
            : `- Prefer elements with intent=coupon for typing. Use intent tags from Actionable Elements.
- Do NOT scroll to find coupon fields — they should be visible on cart/checkout.
- For "wait": only use when waiting for page load (value in seconds).`;

    return `${objectiveStr}
URL: ${dom.url}
${scrollInfo}
HISTORY:
${histLines || 'None'}
${warn ? `\nSTUCK WARNING: ${warn}\n` : ''}

Detected Status Messages (Success/Error signals):
${dom.statusMessages && dom.statusMessages.length > 0 ? dom.statusMessages.map(m => `- ${m}`).join('\n') : 'No recent status messages detected.'}

Actionable Elements (prioritized, top ${dom.actionableElements.length}${dom.totalElements ? ` of ${dom.totalElements}` : ''}):
${JSON.stringify(dom.actionableElements, null, 2)}

Respond only with raw JSON: {"action":"click"|"type"|"evaluate"|"wait"|"navigate"|"request_otp"|"scroll","selector":"...","value":"...","status":"...","reason":"...","direction":"down"|"up","amount":800}
${footerRules}`;
}

function waitForTabLoad(tabId, timeoutMs = 30000) {
    return new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                log('WARN', 'waitForTabLoad: tab.get error:', chrome.runtime.lastError.message);
                resolve(); 
                return;
            }
            if (tab && tab.status === 'complete') {
                log('INFO', 'Tab already loaded.');
                resolve();
                return;
            }
            const timer = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                log('WARN', `Tab load timed out after ${timeoutMs}ms. Continuing anyway.`);
                resolve(); 
            }, timeoutMs);

            function listener(updatedTabId, changeInfo) {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    clearTimeout(timer);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            }
            chrome.tabs.onUpdated.addListener(listener);
        });
    });
}

async function ensureContentScript(tabId) {
    const alive = await safeSendMessage(tabId, { type: 'PING' });
    if (alive && alive.status === 'alive') {
        return true;
    }
    try {
        log('INFO', `Injecting content script into tab ${tabId}...`);
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
        await new Promise(r => setTimeout(r, 1000));
        log('INFO', 'Content script injected.');
        return true;
    } catch(err) {
        log('ERROR', `Content script injection failed: ${err.message}`);
        return false;
    }
}

function safeSendMessage(tabId, message) {
    return new Promise((resolve) => {
        let timeoutId;
        try {
            timeoutId = setTimeout(() => {
                resolve({ status: 'error', message: 'Message timed out after 30 seconds' });
            }, 30000);

            chrome.tabs.sendMessage(tabId, message, (response) => {
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError) {
                    resolve({ status: 'error', message: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { status: 'error', message: 'Empty response' });
                }
            });
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            resolve({ status: 'error', message: err.message });
        }
    });
}

function executeActionOnTab(tabId, cmd) {
    return safeSendMessage(tabId, { type: 'EXECUTE_ACTION', action: cmd });
}

function parseGeminiJSON(text) {
    let t = text.trim();
    if (t.startsWith('```')) t = t.replace(/```(json)?/g, '').replace(/```/g, '').trim();
    const start = t.indexOf('{'), end = t.lastIndexOf('}');
    return JSON.parse(t.substring(start, end + 1));
}

async function callGemini(prompt, taskId, maxKeys = GEMINI_MAX_KEYS_PER_CALL) {
    log('INFO', `Prompt size: ~${Math.round(prompt.length / 1000)}KB`);

    const keysToTry = Math.min(maxKeys, GEMINI_API_KEYS.length);
    const startIndex = geminiKeyIndex;

    const modelsToTry = [MODEL_NAME, FALLBACK_MODEL_NAME].filter(Boolean);

    for (let i = 0; i < keysToTry; i++) {
        // Check pause/cancel state before each attempt
        if (agentRunState === 'paused' || agentRunState === 'idle' || (taskId && currentTasks.find(t => t.id === taskId)?.status === 'cancelled')) {
            log('WARN', 'Agent paused or cancelled during Gemini key loop. Aborting.');
            return null;
        }

        const idx = (geminiKeyIndex + i) % GEMINI_API_KEYS.length;
        const maskedKey = GEMINI_API_KEYS[idx].substring(0, 10) + '...';

        for (const model of modelsToTry) {
            log('INFO', `Trying key #${idx + 1}/${GEMINI_API_KEYS.length} (${maskedKey}) with model ${model}`);
            
            let timeoutId;
            try {
                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

                // Register this controller so pause/stop can abort it immediately
                if (taskId) {
                    const oldCtrl = activeGeminiControllers.get(taskId);
                    if (oldCtrl) { try { oldCtrl.abort(); } catch(e) {} }
                    activeGeminiControllers.set(taskId, controller);
                }

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEYS[idx]}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1 }
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                if (taskId) activeGeminiControllers.delete(taskId);

                if (res.status === 429) {
                    await res.text().catch(() => '');
                    log('WARN', `Key #${idx + 1} (${model}) rate-limited (429).`);
                    continue; // Try fallback model, or next key if already fallback
                }
                if (res.status === 403) {
                    await res.text().catch(() => '');
                    log('WARN', `Key #${idx + 1} (${model}) forbidden (403).`);
                    continue;
                }
                if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    log('ERROR', `Key #${idx + 1} (${model}) HTTP ${res.status}: ${errText.substring(0, 300)}`);
                    continue;
                }

                const data = await res.json();

                if (!data.candidates || data.candidates.length === 0) {
                    log('WARN', `Key #${idx + 1} (${model}): No candidates returned. Possible safety block.`, JSON.stringify(data).substring(0, 300));
                    continue;
                }

                const textResponse = data.candidates[0]?.content?.parts?.[0]?.text;
                if (!textResponse) {
                    log('WARN', `Key #${idx + 1} (${model}): Empty text in candidate.`, JSON.stringify(data.candidates[0]).substring(0, 300));
                    continue;
                }

                geminiKeyIndex = idx;
                log('INFO', `Gemini response using ${model} (${textResponse.length} chars): ${textResponse.substring(0, 100)}...`);
                return textResponse;

            } catch (err) {
                if (timeoutId) clearTimeout(timeoutId);
                if (taskId) activeGeminiControllers.delete(taskId);
                const isAbort = err.name === 'AbortError';
                log('ERROR', `Key #${idx + 1} (${model}) network/parse error: ${isAbort ? 'Request aborted (timeout or user paused/stopped)' : err.message}`);
                
                // If aborted due to pause, don't try next key or model
                if (isAbort && (agentRunState === 'paused' || agentRunState === 'idle')) {
                    return null;
                }
                continue;
            }
        }
    }

    geminiKeyIndex = (startIndex + keysToTry) % GEMINI_API_KEYS.length;
    log('WARN', `Gemini batch failed (${keysToTry} keys tried). Will rotate keys for next attempt.`);
    return null;
}

async function reportResultToBackend(taskId, status, reason) {
    try {
        await fetch(`${BACKEND_URL}/agent/tasks/${taskId}/result`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Extension-Key': EXTENSION_API_KEY
            },
            body: JSON.stringify({ status, reason })
        });
    } catch(err) {
        log('ERROR', `reportResultToBackend failed: ${err.message}`);
    }
}

async function captureAndSyncCookies(rawDomain, merchantName) {
    let domain = rawDomain.trim();
    try {
        if (domain.includes('://')) domain = new URL(domain).hostname;
    } catch(e) {}
    domain = domain.replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();

    log('INFO', `Syncing cookies for domain: "${domain}" (raw: "${rawDomain}")`);

    try {
        const cookies = await chrome.cookies.getAll({ domain });

        if (!cookies || cookies.length === 0) {
            log('WARN', `Sync for ${merchantName}: no cookies found for domain "${domain}"`);
            return { status: 'error', message: `No cookies found in browser for "${domain}"` };
        }

        await fetch(`${BACKEND_URL}/merchant-cookies`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Extension-Key': EXTENSION_API_KEY
            },
            body: JSON.stringify({
                providerName: merchantName,
                merchantUrl: `https://${domain}/`,
                cookiesCount: cookies.length,
                cookies,
                syncedAt: new Date().toISOString()
            })
        });

        log('INFO', `Synced ${cookies.length} cookies for ${merchantName} (${domain})`);
        return { status: 'updated', cookiesCount: cookies.length };
    } catch (e) {
        log('ERROR', `captureAndSyncCookies error for ${domain}:`, e);
        return { status: 'error', message: e.message };
    }
}

function detectCouponSuccess(domState, code) {
    if (!domState) return false;
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const codeRegex = new RegExp('\\b' + escapedCode + '\\b', 'i');
    
    // Check status messages
    if (domState.statusMessages) {
        const hasCodeInMessages = domState.statusMessages.some(msg => codeRegex.test(msg));
        if (hasCodeInMessages) {
            const successKeywords = ['applied', 'savings', 'saved', 'discount', 'remove', 'success', 'off', 'active'];
            const hasSuccess = domState.statusMessages.some(msg => {
                const lower = msg.toLowerCase();
                return successKeywords.some(kw => lower.includes(kw));
            });
            if (hasSuccess) return true;
        }
    }
    
    // Check actionable elements (e.g. a "Remove" button next to or containing the coupon code)
    if (domState.actionableElements) {
        const hasRemoveAction = domState.actionableElements.some(el => {
            const txt = el.text || '';
            const lower = txt.toLowerCase();
            return codeRegex.test(txt) && (lower.includes('remove') || lower.includes('cancel') || lower.includes('delete') || lower.includes('applied'));
        });
        if (hasRemoveAction) return true;
    }
    
    return false;
}

async function clearBrowserCookies(rawDomain) {
    let domain = rawDomain.trim();
    try {
        if (domain.includes('://')) domain = new URL(domain).hostname;
    } catch(e) {}
    domain = domain.replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();

    log('INFO', `Clearing browser cookies for domain: "${domain}"`);
    try {
        const cookies = await chrome.cookies.getAll({ domain });
        for (const cookie of cookies) {
            const protocol = cookie.secure ? "https" : "http";
            const url = `${protocol}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
            await chrome.cookies.remove({ url, name: cookie.name });
        }
        log('INFO', `Cleared ${cookies.length} browser cookies for ${domain}`);
    } catch (e) {
        log('ERROR', `clearBrowserCookies error for ${domain}:`, e);
    }
}
