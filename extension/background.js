// background.js - Dealora AI Verification Agent
import { CONFIG } from './config.js';

const { GEMINI_API_KEYS, MODEL_NAME, BACKEND_URL } = CONFIG;

// ─── State ───────────────────────────────────────────────────
let isRunning = false;
let currentTasks = [];
let merchantStatuses = {};
let knownMerchantDomains = {}; // { 'amazon.in': 'Amazon India', ... }
let cookieSyncTimers = {};     // debounce timers per domain
let geminiKeyIndex = 0;        // current key index for rotation

// ─── Lifecycle ───────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
    log('INFO', 'Extension installed.');
    chrome.storage.local.set({ isRunning: false, currentTasks: [], merchantStatuses: {} });
    bootstrapMerchantSessions();
});

// Also bootstrap on service worker wake-up
bootstrapMerchantSessions();

// ─── Rich Logging Helper ────────────────────────────────────
function log(level, ...args) {
    const prefix = `[Dealora AI ${level}]`;
    if (level === 'ERROR') console.error(prefix, ...args);
    else if (level === 'WARN') console.warn(prefix, ...args);
    else console.log(prefix, ...args);
}

// ─── Bootstrap: load known merchants & existing sessions ─────
async function bootstrapMerchantSessions() {
    try {
        const campaignRes = await fetch(`${BACKEND_URL}/campaigns`);
        if (campaignRes.ok) {
            const data = await campaignRes.json();
            const campaigns = (data.campaigns || []).filter(c => c.domain);
            knownMerchantDomains = {};
            campaigns.forEach(c => {
                knownMerchantDomains[c.domain] = c.title || c.domain;
            });
            log('INFO', `Tracking ${Object.keys(knownMerchantDomains).length} merchant domains`);
        }

        const cookieRes = await fetch(`${BACKEND_URL}/merchant-cookies`);
        if (cookieRes.ok) {
            const data = await cookieRes.json();
            (data.data || []).forEach(r => {
                try {
                    const domain = new URL(r.merchantUrl).hostname.replace(/^www\./, '');
                    if (r.cookiesCount > 0) {
                        merchantStatuses[domain] = { isLoggedIn: true, lastChecked: new Date(r.syncedAt).getTime() };
                    }
                } catch(e) { /* skip */ }
            });
            chrome.storage.local.set({ merchantStatuses });
            log('INFO', `Restored ${Object.keys(merchantStatuses).length} merchant sessions from DB`);
        }
    } catch(err) {
        log('ERROR', 'bootstrapMerchantSessions:', err);
    }
}

// ─── Auto cookie tracking ────────────────────────────────────
chrome.cookies.onChanged.addListener((changeInfo) => {
    const cookieDomain = (changeInfo.cookie.domain || '').replace(/^\./, '');
    const matchedDomain = Object.keys(knownMerchantDomains).find(d =>
        cookieDomain === d || cookieDomain.endsWith('.' + d) || d.endsWith('.' + cookieDomain)
    );
    if (!matchedDomain) return;

    clearTimeout(cookieSyncTimers[matchedDomain]);
    cookieSyncTimers[matchedDomain] = setTimeout(() => {
        const merchantName = knownMerchantDomains[matchedDomain];
        log('INFO', `Auto-syncing cookies for ${matchedDomain} (${merchantName})`);
        merchantStatuses[matchedDomain] = { isLoggedIn: true, lastChecked: Date.now() };
        chrome.storage.local.set({ merchantStatuses });
        captureAndSyncCookies(matchedDomain, merchantName).catch(err => {
            log('ERROR', `Auto cookie sync failed for ${matchedDomain}:`, err);
        });
    }, 3000);
});

// ─── Message Listener ────────────────────────────────────────
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
        captureAndSyncCookies(domain, merchantName || domain).then(r => {
            log('INFO', `Cookie sync for ${domain}:`, r);
        }).catch(err => log('ERROR', `Cookie sync failed for ${domain}:`, err));
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
        const { couponId } = request;
        triggerSingleVerification(couponId)
            .then(() => sendResponse({ status: 'queued' }))
            .catch(err => {
                log('ERROR', 'Manual verify failed:', err);
                sendResponse({ status: 'error', message: err.message });
            });
    }
    return true; // keep channel open for async
});

// ─── Agent Loop ──────────────────────────────────────────────
async function startAgentLoop() {
    log('INFO', 'Agent loop started.');
    chrome.alarms.create('agentLoop', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'agentLoop' && isRunning && currentTasks.length < 5) {
            await fetchAndQueueTasks();
        }
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
            if (!merchantStatuses[domain]?.isLoggedIn) {
                log('WARN', `Requires login for ${domain}. Skipping task ${task.id}.`);
                continue;
            }
            task.status = 'running';
            task.message = 'Initializing...';
            currentTasks.push(task);
            chrome.storage.local.set({ currentTasks });

            verifyCoupon(task).catch(err => {
                log('ERROR', `Verification failed for task ${task.id}:`, err);
            }).finally(() => {
                currentTasks = currentTasks.filter(t => t.id !== task.id);
                chrome.storage.local.set({ currentTasks });
            });

            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 540000) + 60000));
        }
    } catch (err) {
        log('ERROR', 'fetchAndQueueTasks:', err);
    }
}

// ─── Manual Verification Trigger ─────────────────────────────
async function triggerSingleVerification(couponId) {
    try {
        log('INFO', `⚡ Manual verification triggered for coupon ${couponId}`);
        const res = await fetch(`${BACKEND_URL}/coupons/${couponId}`);
        if (!res.ok) throw new Error('Failed to fetch coupon from DB');

        const { data: coupon } = await res.json();
        const url = coupon.couponVisitingLink || coupon.trackingLink;

        if (!url) {
            log('WARN', `Coupon ${couponId} has no visiting/tracking link. Cannot verify.`);
            return;
        }

        log('INFO', `Coupon: code="${coupon.code}", brand="${coupon.brandName}", url="${url}"`);

        const task = {
            id: coupon._id,
            url,
            code: coupon.code,
            conditions: coupon.description || `Verify if the coupon code ${coupon.code} works on checkout.`,
            brand: coupon.brandName,
            status: 'running',
            message: 'Manual trigger — initializing…'
        };

        currentTasks.push(task);
        chrome.storage.local.set({ currentTasks });

        // Run verification (don't await — fire and forget so sendResponse works)
        verifyCoupon(task).catch(err => {
            log('ERROR', `Manual verification failed for ${couponId}:`, err);
        }).finally(() => {
            currentTasks = currentTasks.filter(t => t.id !== couponId);
            chrome.storage.local.set({ currentTasks });
        });

        log('INFO', `✅ Coupon ${coupon.code} queued for AI verification`);
    } catch (err) {
        log('ERROR', 'triggerSingleVerification:', err);
    }
}

// ─── Wait for tab to finish loading ──────────────────────────
function waitForTabLoad(tabId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error(`Tab ${tabId} load timed out after ${timeoutMs}ms`));
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
}

// ─── Ensure content script is injected ───────────────────────
async function ensureContentScript(tabId) {
    try {
        // Try pinging the content script
        const resp = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
                if (chrome.runtime.lastError) resolve(null);
                else resolve(response);
            });
        });
        if (resp && resp.status === 'alive') {
            log('INFO', `Content script already active on tab ${tabId}`);
            return true;
        }
    } catch(e) { /* not injected yet */ }

    // Inject manually
    try {
        log('INFO', `Injecting content script into tab ${tabId}...`);
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
        await new Promise(r => setTimeout(r, 1000)); // let it initialize
        log('INFO', `Content script injected into tab ${tabId}`);
        return true;
    } catch(err) {
        log('ERROR', `Failed to inject content script into tab ${tabId}:`, err);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// THE CORE AI VERIFICATION LOOP
// ═══════════════════════════════════════════════════════════════
async function verifyCoupon(task) {
    log('INFO', '═══════════════════════════════════════════');
    log('INFO', `🔍 STARTING VERIFICATION`);
    log('INFO', `   Coupon: ${task.code}`);
    log('INFO', `   Brand:  ${task.brand || 'Unknown'}`);
    log('INFO', `   URL:    ${task.url}`);
    log('INFO', '═══════════════════════════════════════════');

    let windowInfo;
    try {
        // Open a new window (normal, not minimized — minimized can cause issues)
        windowInfo = await chrome.windows.create({
            url: task.url,
            state: 'normal',
            width: 1280,
            height: 900,
            focused: false
        });
        log('INFO', `Opened window ${windowInfo.id} for verification`);
    } catch (err) {
        log('ERROR', 'Failed to create window:', err);
        await reportResultToBackend(task.id, 'invalid', 'Failed to open browser window for verification.');
        return;
    }

    const tabId = windowInfo.tabs[0].id;

    try {
        // Wait for the page to fully load
        log('INFO', `Waiting for tab ${tabId} to load...`);
        await waitForTabLoad(tabId, 30000);
        log('INFO', `Tab ${tabId} loaded.`);

        // Extra settle time for JS-heavy sites
        await new Promise(r => setTimeout(r, 3000));

        // Ensure content script is injected
        const injected = await ensureContentScript(tabId);
        if (!injected) {
            log('ERROR', 'Content script not available. Aborting.');
            await reportResultToBackend(task.id, 'invalid', 'Could not inject content script into the page.');
            return;
        }

    } catch(err) {
        log('WARN', `Tab load issue: ${err.message}. Trying to continue anyway...`);
        await new Promise(r => setTimeout(r, 5000));
        await ensureContentScript(tabId);
    }

    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 20;
    let extraContext = '';
    let consecutiveErrors = 0;

    while (!isComplete && attempts < maxAttempts) {
        attempts++;
        log('INFO', `────── Step ${attempts}/${maxAttempts} ──────`);

        // Pause for OTP if needed
        while (task.status === 'waiting_for_otp') {
            log('INFO', '⏸ Waiting for OTP from user...');
            await new Promise(r => { task._resumeResolver = r; });
        }

        // Inject OTP context if provided
        if (task.providedOtp) {
            extraContext = `The user just provided this OTP code: "${task.providedOtp}". Find the OTP input field, type it, and submit.`;
            task.providedOtp = null;
        }

        // 1. Get DOM state from content script
        log('INFO', `Requesting DOM from tab ${tabId}...`);
        const domResponse = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: 'GET_DOM' }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ status: 'error', message: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { status: 'error', message: 'No response from content script' });
                }
            });
        });

        if (domResponse.status !== 'success') {
            log('ERROR', `DOM fetch failed: ${domResponse.message}`);
            consecutiveErrors++;

            // Try re-injecting the content script
            if (consecutiveErrors <= 2) {
                log('INFO', 'Re-injecting content script...');
                await ensureContentScript(tabId);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            log('ERROR', 'Too many consecutive DOM fetch failures. Aborting.');
            await reportResultToBackend(task.id, 'invalid', `Content script communication failed after ${consecutiveErrors} retries.`);
            break;
        }

        consecutiveErrors = 0;
        const domState = domResponse.domState;
        log('INFO', `Page: "${domState.title}"`);
        log('INFO', `URL:  ${domState.url}`);
        log('INFO', `Found ${domState.actionableElements.length} actionable elements`);

        // 2. Ask Gemini what to do
        task.message = `Step ${attempts}: Analyzing page...`;
        chrome.storage.local.set({ currentTasks });

        const prompt = buildPrompt(task, domState, extraContext);
        extraContext = ''; // consume

        log('INFO', 'Calling Gemini AI...');
        const aiResponse = await callGemini(prompt);

        if (!aiResponse) {
            log('ERROR', 'Gemini returned empty response. Retrying...');
            consecutiveErrors++;
            if (consecutiveErrors >= 3) {
                await reportResultToBackend(task.id, 'invalid', 'AI model returned no response after multiple retries.');
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
            continue;
        }

        // 3. Parse Gemini response (handle markdown wrapping)
        let actionCmd;
        try {
            actionCmd = parseGeminiJSON(aiResponse);
            log('INFO', `🤖 Gemini decided: ${JSON.stringify(actionCmd)}`);
        } catch (e) {
            log('ERROR', `Failed to parse Gemini response:`, aiResponse);
            consecutiveErrors++;
            if (consecutiveErrors >= 3) {
                await reportResultToBackend(task.id, 'invalid', 'AI model returned unparseable responses.');
                break;
            }
            continue;
        }

        consecutiveErrors = 0;

        // 4. Execute the action
        task.message = `Step ${attempts}: ${actionCmd.action}`;
        chrome.storage.local.set({ currentTasks });

        if (actionCmd.action === 'evaluate') {
            log('INFO', '═══════════════════════════════════════════');
            log('INFO', `🏁 VERIFICATION COMPLETE`);
            log('INFO', `   Coupon: ${task.code}`);
            log('INFO', `   Status: ${actionCmd.status}`);
            log('INFO', `   Reason: ${actionCmd.reason}`);
            log('INFO', '═══════════════════════════════════════════');
            isComplete = true;
            await reportResultToBackend(task.id, actionCmd.status, actionCmd.reason);
            break;

        } else if (actionCmd.action === 'request_otp') {
            log('INFO', `🔑 OTP requested: ${actionCmd.message}`);
            task.status = 'waiting_for_otp';
            task.message = actionCmd.message || 'OTP required to proceed.';
            chrome.storage.local.set({ currentTasks });

        } else if (actionCmd.action === 'click') {
            log('INFO', `👆 Clicking: ${actionCmd.selector}`);
            const result = await executeActionOnTab(tabId, actionCmd);
            log('INFO', `   Result: ${result.status} — ${result.message || ''}`);
            await new Promise(r => setTimeout(r, 3000)); // wait for navigation/UI

        } else if (actionCmd.action === 'type') {
            log('INFO', `⌨️  Typing "${actionCmd.value}" into ${actionCmd.selector}`);
            const result = await executeActionOnTab(tabId, actionCmd);
            log('INFO', `   Result: ${result.status} — ${result.message || ''}`);
            await new Promise(r => setTimeout(r, 2000));

        } else if (actionCmd.action === 'wait') {
            const waitMs = actionCmd.ms || 2000;
            log('INFO', `⏳ Waiting ${waitMs}ms...`);
            await new Promise(r => setTimeout(r, waitMs));

        } else if (actionCmd.action === 'navigate') {
            log('INFO', `🧭 Navigating to: ${actionCmd.url}`);
            await chrome.tabs.update(tabId, { url: actionCmd.url });
            await waitForTabLoad(tabId, 30000).catch(() => {});
            await new Promise(r => setTimeout(r, 3000));
            await ensureContentScript(tabId);

        } else {
            log('WARN', `Unknown action: ${actionCmd.action}`);
        }
    }

    if (!isComplete) {
        log('WARN', `Verification did not complete in ${maxAttempts} steps for coupon ${task.code}`);
        await reportResultToBackend(task.id, 'invalid', `Verification timed out after ${maxAttempts} steps.`);
    }

    // Close the window
    if (windowInfo?.id) {
        try { chrome.windows.remove(windowInfo.id); } catch(e) {}
    }
}

// ─── Build Gemini Prompt ─────────────────────────────────────
function buildPrompt(task, domState, extraContext) {
    return `You are an autonomous web testing agent verifying a coupon on a merchant website.

TASK: Navigate the site, add items to cart if needed, go to checkout, and apply the coupon code to check if it's valid.

Coupon Code: ${task.code}
Brand: ${task.brand || 'Unknown'}
Conditions: ${task.conditions}

Current Page URL: ${domState.url}
Current Page Title: ${domState.title}
${extraContext ? `\nSPECIAL INSTRUCTION: ${extraContext}\n` : ''}
Actionable Elements on this page (${domState.actionableElements.length} items):
${JSON.stringify(domState.actionableElements.slice(0, 80), null, 2)}

Based on the current page state, determine the SINGLE next action to take.
Respond with ONLY a valid JSON object (no markdown, no explanation, no wrapping) using one of these schemas:

Click an element:
{"action":"click","selector":"<css_selector>"}

Type text into an input:
{"action":"type","selector":"<css_selector>","value":"<text>"}

Navigate to a URL:
{"action":"navigate","url":"<full_url>"}

Wait for page updates:
{"action":"wait","ms":3000}

Request OTP from user:
{"action":"request_otp","message":"<explanation>"}

Final evaluation (ONLY when you can see the result of applying the coupon):
{"action":"evaluate","status":"valid"|"invalid"|"expired","reason":"<explanation>"}

IMPORTANT RULES:
- Output ONLY raw JSON. No markdown code blocks.  No extra text.
- Use specific selectors. Prefer IDs (#checkout-btn) over classes.
- If you see the coupon was already applied or rejected, evaluate immediately.
- If the page shows a discount after applying the code, the coupon is "valid".
- If the page says the coupon is expired/invalid/not applicable, evaluate as "invalid" or "expired".
- If you cannot find relevant elements to proceed, evaluate as "invalid" with reason.`;
}

// ─── Execute action via content script ───────────────────────
function executeActionOnTab(tabId, actionCmd) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_ACTION', action: actionCmd }, (response) => {
            if (chrome.runtime.lastError) {
                resolve({ status: 'error', message: chrome.runtime.lastError.message });
            } else {
                resolve(response || { status: 'error', message: 'No response' });
            }
        });
    });
}

// ─── Parse Gemini JSON (handles markdown wrapping) ───────────
function parseGeminiJSON(rawText) {
    let cleaned = rawText.trim();

    // Strip markdown code block wrappers if present
    // e.g. ```json\n{...}\n``` or ```\n{...}\n```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
    }

    // Also strip any leading/trailing non-JSON text
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    return JSON.parse(cleaned);
}

// ═══════════════════════════════════════════════════════════════
// GEMINI API CALL WITH KEY ROTATION
// ═══════════════════════════════════════════════════════════════
async function callGemini(promptText) {
    const keys = GEMINI_API_KEYS;
    if (!keys || keys.length === 0) {
        log('ERROR', 'No Gemini API keys configured!');
        return null;
    }

    // Try each key starting from the current index
    for (let i = 0; i < keys.length; i++) {
        const keyIdx = (geminiKeyIndex + i) % keys.length;
        const apiKey = keys[keyIdx];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
                temperature: 0.1,
            }
        };

        try {
            log('INFO', `Calling Gemini (key #${keyIdx + 1}/${keys.length})...`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429 || response.status === 403) {
                log('WARN', `Key #${keyIdx + 1} rate-limited/blocked (${response.status}). Trying next key...`);
                geminiKeyIndex = (keyIdx + 1) % keys.length; // rotate to next
                continue;
            }

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                log('ERROR', `Gemini API error ${response.status}:`, errText.substring(0, 200));
                geminiKeyIndex = (keyIdx + 1) % keys.length;
                continue;
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textResponse) {
                log('WARN', 'Gemini returned empty text in response:', JSON.stringify(data).substring(0, 200));
                continue;
            }

            // Success — keep using this key
            geminiKeyIndex = keyIdx;
            log('INFO', `Gemini response (${textResponse.length} chars): ${textResponse.substring(0, 120)}...`);
            return textResponse;

        } catch (err) {
            log('ERROR', `Network error calling Gemini with key #${keyIdx + 1}:`, err.message);
            geminiKeyIndex = (keyIdx + 1) % keys.length;
            continue;
        }
    }

    log('ERROR', 'All Gemini API keys exhausted. No valid response.');
    return null;
}

// ─── Report result to backend ────────────────────────────────
async function reportResultToBackend(taskId, status, reason) {
    log('INFO', `📊 Reporting result: task=${taskId}, status=${status}, reason=${reason}`);
    try {
        await fetch(`${BACKEND_URL}/agent/tasks/${taskId}/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, reason })
        });
        log('INFO', '📊 Result reported to backend successfully.');
    } catch (err) {
        log('ERROR', 'Failed to report result:', err);
    }
}

// ─── Cookie capture & sync ───────────────────────────────────
async function captureAndSyncCookies(domain, merchantName) {
    try {
        const cleanDomain = domain.replace(/^www\./, '');
        const cookies = await chrome.cookies.getAll({ domain: cleanDomain });

        if (!cookies || cookies.length === 0) {
            log('WARN', `No cookies found for domain: ${cleanDomain}`);
            return { synced: false, reason: 'no_cookies' };
        }

        log('INFO', `Captured ${cookies.length} cookies for ${cleanDomain}`);

        const payload = {
            providerName: merchantName,
            merchantUrl: `https://${domain}/`,
            cookiesCount: cookies.length,
            cookies,
            syncedAt: new Date().toISOString()
        };

        const res = await fetch(`${BACKEND_URL}/merchant-cookies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            log('ERROR', 'Backend rejected cookie sync:', errBody);
            return { synced: false, reason: 'backend_error', detail: errBody };
        }

        const data = await res.json();
        log('INFO', `Cookie sync done: ${cookies.length} cookies stored for ${merchantName}`);
        return { synced: true, id: data.data?.id, cookiesCount: cookies.length };
    } catch (err) {
        log('ERROR', 'captureAndSyncCookies error:', err);
        return { synced: false, reason: 'exception', detail: err.message };
    }
}
