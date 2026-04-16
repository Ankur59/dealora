// background.js - Dealora AI Verification Agent
import { CONFIG } from './config.js';

// Configuration via config.js
const { GEMINI_API_KEY, MODEL_NAME, BACKEND_URL } = CONFIG;

// State
let isRunning = false;
let currentTasks = [];
let merchantStatuses = {}; // e.g., { 'amazon.in': { isLoggedIn: true, cookies: [...] } }

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Dealora AI Agent] Installed.');
    chrome.storage.local.set({ isRunning: false, currentTasks: [], merchantStatuses: {} });
});

// Listener for messages from popup
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
        merchantStatuses[request.domain] = { isLoggedIn: true, lastChecked: Date.now() };
        chrome.storage.local.set({ merchantStatuses });
        sendResponse({ status: 'updated' });
    } else if (request.type === 'SUBMIT_OTP') {
        const { taskId, otp } = request;
        const task = currentTasks.find(t => t.id === taskId);
        if (task && task.status === 'waiting_for_otp') {
            task.providedOtp = otp;
            task.status = 'running';
            chrome.storage.local.set({ currentTasks });
            // Signal the paused loop to resume
            if (task._resumeResolver) {
                task._resumeResolver();
            }
        }
        sendResponse({ status: 'resumed' });
    }
    return true;
});

// Periodic check for new tasks and execution
async function startAgentLoop() {
    console.log('[Dealora AI Agent] Agent loop started.');
    
    // Create an alarm to periodically check for new coupons to verify
    chrome.alarms.create('agentLoop', { periodInMinutes: 1 });
    
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'agentLoop' && isRunning) {
            // Check if we have capacity (max 5 parallel tabs)
            if (currentTasks.length < 5) {
                await fetchAndQueueTasks();
            }
        }
    });
}

// Fetch tasks from backend
async function fetchAndQueueTasks() {
    try {
        // ai-coupon-engine endpoint: GET /api/v1/agent/pending-tasks
        const res = await fetch(`${BACKEND_URL}/agent/pending-tasks`);
        if (!res.ok) return;
        
        const data = await res.json();
        const newTasks = data.coupons || []; // Array of { id, url, code, conditions }
        
        for (let task of newTasks) {
            if (currentTasks.length >= 5) break;
            
            const domain = new URL(task.url).hostname;
            
            // Check if we are logged in
            if (!merchantStatuses[domain] || !merchantStatuses[domain].isLoggedIn) {
                console.warn(`[Dealora AI Agent] Requires manual login for ${domain}. Skipping task ${task.id}.`);
                continue; // Skip this task until user logs in manually
            }
            
            // Start verification in an inactive/minimized window
            task.status = 'running';
            task.message = 'Initializing...';
            currentTasks.push(task);
            chrome.storage.local.set({ currentTasks });
            
            // Fire off the asynchronous verification flow
            verifyCoupon(task).catch(err => {
                console.error(`[Dealora AI Agent] Verification failed for task ${task.id}:`, err);
            }).finally(() => {
                // Remove task from queue
                currentTasks = currentTasks.filter(t => t.id !== task.id);
                chrome.storage.local.set({ currentTasks });
            });
            
            // Add a random delay between 1-10 minutes (60000 - 600000 ms) to avoid bot detection
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 540000) + 60000));
        }
    } catch (err) {
        console.error('[Dealora AI Agent] Error fetching tasks:', err);
    }
}

// The core AI loop
async function verifyCoupon(task) {
    console.log(`[Dealora AI Agent] Starting verification for coupon ${task.code} on ${task.url}`);
    
    // Open a minimized window to not disrupt the user
    const windowInfo = await chrome.windows.create({ 
        url: task.url, 
        state: 'minimized' 
    });
    
    const tabId = windowInfo.tabs[0].id;
    
    // Wait for the page to load
    await new Promise(r => setTimeout(r, 5000));
    
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 15;
    
    // We'll keep a running conversation context if we have one
    let extraContext = '';
    
    while (!isComplete && attempts < maxAttempts) {
        attempts++;
        
        // Wait if the task is paused for OTP
        while (task.status === 'waiting_for_otp') {
            await new Promise(r => {
                task._resumeResolver = r;
            });
            // Loop resumes after SUBMIT_OTP sets task.status = 'running' and calls resolver
        }
        
        // If user provided OTP, add it to extraContext for the next prompt
        if (task.providedOtp) {
            extraContext = `The user just provided this OTP code: "${task.providedOtp}". Find the OTP input field, type it, and submit.`;
            task.providedOtp = null; // Clear so we don't send it repeatedly
        }
        
        // 1. Get simplified DOM from content script
        const domResponse = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: 'GET_DOM' }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ status: 'error', message: chrome.runtime.lastError.message });
                } else {
                    resolve(response);
                }
            });
        });
        
        if (domResponse.status !== 'success') {
            console.error('[Dealora AI Agent] Failed to get DOM:', domResponse.message);
            break; // Try again or abort
        }
        
        const domState = domResponse.domState;
        
        // 2. Ask Gemini what to do next
        const prompt = `
            You are an autonomous web testing agent verifying a coupon on a merchant site.
            Task: Add items to the cart matching the conditions, go to checkout, and apply the coupon code to check if it's valid.
            Coupon Code: ${task.code}
            Conditions: ${task.conditions}
            
            Current Page URL: ${domState.url}
            Current Page Title: ${domState.title}
            ${extraContext ? `\nSPECIAL INSTRUCTION FROM USER: ${extraContext}\n` : ''}
            Actionable Elements:
            ${JSON.stringify(domState.actionableElements, null, 2)}
            
            Determine the next action to take. Respond ONLY with a valid JSON object matching this schema:
            - { "action": "click", "selector": "<css_selector>" }
            - { "action": "type", "selector": "<css_selector>", "value": "<text_to_type>" }
            - { "action": "wait", "ms": 2000 }
            - { "action": "request_otp", "message": "Email verification needed. Enter OTP." }
            - { "action": "evaluate", "status": "valid" | "invalid" | "expired", "reason": "<explanation>" }
            
            DO NOT wrap the response in markdown blocks (like \`\`\`json). Output raw JSON.
        `;
        
        // Clear extraContext after one use
        extraContext = '';
        
        const aiResponse = await callGemini(prompt);
        if (!aiResponse) break;
        
        try {
            const actionCmd = JSON.parse(aiResponse);
            console.log(`[Dealora AI Agent] Gemini decided:`, actionCmd);
            
            // 3. Execute the action or finalize
            task.message = `Executing: ${actionCmd.action}`;
            chrome.storage.local.set({ currentTasks });

            if (actionCmd.action === 'evaluate') {
                isComplete = true;
                await reportResultToBackend(task.id, actionCmd.status, actionCmd.reason);
                break;
            } else if (actionCmd.action === 'request_otp') {
                console.log(`[Dealora AI Agent] Task ${task.id} needs OTP: ${actionCmd.message}`);
                task.status = 'waiting_for_otp';
                task.message = actionCmd.message || "OTP required to proceed.";
                chrome.storage.local.set({ currentTasks });
                // Do not wait, just loop around. The while loop at the top will pause execution.
            } else {
                // Send action to content script
                await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_ACTION', action: actionCmd }, (response) => {
                        resolve(response);
                    });
                });
                
                // Wait for any potential navigation/UI updates
                await new Promise(r => setTimeout(r, 4000));
            }
        } catch (e) {
            console.error('[Dealora AI Agent] Failed to parse or execute Gemini response:', aiResponse, e);
        }
    }
    
    // Close the window when done
    if (windowInfo && windowInfo.id) {
        chrome.windows.remove(windowInfo.id);
    }
}

async function callGemini(promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
        contents: [{
            parts: [{ text: promptText }]
        }],
        generationConfig: {
            temperature: 0.1, // Low temperature for consistent JSON output
        }
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            console.error(`[Dealora AI Agent] Gemini API Error: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return textResponse;
    } catch (err) {
        console.error('[Dealora AI Agent] Error calling Gemini:', err);
        return null;
    }
}

async function reportResultToBackend(taskId, status, reason) {
    console.log(`[Dealora AI Agent] Task ${taskId} finished. Status: ${status}, Reason: ${reason}`);
    try {
        // ai-coupon-engine endpoint: POST /api/v1/agent/tasks/:taskId/result
        await fetch(`${BACKEND_URL}/agent/tasks/${taskId}/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, reason })
        });
    } catch (err) {
        console.error('[Dealora AI Agent] Error reporting result:', err);
    }
}
