// background.js - Dealora AI Verification Agent
import { CONFIG } from './config.js';

const { GEMINI_API_KEYS, MODEL_NAME, BACKEND_URL } = CONFIG;

// ─── State ───────────────────────────────────────────────────
let isRunning = false;
let currentTasks = [];
let merchantStatuses = {};
let knownMerchantDomains = {}; // { 'amazon.in': 'Amazon India', ... }
let cookieSyncTimers = {};     // debounce timers per domain
let lastSyncTimes = {};        // Throttling for cookie syncs
let geminiKeyIndex = 0;        // current key index for rotation

// ─── Lifecycle ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
    log('INFO', 'Extension installed.');
    chrome.storage.local.set({ isRunning: false, currentTasks: [], merchantStatuses: {} });
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
        const campaignRes = await fetch(`${BACKEND_URL}/campaigns`);
        if (campaignRes.ok) {
            const data = await campaignRes.json();
            const campaigns = (data.campaigns || []).filter(c => c.domain);
            knownMerchantDomains = {};
            campaigns.forEach(c => { knownMerchantDomains[c.domain] = c.title || c.domain; });
            log('INFO', `Tracking ${Object.keys(knownMerchantDomains).length} merchant domains`);
        }
        const cookieRes = await fetch(`${BACKEND_URL}/merchant-cookies`);
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
        chrome.storage.local.set({ isRunning });
        startAgentLoop();
        sendResponse({ status: 'started' });
    } else if (request.type === 'STOP_AGENT') {
        isRunning = false;
        chrome.storage.local.set({ isRunning });
        sendResponse({ status: 'stopped' });
    } else if (request.type === 'GET_STATE') {
        sendResponse({ isRunning, currentTasks, merchantStatuses });
    } else if (request.type === 'UPDATE_MERCHANT_LOGIN') {
        const { domain, merchantName } = request;
        merchantStatuses[domain] = { isLoggedIn: true, lastChecked: Date.now() };
        chrome.storage.local.set({ merchantStatuses });
        captureAndSyncCookies(domain, merchantName || domain);
        sendResponse({ status: 'updated' });
    } else if (request.type === 'SUBMIT_OTP') {
        const task = currentTasks.find(t => t.id === request.taskId);
        if (task && task.status === 'waiting_for_otp') {
            task.providedOtp = request.otp;
            task.status = 'running';
            chrome.storage.local.set({ currentTasks });
            if (task._resumeResolver) task._resumeResolver();
        }
        sendResponse({ status: 'resumed' });
    } else if (request.type === 'TRIGGER_VERIFY') {
        triggerSingleVerification(request.couponId)
            .then(() => sendResponse({ status: 'queued' }))
            .catch(err => sendResponse({ status: 'error', message: err.message }));
    }
    return true; 
});

async function startAgentLoop() {
    chrome.alarms.create('agentLoop', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'agentLoop' && isRunning && currentTasks.length < 5) await fetchAndQueueTasks();
    });
}

async function fetchAndQueueTasks() {
    try {
        const res = await fetch(`${BACKEND_URL}/agent/pending-tasks`);
        if (!res.ok) return;
        const data = await res.json();
        const newTasks = data.coupons || [];
        for (let task of newTasks) {
            if (currentTasks.length >= 5) break;
            const domain = new URL(task.url).hostname;
            if (!merchantStatuses[domain]?.isLoggedIn) continue;
            task.status = 'running';
            currentTasks.push(task);
            chrome.storage.local.set({ currentTasks });
            verifyCoupon(task).finally(() => {
                currentTasks = currentTasks.filter(t => t.id !== task.id);
                chrome.storage.local.set({ currentTasks });
            });
        }
    } catch (err) {}
}

async function triggerSingleVerification(couponId) {
    const res = await fetch(`${BACKEND_URL}/coupons/${couponId}`);
    const { data: coupon } = await res.json();
    const url = coupon.couponVisitingLink || coupon.trackingLink;
    if (!url) throw new Error('No URL');
    const task = { id: coupon._id, url, code: coupon.code, brand: coupon.brandName, status: 'running', message: 'Starting...' };
    currentTasks.push(task);
    chrome.storage.local.set({ currentTasks });
    verifyCoupon(task).finally(() => {
        currentTasks = currentTasks.filter(t => t.id !== task.id);
        chrome.storage.local.set({ currentTasks });
    });
}

// ─── Verification Logic ──────────────────────────────────────
async function verifyCoupon(task) {
    log('INFO', '🔍 STARTING VERIFICATION:', task.code, 'on', task.url);
    const windowInfo = await chrome.windows.create({ url: task.url, state: 'normal', width: 1280, height: 900, focused: false });
    const tabId = windowInfo.tabs[0].id;

    try {
        await waitForTabLoad(tabId);
        await new Promise(r => setTimeout(r, 3000));
        await ensureContentScript(tabId);
    } catch(err) { log('WARN', 'Initial load issue:', err.message); }

    let isComplete = false, attempts = 0, actionHistory = [], consecutiveErrors = 0;
    while (!isComplete && attempts < 20) {
        attempts++;
        log('INFO', `────── Step ${attempts}/20 ──────`);

        while (task.status === 'waiting_for_otp') await new Promise(r => { task._resumeResolver = r; });

        const domResponse = await new Promise(r => {
            chrome.tabs.sendMessage(tabId, { type: 'GET_DOM' }, res => {
                if (chrome.runtime.lastError) r({ status: 'error', message: chrome.runtime.lastError.message });
                else r(res || { status: 'error', message: 'No response' });
            });
        });

        if (domResponse.status !== 'success') {
            consecutiveErrors++;
            if (consecutiveErrors >= 3) break;
            await ensureContentScript(tabId);
            continue;
        }

        const domState = domResponse.domState;
        let stuckWarning = '';
        if (actionHistory.length >= 2 && actionHistory.slice(-2).every(h => h.selector === actionHistory[actionHistory.length-1].selector) && actionHistory[actionHistory.length-1].url === domState.url) {
            stuckWarning = `⚠️ WARNING: You clicked "${actionHistory[actionHistory.length-1].selector}" multiple times and the page state didn't change. DO NOT repeat this. Find another element or evaluate as "invalid".`;
            log('WARN', 'AI is stuck. Injecting warning.');
        }

        const prompt = buildPrompt(task, domState, actionHistory, stuckWarning);
        const aiResponse = await callGemini(prompt);
        if (!aiResponse) break;

        try {
            const cmd = parseGeminiJSON(aiResponse);
            log('INFO', `🤖 Gemini: ${cmd.action} on ${cmd.selector || cmd.url}`);
            actionHistory.push({ step: attempts, action: cmd.action, selector: cmd.selector || 'N/A', url: domState.url });
            if (actionHistory.length > 5) actionHistory.shift();

            if (cmd.action === 'evaluate') {
                log('INFO', `🏁 FINISHED: ${cmd.status} - ${cmd.reason}`);
                await reportResultToBackend(task.id, cmd.status, cmd.reason);
                isComplete = true;
            } else if (cmd.action === 'request_otp') {
                task.status = 'waiting_for_otp';
                task.message = cmd.message;
                chrome.storage.local.set({ currentTasks });
            } else {
                await executeActionOnTab(tabId, cmd);
                await new Promise(r => setTimeout(r, 4000));
            }
        } catch (e) { log('ERROR', 'Parse error:', e); }
    }
    if (windowInfo?.id) chrome.windows.remove(windowInfo.id).catch(() => {});
}

function buildPrompt(task, dom, history, warn) {
    const histLines = history.map(h => `- Step ${h.step}: ${h.action} on ${h.selector}`).join('\n');
    return `You are an AI browser agent verifying coupon "${task.code}" for ${task.brand}.
URL: ${dom.url}
HISTORY:
${histLines || 'None'}
${warn ? `\nSTUCK WARNING: ${warn}\n` : ''}

Actionable Elements (${dom.actionableElements.length}):
${JSON.stringify(dom.actionableElements, null, 2)}

DECIDE:
1. Click/Type/Navigate to reach the coupon entry step.
2. If you see the coupon result (savings or error), use {"action":"evaluate","status":"valid"|"invalid"|"expired","reason":"..."}.
3. IMPORTANT: If you cannot find a promo code/coupon field on this site after searching, evaluate as "invalid" with reason "Could not find coupon entry field".

Respond only with raw JSON: {"action":"click"|"type"|"evaluate"|"wait"|"navigate"|"request_otp","selector":"...","value":"...","status":"...","reason":"..."}`;
}

async function waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject('Timeout'), 30000);
        const listener = (tid, change) => { if (tid === tabId && change.status === 'complete') { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

async function ensureContentScript(tabId) {
    const alive = await new Promise(r => { chrome.tabs.sendMessage(tabId, { type: 'PING' }, res => r(!!res)); });
    if (!alive) await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

function executeActionOnTab(tabId, cmd) {
    return new Promise(r => chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_ACTION', action: cmd }, res => r(res)));
}

function parseGeminiJSON(text) {
    let t = text.trim();
    if (t.startsWith('```')) t = t.replace(/```(json)?/g, '').replace(/```/g, '').trim();
    const start = t.indexOf('{'), end = t.lastIndexOf('}');
    return JSON.parse(t.substring(start, end + 1));
}

async function callGemini(prompt) {
    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
        const idx = (geminiKeyIndex + i) % GEMINI_API_KEYS.length;
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEYS[idx]}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
            });
            if (res.status === 429 || res.status === 403) continue;
            const data = await res.json();
            geminiKeyIndex = idx;
            return data.candidates[0].content.parts[0].text;
        } catch (e) {}
    }
    return null;
}

async function reportResultToBackend(taskId, status, reason) {
    await fetch(`${BACKEND_URL}/agent/tasks/${taskId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason })
    });
}

async function captureAndSyncCookies(domain, merchantName) {
    try {
        const cookies = await chrome.cookies.getAll({ domain: domain.replace(/^www\./, '') });
        await fetch(`${BACKEND_URL}/merchant-cookies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerName: merchantName, merchantUrl: `https://${domain}/`, cookiesCount: cookies.length, cookies, syncedAt: new Date().toISOString() })
        });
    } catch (e) {}
}
