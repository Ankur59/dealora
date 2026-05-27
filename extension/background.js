// background.js - Dealora AI Verification Agent
import { CONFIG } from './config.js';

const {
    GEMINI_API_KEYS,
    MODEL_NAME,
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

let agentRunState = 'idle'; // 'idle', 'running', 'paused'
let agentCheckedCount = 0;
let agentTotalCount = 0;

// Load initial state
chrome.storage.local.get(['isRunning', 'currentTasks', 'merchantStatuses', 'agentRunState', 'agentCheckedCount', 'agentTotalCount'], (res) => {
    isRunning = res.isRunning || false;
    currentTasks = res.currentTasks || [];
    merchantStatuses = res.merchantStatuses || {};
    agentRunState = res.agentRunState || 'idle';
    agentCheckedCount = res.agentCheckedCount || 0;
    agentTotalCount = res.agentTotalCount || 0;
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
        for (let t of currentTasks) {
            t.status = 'cancelled';
        }
        currentTasks = [];
        chrome.storage.local.set({ currentTasks });
        sendResponse({ status: 'cancelled' });
    } else if (request.type === 'PAUSE_AGENT') {
        agentRunState = 'paused';
        chrome.storage.local.set({ agentRunState });
        sendResponse({ status: 'paused' });
    } else if (request.type === 'RESUME_AGENT') {
        agentRunState = 'running';
        chrome.storage.local.set({ agentRunState });
        sendResponse({ status: 'resumed' });
    } else if (request.type === 'GET_STATE') {
        sendResponse({ isRunning, currentTasks, merchantStatuses, agentRunState, agentCheckedCount, agentTotalCount });
    } else if (request.type === 'UPDATE_MERCHANT_LOGIN') {
        const { domain, merchantName } = request;
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
        if (alarm.name === 'agentLoop' && isRunning && currentTasks.length < 5) await fetchAndQueueTasks();
    });
}

function onTaskFinished() {
    if (agentRunState && agentRunState !== 'idle') {
        agentCheckedCount += 1;
        let stateUpdate = { agentCheckedCount };
        if (agentCheckedCount >= agentTotalCount) {
            agentRunState = 'idle';
            isRunning = false;
            stateUpdate.agentRunState = 'idle';
            stateUpdate.isRunning = false;
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
        for (let task of newTasks) {
            if (currentTasks.length >= 5) break;
            const domain = new URL(task.url).hostname.replace(/^www\./, '');
            
            if (!merchantStatuses[domain]?.isLoggedIn) {
                if (!currentTasks.some(t => t.type === 'auth' && t.domain === domain)) {
                    const authTask = { id: `auth_${domain}_${Date.now()}`, type: 'auth', domain, url: task.url, code: 'LOGIN_FLOW', brand: knownMerchantDomains[domain] || domain, status: 'running', message: 'Authenticating...' };
                    currentTasks.push(authTask);
                    chrome.storage.local.set({ currentTasks });
                    runAgentSequence(authTask).finally(() => {
                        currentTasks = currentTasks.filter(t => t.id !== authTask.id);
                        chrome.storage.local.set({ currentTasks });
                    });
                }
                onTaskFinished();
                continue;
            }

            task.type = 'verify';
            task.status = 'running';
            currentTasks.push(task);
            chrome.storage.local.set({ currentTasks });
            runAgentSequence(task).finally(() => {
                currentTasks = currentTasks.filter(t => t.id !== task.id);
                chrome.storage.local.set({ currentTasks });
                onTaskFinished();
            });

            // Delay between coupons to avoid getting flagged
            const waitMs = Math.random() * (MAX_DELAY_BETWEEN_COUPONS_MS - MIN_DELAY_BETWEEN_COUPONS_MS) + MIN_DELAY_BETWEEN_COUPONS_MS;
            await new Promise(r => setTimeout(r, waitMs));
        }
        return newTasks.length;
    } catch (err) {
        return 0;
    }
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
    log('INFO', `🔍 STARTING ${task.type.toUpperCase()}:`, task.code, 'on', task.url);
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

    let isComplete = false, attempts = 0, actionHistory = [], consecutiveErrors = 0, blockRetries = 0;
    
    let mappedSequence = null;
    let credentials = null;
    let fallbackToAI = false;
    
    const headers = { 'X-Extension-Key': EXTENSION_API_KEY };

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
        log('INFO', `Elements: ${domState.actionableElements.length}`);

        let stuckWarning = '';
        if (actionHistory.length >= 2) {
            const last2 = actionHistory.slice(-2);
            if (last2.every(h => h.selector === last2[0].selector && h.url === domState.url)) {
                stuckWarning = `⚠️ WARNING: You already tried "${last2[0].selector}" ${last2.length} times and page didn't change. DO NOT repeat it. Try something else, or if you cannot find coupon field, evaluate as "invalid" with reason "Could not find coupon entry field".`;
                log('WARN', 'Loop detected. Injecting stuck warning.');
            }
        }

        let cmd = null;
        
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
        } else {
            log('INFO', 'Calling Gemini...');
            const prompt = buildPrompt(task, domState, actionHistory, stuckWarning);
            const aiResponse = await callGemini(prompt);
            if (!aiResponse) {
                log('ERROR', 'Gemini returned nothing. Aborting.');
                break;
            }

            try {
                cmd = parseGeminiJSON(aiResponse);
            } catch (e) {
                log('ERROR', 'Failed to parse Gemini JSON:', aiResponse.substring(0, 200));
                consecutiveErrors++;
                if (consecutiveErrors >= 3) break;
                continue;
            }
        }

        log('INFO', `🤖 Agent choice: ${JSON.stringify(cmd)}`);
        if (cmd.value === credentials?.username && credentials?.username) { cmd.valuePlaceholder = '<USERNAME>'; }
        if (cmd.value === credentials?.password && credentials?.password) { cmd.valuePlaceholder = '<PASSWORD>'; }

        actionHistory.push({ 
            step: attempts, 
            action: cmd.action, 
            selector: cmd.selector || cmd.url || 'N/A', 
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
            if (result?.status === 'error' && cmd._isDeterministic) {
                log('WARN', 'Deterministic step failed. Falling back to AI for healing.');
                fallbackToAI = true;
                task._healingContext = `The deterministic step "${cmd.action} on ${cmd.selector}" failed with error: ${result?.message}. Please solve this step manually and proceed.`;
                continue; 
            }
            await new Promise(r => setTimeout(r, 4000));
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
            log('INFO', `⏳ Waiting ${cmd.ms || 2000}ms`);
            await new Promise(r => setTimeout(r, cmd.ms || 2000));
        } else {
            log('WARN', `Unknown action: ${cmd.action}`);
        }
    }

    if (!isComplete && task.type === 'verify') {
        log('WARN', `Verification did not complete. Marking as invalid.`);
        await reportResultToBackend(task.id, 'invalid', 'Verification timed out or could not complete.');
    } else if (isComplete && task.type === 'auth') {
        log('INFO', `Auth completed. Saving map to DB for ${task.domain}`);
        try {
            const stepsToSave = actionHistory.map((h, i) => ({
                step: i+1,
                action: h.action,
                selector: ['navigate'].includes(h.action) ? null : h.selector,
                url: h.action === 'navigate' ? h.selector : h.url,
                value: h.valuePlaceholder || null
            })).filter(h => h.action !== 'evaluate'); 

            await fetch(`${BACKEND_URL}/agent/automation-map`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Extension-Key': EXTENSION_API_KEY
                },
                body: JSON.stringify({ domain: task.domain, flowType: 'login', steps: stepsToSave })
            });

            captureAndSyncCookies(task.domain, task.brand);
        } catch(e) {}
    }

    if (windowInfo?.id) {
        try { await chrome.windows.remove(windowInfo.id); } catch(e) {}
    }
    log('INFO', `🔍 ${task.type.toUpperCase()} task finished for ${task.code}`);
}

function buildPrompt(task, dom, history, warn) {
    const histLines = history.map(h => `- Step ${h.step}: ${h.action} on ${h.selector}`).join('\n');
    
    let objectiveStr = `You are an AI browser agent verifying coupon "${task.code}" for ${task.brand}.
${task.description ? `COUPON TERMS & CONDITIONS: "${task.description}"` : ''}

DECIDE:
1. SMART MATCH: Before applying the coupon, inspect any cart items, product categories, or order details visible on the current page. Match them against the COUPON TERMS & CONDITIONS above.
   - If the cart contents or spend amounts violate the coupon terms (e.g. coupon is only for shoes, but cart has electronics; or coupon has a $50 minimum but cart total is $30), immediately evaluate the coupon as "invalid" with reason "Coupon terms/exclusions do not match cart items".
2. Click/Type/Navigate to reach the coupon entry step.
3. If you see the coupon result (savings or error), use {"action":"evaluate","status":"valid"|"invalid"|"expired","reason":"..."}.
4. IMPORTANT: If you cannot find a promo code/coupon field on this site after searching, evaluate as "invalid" with reason "Could not find coupon entry field".
5. SELECTORS: Use the EXACT "selector" string from the Actionable Elements list below. These are unique IDs prefixed with "[data-dl-id=...]".
6. APPLY BUTTON: If multiple "Apply" buttons exist, always select the one that is physically closest to the input field where you typed the coupon code.`;

    if (task.type === 'auth') {
        objectiveStr = `You are an AI browser agent tasked with logging into the website for ${task.brand}.
${task._healingContext ? `HEALING CONTEXT: ${task._healingContext}\n` : ''}
DECIDE:
1. Click login buttons or Navigate to the login page.
2. Type the username and password (you can guess them if standard flow, they will be replaced dynamically but for now output dummy values).
3. Check for OTP requirements. If OTP is requested by the site, use {"action":"request_otp","message":"Enter the OTP sent to email/phone"}.
4. If you have successfully logged in (dashboard visible, logout button visible, or "My Account"), use {"action":"evaluate","status":"valid","reason":"Logged in successfully"}.
5. SELECTORS: Use the EXACT "selector" string from the Actionable Elements list below (e.g. "[data-dl-id='...']").`;
    }

    return `${objectiveStr}
URL: ${dom.url}
HISTORY:
${histLines || 'None'}
${warn ? `\nSTUCK WARNING: ${warn}\n` : ''}

Detected Status Messages (Success/Error signals):
${dom.statusMessages && dom.statusMessages.length > 0 ? dom.statusMessages.map(m => `- ${m}`).join('\n') : 'No recent status messages detected.'}

Actionable Elements (showing top 100 of ${dom.actionableElements.length}):
${JSON.stringify(dom.actionableElements.slice(0, 100), null, 2)}

Respond only with raw JSON: {"action":"click"|"type"|"evaluate"|"wait"|"navigate"|"request_otp","selector":"...","value":"...","status":"...","reason":"..."}`;
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
        try {
            chrome.tabs.sendMessage(tabId, message, (response) => {
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
