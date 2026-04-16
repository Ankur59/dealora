// content.js
// Injected into all pages to interact with the DOM and report back to the background worker.

console.log('[Dealora AI Agent] Content script loaded on', window.location.href);

// Helper to wait
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to simplify the DOM into a token-efficient format for Gemini
function getSimplifiedDOM() {
    const clone = document.body.cloneNode(true);
    
    // Remove unwanted elements
    const removeSelectors = ['script', 'style', 'noscript', 'iframe', 'svg', 'path', 'meta', 'link'];
    removeSelectors.forEach(selector => {
        clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // We want to create a structured list of actionable items (buttons, inputs, links)
    // and visible text context, preserving basic hierarchy if possible.
    const interactables = [];
    const elements = clone.querySelectorAll('button, a, input, select, textarea, [role="button"]');
    
    elements.forEach((el, index) => {
        // Assign a unique attribute for our own tracking in case CSS selectors are complex
        const uniqueId = `dl-ai-${index}`;
        // we can't easily modify the original DOM from the clone and map it back 
        // without finding the original element.
    });

    // An alternative approach: just get the visible text and input elements of the actual document.
    const actionableElements = [];
    document.querySelectorAll('a, button, input, select, textarea, [role="button"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || el.style.display === 'none' || el.style.visibility === 'hidden') {
            return;
        }
        
        // Build a unique CSS selector for the AI
        let selector = el.tagName.toLowerCase();
        if (el.id) {
            selector += `#${el.id}`;
        } else if (el.className && typeof el.className === 'string') {
            selector += `.${el.className.split(' ').join('.')}`;
        } else if (el.name) {
            selector += `[name="${el.name}"]`;
        } else if (el.type) {
            selector += `[type="${el.type}"]`;
        }

        let text = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '';
        text = text.replace(/\s+/g, ' ').trim();
        
        if (text || el.tagName.toLowerCase() === 'input') {
            actionableElements.push({
                tag: el.tagName.toLowerCase(),
                type: el.type || undefined,
                text: text.substring(0, 100),
                selector: selector
            });
        }
    });

    return {
        url: window.location.href,
        title: document.title,
        actionableElements: actionableElements.slice(0, 150) // limit to avoid token bloat
    };
}

// Simulated Human typing
async function typeText(element, text) {
    element.focus();
    element.value = ''; // Clear existing
    for (let char of text) {
        element.value += char;
        // Dispatch input event so JS frameworks (React/Vue) register the change
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(Math.random() * 50 + 50); // 50-100ms per char
    }
}

// Simulated Human click
async function clickElement(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(300);
    
    ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(eventType => {
        const event = new MouseEvent(eventType, {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        });
        element.dispatchEvent(event);
    });
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
                    const el = document.querySelector(action.selector);
                    if (!el) throw new Error(`Element not found: ${action.selector}`);
                    await clickElement(el);
                    sendResponse({ status: 'success', message: `Clicked ${action.selector}` });
                } 
                else if (action.action === 'type') {
                    const el = document.querySelector(action.selector);
                    if (!el) throw new Error(`Element not found: ${action.selector}`);
                    await typeText(el, action.value);
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
