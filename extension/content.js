// content.js - Dealora AI Agent Content Script
// Handles page interaction, human simulation, stealth injections, and block detection.

let recentTransients = [];
let monitorTimer = null;

// ─── Stealth Injection ───────────────────────────────────────
// Inject stealth overrides directly into page context before page scripts execute
function injectStealth() {
    try {
        const script = document.createElement('script');
        script.textContent = `
            // Spoof webdriver flag
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

            // Spoof languages
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

            // Spoof plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbgoajklhpcolncoffebolkeysbij' },
                    { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' }
                ]
            });

            // Spoof WebGL fingerprint vendor
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                // UNMASKED_VENDOR_WEBGL
                if (parameter === 37445) return 'Intel Open Source Technology Center';
                // UNMASKED_RENDERER_WEBGL
                if (parameter === 37446) return 'Mesa DRI Intel(R) HD Graphics 6000 (Broadwell GT3)';
                return getParameter.apply(this, arguments);
            };

            // Spoof chrome object
            window.chrome = {
                runtime: {},
                loadTimes: () => {},
                csi: () => {}
            };
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch (e) {
        console.error('[Dealora Stealth] Injection failed:', e);
    }
}
injectStealth();

// ─── Block & CAPTCHA Detection ──────────────────────────────
function checkBlockSignals() {
    const title = (document.title || '').toLowerCase();
    const bodyText = (document.body?.innerText || '').toLowerCase();

    // Check Cloudflare
    if (title.includes('just a moment') || bodyText.includes('checking your browser') || bodyText.includes('cloudflare')) {
        return { blocked: true, type: 'cloudflare' };
    }

    // Check CAPTCHA / Bot detection
    if (bodyText.includes('recaptcha') || bodyText.includes('hcaptcha') || bodyText.includes('please confirm you are a human') || bodyText.includes('robot')) {
        return { blocked: true, type: 'captcha' };
    }

    // Check HTTP blocks
    if (title.includes('403 forbidden') || title.includes('access denied') || bodyText.includes('access denied') || bodyText.includes('blocked your ip')) {
        return { blocked: true, type: 'ip_block' };
    }

    return { blocked: false };
}

// ─── Status Message Monitoring ──────────────────────────────
function startStatusMonitoring(durationMs = 5000) {
    if (monitorTimer) clearTimeout(monitorTimer);
    const endTime = Date.now() + durationMs;
    recentTransients = [];

    const keywords = ['saved', 'discount', 'coupon', 'invalid', 'expired', 'claimed', 'applied', 'code', 'off', 'limit', 'success', 'error'];

    const poll = () => {
        if (Date.now() > endTime) return;

        document.querySelectorAll('div, span, p, h1, h2, h3, h4, li, .toast, .alert, .modal').forEach(el => {
            if (el.children.length > 5) return;
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
    // Clear old IDs
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

        const isClickable = el.tagName === 'A' || el.tagName === 'BUTTON' || style.cursor === 'pointer' || el.getAttribute('role') === 'button';

        if (!isClickable && el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA') return;

        const dlId = `dl-${index}`;
        el.setAttribute('data-dl-id', dlId);

        // Build backup selector
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
            selector: `[data-dl-id="${dlId}"]`,
            backupSelector: backupSelector
        });
    });

    const statusMessages = [...recentTransients];
    const keywords = ['saved', 'discount', 'coupon', 'invalid', 'expired', 'claimed', 'success', 'error', 'applied', 'code'];

    document.querySelectorAll('div, span, p, h1, h2, h3, h4, li').forEach(el => {
        if (el.children.length > 0) return;
        const text = (el.innerText || '').trim();
        if (text.length > 5 && text.length < 200) {
            const lowerText = text.toLowerCase();
            if (keywords.some(kw => lowerText.includes(kw))) {
                if (!statusMessages.includes(text)) statusMessages.push(text);
            }
        }
    });

    recentTransients = [];

    const blockCheck = checkBlockSignals();

    return {
        url: window.location.href,
        title: document.title,
        actionableElements: actionableElements.slice(0, 250),
        statusMessages: statusMessages.slice(0, 15),
        blockStatus: blockCheck
    };
}

// Simulated Human Typing
async function typeText(element, text) {
    element.focus();
    element.value = '';
    for (let char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        // Random human typing speed
        await new Promise(r => setTimeout(r, Math.random() * 80 + 40));
    }
}

// Simulated Human Clicking
async function clickElement(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Random human wait before click
    await new Promise(r => setTimeout(r, Math.random() * 200 + 150));

    const eventOptions = { view: window, bubbles: true, cancelable: true, buttons: 1 };
    element.focus();
    element.dispatchEvent(new PointerEvent('pointerover', eventOptions));
    element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
    element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
    element.dispatchEvent(new PointerEvent('pointerup', eventOptions));
    element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
    element.dispatchEvent(new MouseEvent('click', eventOptions));
}

function findElement(selector) {
    if (!selector) return null;

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

// Messaging Listeners
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
                    startStatusMonitoring(5000);
                    sendResponse({ status: 'success', message: `Clicked ${action.selector}` });
                }
                else if (action.action === 'type') {
                    const el = findElement(action.selector);
                    if (!el) throw new Error(`Element not found: ${action.selector}`);
                    await typeText(el, action.value);
                    startStatusMonitoring(5000);
                    sendResponse({ status: 'success', message: `Typed into ${action.selector}` });
                }
                else if (action.action === 'wait') {
                    await new Promise(r => setTimeout(r, action.ms || 2000));
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
        return true;
    }
});
