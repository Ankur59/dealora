// content.js
// Injected into all pages to interact with the DOM and report back to the background worker.

console.log('[Dealora AI Agent] Content script loaded on', window.location.href);

// Helper to wait
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to simplify the DOM into a token-efficient format for Gemini
let recentTransients = [];
let monitorTimer = null;

function startStatusMonitoring(duration = 5000) {
    if (monitorTimer) clearTimeout(monitorTimer);
    
    const startTime = Date.now();
    const keywords = ['saved', 'discount', 'coupon', 'invalid', 'expired', 'claimed', 'yay', 'sorry', 'applied', 'code', 'off', 'limit', 'success', 'error'];
    
    const poll = () => {
        const now = Date.now();
        if (now - startTime > duration) return;

        // Look for any new text matching keywords
        document.querySelectorAll('div, span, p, h1, h2, h3, h4, li, .toast, .alert, .modal').forEach(el => {
            if (el.children.length > 5) return; // ignore large containers
            const text = (el.innerText || '').trim();
            if (!text || text.length > 200) return;

            const lowerText = text.toLowerCase();
            if (keywords.some(kw => lowerText.includes(kw))) {
                if (!recentTransients.includes(text)) {
                    recentTransients.push(text);
                }
            }
        });

        monitorTimer = setTimeout(poll, 500);
    };
    poll();
}

function getSimplifiedDOM() {
    // Clear any previous IDs first (to avoid stale ones)
    document.querySelectorAll('[data-dl-id]').forEach(el => el.removeAttribute('data-dl-id'));

    const actionableElements = [];
    const elements = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick]');
    
    elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        // Skip hidden elements
        if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return;
        }

        // Also include things that LOOK like buttons (cursor: pointer)
        const isClickable = el.tagName === 'A' || el.tagName === 'BUTTON' || style.cursor === 'pointer' || el.getAttribute('role') === 'button';
        
        if (!isClickable && el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA') return;
        
        // Assign a unique ID for precise targeting
        const dlId = `dl-${index}`;
        el.setAttribute('data-dl-id', dlId);

        // Build a backup CSS selector
        let backupSelector = el.tagName.toLowerCase();
        if (el.id) {
            backupSelector += `#${CSS.escape(el.id)}`;
        } else if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(/\s+/).filter(c => c && !c.includes(':')).slice(0, 3);
            if (classes.length > 0) backupSelector += `.${classes.map(c => CSS.escape(c)).join('.')}`;
        }

        let text = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.title || '';
        text = text.replace(/\s+/g, ' ').trim();
        
        actionableElements.push({
            tag: el.tagName.toLowerCase(),
            type: el.type || undefined,
            text: text.substring(0, 100),
            selector: `[data-dl-id="${dlId}"]`, // AI should use this
            backupSelector: backupSelector
        });
    });

    // Capture persistent status messages (sidebar/banners)
    const statusMessages = [...recentTransients];
    const keywords = ['saved', 'discount', 'coupon', 'invalid', 'expired', 'claimed', 'yay', 'sorry', 'applied', 'code', 'off', 'limit', 'success', 'error'];
    
    document.querySelectorAll('div, span, p, h1, h2, h3, h4, li').forEach(el => {
        if (el.children.length > 0) return; // leaf nodes only for context
        const text = (el.innerText || '').trim();
        if (text.length > 5 && text.length < 200) {
            const lowerText = text.toLowerCase();
            if (keywords.some(kw => lowerText.includes(kw))) {
                if (!statusMessages.includes(text)) statusMessages.push(text);
            }
        }
    });

    // Reset transients after they've been reported once to avoid stale info later
    recentTransients = [];

    return {
        url: window.location.href,
        title: document.title,
        actionableElements: actionableElements.slice(0, 250),
        statusMessages: statusMessages.slice(0, 15) // Top 15 messages for context
    };
}

// Simulated Human typing
async function typeText(element, text) {
    element.focus();
    element.value = ''; // Clear existing
    for (let char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(Math.random() * 40 + 30); 
    }
}

// Simulated Human click
async function clickElement(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(300);
    
    // Dispatch a comprehensive sequence of events to trigger modern JS listeners
    const eventOptions = { view: window, bubbles: true, cancelable: true, buttons: 1 };
    
    element.focus();
    element.dispatchEvent(new PointerEvent('pointerover', eventOptions));
    element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
    element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
    element.dispatchEvent(new PointerEvent('pointerup', eventOptions));
    element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
    element.dispatchEvent(new MouseEvent('click', eventOptions));
}

// Advanced query selector that handles :contains() and fallback
function findElement(selector) {
    if (!selector) return null;

    // Handle :contains() fallback natively
    if (selector.includes(':contains(')) {
        const match = selector.match(/(.*):contains\(['"](.*)['"]\)/);
        if (match) {
            const [_, baseSelector, text] = match;
            const candidates = document.querySelectorAll(baseSelector || '*');
            return Array.from(candidates).find(el => 
                (el.innerText || el.textContent || '').toLowerCase().includes(text.toLowerCase())
            );
        }
    }

    try {
        return document.querySelector(selector);
    } catch (e) {
        console.error('[Dealora AI Agent] Invalid selector:', selector, e);
        return null;
    }
}

// Message listener from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PING') {
        sendResponse({ status: 'alive' });
        return true;
    }

    if (request.type === 'GET_DOM') {
        try {
            const domState = getSimplifiedDOM();
            sendResponse({ status: 'success', domState });
        } catch (err) {
            sendResponse({ status: 'error', message: err.toString() });
        }
        return true;
    }

    if (request.type === 'EXECUTE_ACTION') {
        (async () => {
            try {
                const { action } = request;
                
                if (action.action === 'click') {
                    const el = findElement(action.selector);
                    if (!el) throw new Error(`Element not found: ${action.selector}`);
                    await clickElement(el);
                    startStatusMonitoring(5000); // Start monitoring for changes
                    sendResponse({ status: 'success', message: `Clicked ${action.selector}` });
                } 
                else if (action.action === 'type') {
                    const el = findElement(action.selector);
                    if (!el) throw new Error(`Element not found: ${action.selector}`);
                    await typeText(el, action.value);
                    startStatusMonitoring(5000); // Start monitoring for changes
                    sendResponse({ status: 'success', message: `Typed into ${action.selector}` });
                }
                else if (action.action === 'wait') {
                    await delay(action.ms || 2000);
                    sendResponse({ status: 'success', message: `Waited ${action.ms}ms` });
                }
                else {
                    sendResponse({ status: 'error', message: `Unknown action: ${action.action}` });
                }
            } catch (err) {
                console.error('[Dealora AI Agent] Action error:', err);
                sendResponse({ status: 'error', message: err.toString() });
            }
        })();
        return true; // Keep channel open for async response
    }
});
