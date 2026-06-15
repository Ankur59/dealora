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

const COUPON_INPUT_RE = /coupon|promo|discount|voucher|gift.?card/i;
const ADD_TO_CART_RE = /add\s+to\s+(cart|bag)|buy\s+now|add\s+to\s+basket/i;
const CART_RE = /\bcart\b|bag|basket|view\s+cart|go\s+to\s+cart/i;
const CHECKOUT_RE = /checkout|proceed\s+to\s+(pay|payment)|place\s+order|pay\s+now|secure\s+checkout/i;
const NAV_RE = /login|sign\s*in|sign\s*up|register|search|menu|account|wishlist|footer|privacy|terms/i;

function parsePriceFromText(text) {
    if (!text) return null;
    const m = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i)
        || text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)/i);
    if (!m) return null;
    const val = parseFloat(m[1].replace(/,/g, ''));
    return Number.isFinite(val) ? val : null;
}

function extractNearbyPrice(el) {
    let price = parsePriceFromText(el.innerText || el.textContent || '');
    if (price) return price;
    const card = el.closest('[class*="product"], [class*="card"], article, li, .grid__item');
    if (card) price = parsePriceFromText(card.innerText || '');
    return price;
}

function classifyIntent(el, text, href) {
    const combined = `${text} ${href || ''} ${el.placeholder || ''} ${el.name || ''}`.toLowerCase();

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (COUPON_INPUT_RE.test(combined)) return 'coupon';
    }
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
        if (COUPON_INPUT_RE.test(combined)) return 'coupon';
        if (ADD_TO_CART_RE.test(combined)) return 'addToCart';
        if (CHECKOUT_RE.test(combined)) return 'checkout';
        if (CART_RE.test(combined)) return 'cart';
    }
    if (el.tagName === 'A' && href) {
        if (/\/products\//i.test(href)) return 'product';
        if (/\/cart/i.test(href)) return 'cart';
        if (/\/checkout/i.test(href)) return 'checkout';
        if (CART_RE.test(combined)) return 'cart';
        if (CHECKOUT_RE.test(combined)) return 'checkout';
    }
    if (ADD_TO_CART_RE.test(combined)) return 'addToCart';
    if (NAV_RE.test(combined)) return 'nav';
    return 'other';
}

function detectPageContext(url, actionableElements) {
    const path = (() => {
        try { return new URL(url).pathname.toLowerCase(); } catch { return ''; }
    })();

    let phase = 'other';
    if (/\/checkout/i.test(path)) phase = 'checkout';
    else if (/\/cart/i.test(path)) phase = 'cart';
    else if (/\/products\//i.test(path)) phase = 'product';
    else if (/\/collections\/|\/category\/|\/categories\/|\/search/i.test(path)) phase = 'listing';

    // If checkout button is visible (meaning cart drawer/sidebar is open), treat phase as cart
    const hasCheckoutBtn = actionableElements.some((el) => el.intent === 'checkout');
    if (hasCheckoutBtn && phase !== 'checkout') {
        phase = 'cart';
    }

    const hasCouponInput = actionableElements.some(
        (el) => el.intent === 'coupon' || (el.tag === 'input' && COUPON_INPUT_RE.test(`${el.text} ${el.type || ''}`))
    );
    const productLinkCount = actionableElements.filter((el) => el.intent === 'product').length;
    const hasCartItems = actionableElements.some((el) => {
        const t = (el.text || '').toLowerCase();
        return /subtotal|cart total|item[s]?\s*\(|₹|rs\./i.test(t) && !/empty/i.test(t);
    });

    return { phase, hasCouponInput, hasCartItems, productLinkCount };
}

function scoreElement(el, pageContext, termsSummary) {
    const terms = termsSummary || { minOrderValue: 0, applicableCategories: [], excludedProducts: [] };
    let score = 0;
    const textLower = `${el.text || ''} ${el.href || ''}`.toLowerCase();

    if (pageContext.phase === 'cart' || pageContext.phase === 'checkout') {
        if (el.intent === 'coupon') score += 200;
        if (el.intent === 'checkout') score += 80;
    }

    if (pageContext.phase === 'listing' || pageContext.phase === 'product') {
        if (el.intent === 'product') {
            score += 100;
            if (el.inViewport) score += 50;
            for (const cat of (terms.applicableCategories || [])) {
                if (cat && textLower.includes(String(cat).toLowerCase())) score += 40;
            }
            for (const ex of (terms.excludedProducts || [])) {
                if (ex && textLower.includes(String(ex).toLowerCase())) score -= 80;
            }
            if (terms.minOrderValue && el.price && el.price >= terms.minOrderValue) score += 60;
            else if (terms.minOrderValue && el.price) score -= 20;
        }
        if (el.intent === 'addToCart') score += 150;
        if (el.intent === 'cart') score += 120;
        if (el.intent === 'checkout') score += 100;
    }

    if (el.intent === 'nav') score -= 50;
    if (el.inViewport) score += 10;

    return score;
}

function prioritizeElements(elements, pageContext, termsSummary) {
    return [...elements]
        .map((el) => ({ ...el, _score: scoreElement(el, pageContext, termsSummary) }))
        .sort((a, b) => b._score - a._score)
        .map(({ _score, ...el }) => ({ ...el, relevanceScore: _score }));
}

function getScrollTarget() {
    const docEl = document.documentElement;
    const body = document.body;

    const isScrollable = (el) => el && el.scrollHeight > el.clientHeight + 50;

    if (isScrollable(docEl)) return docEl;
    if (isScrollable(body)) return body;

    const named = document.querySelector('main, #main, #MainContent, [role="main"], .main-content, .page-content');
    if (isScrollable(named)) return named;

    let best = null;
    let bestRange = 0;
    for (const el of document.querySelectorAll('div, section, article')) {
        const style = getComputedStyle(el);
        if (!['auto', 'scroll', 'overlay'].includes(style.overflowY)) continue;
        const range = el.scrollHeight - el.clientHeight;
        if (range > bestRange) {
            bestRange = range;
            best = el;
        }
    }
    return best || docEl;
}

function getSimplifiedDOM(termsSummary = null) {
    // Clear old IDs
    document.querySelectorAll('[data-dl-id]').forEach(el => el.removeAttribute('data-dl-id'));

    const actionableElements = [];
    const elements = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick], summary, details, [class*="accordion"]');

    elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Skip hidden elements, unless it's a coupon input
        const isCouponInput = el.tagName === 'INPUT' && COUPON_INPUT_RE.test(`${el.name || ''} ${el.placeholder || ''}`);
        if (!isCouponInput && (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
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

        const href = el.tagName === 'A' ? (el.getAttribute('href') || '') : undefined;
        const inViewport = rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
        const intent = classifyIntent(el, text, href);
        const price = intent === 'product' ? extractNearbyPrice(el) : null;

        actionableElements.push({
            tag: el.tagName.toLowerCase(),
            type: el.type || undefined,
            text: text.substring(0, 100),
            selector: `[data-dl-id="${dlId}"]`,
            backupSelector: backupSelector,
            href: href || undefined,
            inViewport,
            intent,
            price: price ?? undefined,
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

    const scrollTarget = getScrollTarget();
    const scrollTop = scrollTarget === document.documentElement || scrollTarget === document.body
        ? window.scrollY
        : scrollTarget.scrollTop;
    const scrollHeight = scrollTarget.scrollHeight;
    const clientHeight = scrollTarget.clientHeight;

    const pageContext = detectPageContext(window.location.href, actionableElements);
    const prioritized = prioritizeElements(actionableElements, pageContext, termsSummary);

    return {
        url: window.location.href,
        title: document.title,
        scrollPosition: {
            top: Math.round(scrollTop),
            height: scrollHeight,
            viewport: clientHeight,
            atBottom: scrollTop + clientHeight >= scrollHeight - 50,
        },
        pageContext,
        actionableElements: prioritized.slice(0, 150),
        totalElements: actionableElements.length,
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

function parseWaitMs(action) {
    let ms = action.ms ?? action.value ?? 2000;
    if (typeof ms === 'string') ms = parseInt(ms, 10);
    if (!Number.isFinite(ms) || ms <= 0) return 2000;
    // Gemini often sends seconds (2, 3) instead of milliseconds
    if (ms < 100) return ms * 1000;
    return ms;
}

async function scrollPage(direction = 'down', amount) {
    const scrollAmount = direction === 'down' ? 1 : -1;
    const distance = amount || Math.round(window.innerHeight * 0.85) || 800;
    const delta = scrollAmount * distance;
    const target = getScrollTarget();

    const beforeY = target === document.documentElement || target === document.body
        ? window.scrollY
        : target.scrollTop;

    // Instant scroll on the real scroll container
    if (target === document.documentElement || target === document.body) {
        window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
        let moved = Math.abs(window.scrollY - beforeY);
        if (moved < 20) {
            document.documentElement.scrollTop = beforeY + delta;
            moved = Math.abs(window.scrollY - beforeY);
        }
        if (moved < 20 && document.body) {
            document.body.scrollTop = beforeY + delta;
        }
    } else {
        target.scrollTop += delta;
    }

    // Nudge lazy-load listeners
    window.dispatchEvent(new Event('scroll', { bubbles: true }));
    target.dispatchEvent?.(new WheelEvent('wheel', { deltaY: delta, bubbles: true, cancelable: true }));

    // If nothing moved, try scrolling the last visible product/card into view
    const afterY = target === document.documentElement || target === document.body
        ? window.scrollY
        : target.scrollTop;
    if (Math.abs(afterY - beforeY) < 20) {
        const cards = document.querySelectorAll(
            'a[href*="/products/"], .product-card, .grid__item, [class*="product"], article'
        );
        const visible = Array.from(cards).filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.top < window.innerHeight;
        });
        const last = visible[visible.length - 1];
        if (last) {
            last.scrollIntoView({ behavior: 'auto', block: 'end' });
            await new Promise((r) => setTimeout(r, 800));
        }
    }

    await new Promise((r) => setTimeout(r, 1200));
    return { scrolled: distance, direction, scrollY: window.scrollY };
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
            const domState = getSimplifiedDOM(request.termsSummary || null);
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
                    const waitMs = parseWaitMs(action);
                    await new Promise(r => setTimeout(r, waitMs));
                    sendResponse({ status: 'success', message: `Waited ${waitMs}ms` });
                }
                else if (action.action === 'scroll') {
                    const direction = action.direction || 'down';
                    const amount = action.amount ? Number(action.amount) : undefined;
                    const result = await scrollPage(direction, amount);
                    sendResponse({
                        status: 'success',
                        message: `Scrolled ${direction} ${result.scrolled}px`,
                        scrollY: result.scrollY,
                    });
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
