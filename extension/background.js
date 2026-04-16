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
    let windowInfo;
    try {
        windowInfo = await chrome.windows.create({ url: task.url, state: 'normal', width: 1280, height: 900, focused: false });
    } catch (err) {
        log('ERROR', 'Failed to create window:', err);
        return;
    }
    const tabId = windowInfo.tabs[0].id;
    log('INFO', `Window ${windowInfo.id}, tab ${tabId} created.`);

    // Wait for the page to load
    log('INFO', 'Waiting for page load...');
    await waitForTabLoad(tabId, 30000);
    log('INFO', 'Page loaded. Settling for 3s...');
    await new Promise(r => setTimeout(r, 3000));

    // Ensure content script is injected
    log('INFO', 'Ensuring content script...');
    await ensureContentScript(tabId);
    log('INFO', 'Content script ready.');

    let isComplete = false, attempts = 0, actionHistory = [], consecutiveErrors = 0;
    while (!isComplete && attempts < 20) {
        attempts++;
        log('INFO', `────── Step ${attempts}/20 ──────`);

        // OTP pause
        while (task.status === 'waiting_for_otp') {
            log('INFO', '⏸ Waiting for OTP...');
            await new Promise(r => { task._resumeResolver = r; });
        }

        // Get DOM
        log('INFO', 'Fetching DOM...');
        const domResponse = await safeSendMessage(tabId, { type: 'GET_DOM' });

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
        log('INFO', `Page: "${domState.title}"`);
        log('INFO', `URL:  ${domState.url}`);
        log('INFO', `Elements: ${domState.actionableElements.length}`);

        // Detect stuck loop
        let stuckWarning = '';
        if (actionHistory.length >= 2) {
            const last2 = actionHistory.slice(-2);
            if (last2.every(h => h.selector === last2[0].selector && h.url === domState.url)) {
                stuckWarning = `⚠️ WARNING: You already tried "${last2[0].selector}" ${last2.length} times and the page didn't change. DO NOT repeat it. Try something else, or if you cannot find the coupon field, evaluate as "invalid" with reason "Could not find coupon entry field".`;
                log('WARN', 'Loop detected. Injecting stuck warning.');
            }
        }

        // Call Gemini
        log('INFO', 'Calling Gemini...');
        const prompt = buildPrompt(task, domState, actionHistory, stuckWarning);
        const aiResponse = await callGemini(prompt);
        if (!aiResponse) {
            log('ERROR', 'Gemini returned nothing. Aborting.');
            break;
        }

        // Parse response
        let cmd;
        try {
            cmd = parseGeminiJSON(aiResponse);
        } catch (e) {
            log('ERROR', 'Failed to parse Gemini JSON:', aiResponse.substring(0, 200));
            consecutiveErrors++;
            if (consecutiveErrors >= 3) break;
            continue;
        }

        log('INFO', `🤖 Gemini decided: ${JSON.stringify(cmd)}`);
        actionHistory.push({ step: attempts, action: cmd.action, selector: cmd.selector || cmd.url || 'N/A', url: domState.url });
        if (actionHistory.length > 5) actionHistory.shift();

        // Execute
        if (cmd.action === 'evaluate') {
            log('INFO', `🏁 RESULT: ${cmd.status} — ${cmd.reason}`);
            await reportResultToBackend(task.id, cmd.status, cmd.reason);
            isComplete = true;
        } else if (cmd.action === 'request_otp') {
            task.status = 'waiting_for_otp';
            task.message = cmd.message;
            chrome.storage.local.set({ currentTasks });
        } else if (cmd.action === 'click') {
            log('INFO', `👆 Clicking: ${cmd.selector}`);
            const result = await executeActionOnTab(tabId, cmd);
            log('INFO', `   Click result: ${result?.status} — ${result?.message || ''}`);
            await new Promise(r => setTimeout(r, 4000));
        } else if (cmd.action === 'type') {
            log('INFO', `⌨️  Typing "${cmd.value}" into ${cmd.selector}`);
            const result = await executeActionOnTab(tabId, cmd);
            log('INFO', `   Type result: ${result?.status} — ${result?.message || ''}`);
            await new Promise(r => setTimeout(r, 2000));
        } else if (cmd.action === 'navigate') {
            log('INFO', `🧭 Navigating to: ${cmd.url}`);
            await chrome.tabs.update(tabId, { url: cmd.url });
            await waitForTabLoad(tabId, 30000);
            await new Promise(r => setTimeout(r, 3000));
            await ensureContentScript(tabId);
        } else if (cmd.action === 'wait') {
            log('INFO', `⏳ Waiting ${cmd.ms || 2000}ms`);
            await new Promise(r => setTimeout(r, cmd.ms || 2000));
        } else {
            log('WARN', `Unknown action: ${cmd.action}`);
        }
    }

    if (!isComplete) {
        log('WARN', `Verification did not complete. Marking as invalid.`);
        await reportResultToBackend(task.id, 'invalid', 'Verification timed out or could not complete.');
    }

    if (windowInfo?.id) {
        try { await chrome.windows.remove(windowInfo.id); } catch(e) {}
    }
    log('INFO', `🔍 Verification finished for ${task.code}`);
}

function buildPrompt(task, dom, history, warn) {
    const histLines = history.map(h => `- Step ${h.step}: ${h.action} on ${h.selector}`).join('\n');
    return `You are an AI browser agent verifying coupon "${task.code}" for ${task.brand}.
URL: ${dom.url}
HISTORY:
${histLines || 'None'}
${warn ? `\nSTUCK WARNING: ${warn}\n` : ''}

Actionable Elements (showing top 80 of ${dom.actionableElements.length}):
${JSON.stringify(dom.actionableElements.slice(0, 80), null, 2)}

DECIDE:
1. Click/Type/Navigate to reach the coupon entry step.
2. If you see the coupon result (savings or error), use {"action":"evaluate","status":"valid"|"invalid"|"expired","reason":"..."}.
3. IMPORTANT: If you cannot find a promo code/coupon field on this site after searching, evaluate as "invalid" with reason "Could not find coupon entry field".

Respond only with raw JSON: {"action":"click"|"type"|"evaluate"|"wait"|"navigate"|"request_otp","selector":"...","value":"...","status":"...","reason":"..."}`;
}

/**
 * Wait for a tab to finish loading. Handles the race condition where
 * the tab might already be loaded before we attach the listener.
 */
function waitForTabLoad(tabId, timeoutMs = 30000) {
    return new Promise((resolve) => {
        // First check if the tab is already complete
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                log('WARN', 'waitForTabLoad: tab.get error:', chrome.runtime.lastError.message);
                resolve(); // resolve anyway, don't crash
                return;
            }
            if (tab && tab.status === 'complete') {
                log('INFO', 'Tab already loaded.');
                resolve();
                return;
            }
            // Not loaded yet — wait for the event
            const timer = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                log('WARN', `Tab load timed out after ${timeoutMs}ms. Continuing anyway.`);
                resolve(); // don't reject, just continue
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

/**
 * Ensure the content script is available in a tab.
 * First pings, then falls back to manual injection.
 */
async function ensureContentScript(tabId) {
    // Try pinging the content script
    const alive = await safeSendMessage(tabId, { type: 'PING' });
    if (alive && alive.status === 'alive') {
        return true;
    }
    // Not alive — inject manually
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

/**
 * Safe wrapper around chrome.tabs.sendMessage that always resolves
 * (never throws) and properly handles chrome.runtime.lastError.
 */
function safeSendMessage(tabId, message) {
    return new Promise((resolve) => {
        try {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                // MUST read lastError or Chrome throws an uncaught error
                if (chrome.runtime.lastError) {
                    resolve({ status: 'error', message: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { status: 'error', message: 'Empty response' });
                }
            });
        } catch (err) {
            resolve({ status: 'error', message: err.message });
        }
    });
}

/**
 * Execute an action in a tab via the content script.
 */
function executeActionOnTab(tabId, cmd) {
    return safeSendMessage(tabId, { type: 'EXECUTE_ACTION', action: cmd });
}

function parseGeminiJSON(text) {
    let t = text.trim();
    if (t.startsWith('```')) t = t.replace(/```(json)?/g, '').replace(/```/g, '').trim();
    const start = t.indexOf('{'), end = t.lastIndexOf('}');
    return JSON.parse(t.substring(start, end + 1));
}

async function callGemini(prompt) {
    log('INFO', `Prompt size: ~${Math.round(prompt.length / 1000)}KB`);

    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
        const idx = (geminiKeyIndex + i) % GEMINI_API_KEYS.length;
        const maskedKey = GEMINI_API_KEYS[idx].substring(0, 10) + '...';

        try {
            log('INFO', `Trying key #${idx + 1}/${GEMINI_API_KEYS.length} (${maskedKey})`);
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEYS[idx]}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1 }
                })
            });

            if (res.status === 429) {
                log('WARN', `Key #${idx + 1} rate-limited (429). Trying next...`);
                continue;
            }
            if (res.status === 403) {
                log('WARN', `Key #${idx + 1} forbidden (403). Trying next...`);
                continue;
            }
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                log('ERROR', `Key #${idx + 1} HTTP ${res.status}: ${errText.substring(0, 300)}`);
                continue;
            }

            const data = await res.json();

            // Check if the response has valid candidates
            if (!data.candidates || data.candidates.length === 0) {
                log('WARN', `Key #${idx + 1}: No candidates returned. Possible safety block.`, JSON.stringify(data).substring(0, 300));
                continue;
            }

            const textResponse = data.candidates[0]?.content?.parts?.[0]?.text;
            if (!textResponse) {
                log('WARN', `Key #${idx + 1}: Empty text in candidate.`, JSON.stringify(data.candidates[0]).substring(0, 300));
                continue;
            }

            geminiKeyIndex = idx;
            log('INFO', `Gemini response (${textResponse.length} chars): ${textResponse.substring(0, 100)}...`);
            return textResponse;

        } catch (err) {
            log('ERROR', `Key #${idx + 1} network/parse error: ${err.message}`);
            continue;
        }
    }

    log('ERROR', `All ${GEMINI_API_KEYS.length} Gemini keys failed. Cannot proceed.`);
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
