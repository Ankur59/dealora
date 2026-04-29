import { chromium } from 'playwright';
import Merchant from '../models/merchant.model.js';
import { io } from '../index.js';
import { getStealthScript } from '../utils/stealth.js';
import proxyManager from './proxyManager.service.js';

/**
 * Modern Chrome user-agents to rotate through (keeps TLS/UA fingerprint consistent).
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

export class BrowserService {
  constructor() {
    this.browser = null;
    /** Separate browser instance used when routing through scrape.do proxy */
    this.proxyBrowser = null;
    /** @type {Map<string, import('playwright').BrowserContext>} */
    this.contexts = new Map();
    /** Tracks which merchantIds are currently using proxy contexts */
    this._proxyContexts = new Set();
    this._uaIdx = Math.floor(Math.random() * USER_AGENTS.length);
  }

  /** Pick a random modern user-agent */
  _nextUA() {
    return USER_AGENTS[this._uaIdx++ % USER_AGENTS.length];
  }

  /** Common Chromium flags for anti-detection */
  static get _commonArgs() {
    return [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-component-update',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--lang=en-US',
    ];
  }

  async launchBrowser() {
    if (!this.browser) {
      // Try system Chrome first (real TLS fingerprint = much harder to detect)
      try {
        this.browser = await chromium.launch({
          channel: 'chrome',
          headless: false,
          args: BrowserService._commonArgs,
          ignoreDefaultArgs: ['--enable-automation'],
        });
        console.log('[Browser] ✅ Launched with system Chrome (best anti-detection).');
      } catch (_err) {
        // Fallback to bundled Chromium
        console.warn('[Browser] ⚠️  System Chrome not found, using bundled Chromium.');
        this.browser = await chromium.launch({
          headless: process.env.NODE_ENV === 'production',
          args: BrowserService._commonArgs,
          ignoreDefaultArgs: ['--enable-automation'],
        });
        console.log('[Browser] ✅ Launched with bundled Chromium (fallback).');
      }
    }
    return this.browser;
  }

  /**
   * Launch a separate browser instance that routes ALL traffic through scrape.do proxy.
   * Used only when direct access is blocked for a domain.
   */
  async launchProxyBrowser() {
    if (!this.proxyBrowser) {
      const proxyConfig = proxyManager.getProxyConfigForced();
      try {
        this.proxyBrowser = await chromium.launch({
          channel: 'chrome',
          headless: false,
          args: BrowserService._commonArgs,
          ignoreDefaultArgs: ['--enable-automation'],
          proxy: proxyConfig,
        });
        console.log('[Browser] 🌐 Launched proxy browser via scrape.do.');
      } catch (_err) {
        this.proxyBrowser = await chromium.launch({
          headless: process.env.NODE_ENV === 'production',
          args: BrowserService._commonArgs,
          ignoreDefaultArgs: ['--enable-automation'],
          proxy: proxyConfig,
        });
        console.log('[Browser] 🌐 Launched proxy browser (bundled Chromium) via scrape.do.');
      }
    }
    return this.proxyBrowser;
  }

  async getPageWithSession(merchantId, { forceProxy = false } = {}) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    // Determine if proxy is needed for this merchant's domain
    const targetUrl = merchant.website || merchant.merchantUrl || merchant.domain || '';
    const needsProxy = forceProxy || proxyManager.shouldUseProxy(targetUrl);

    const browser = needsProxy
      ? await this.launchProxyBrowser()
      : await this.launchBrowser();

    // Reuse existing context if one is alive
    let context = this.contexts.get(merchantId);
    if (!context) {
      const ua = this._nextUA();
      const isWindows = ua.includes('Windows');

      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        screen: { width: 1920, height: 1080 },
        userAgent: ua,
        locale: 'en-US',
        timezoneId: 'Asia/Kolkata',
        colorScheme: 'light',
        javaScriptEnabled: true,
        bypassCSP: false,
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-CH-UA': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-CH-UA-Mobile': '?0',
          'Sec-CH-UA-Platform': isWindows ? '"Windows"' : '"macOS"',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      // ── Stealth: inject patches BEFORE any page scripts run ──────────
      await context.addInitScript({ content: getStealthScript() });

      // Restore previously saved cookies if available
      if (Array.isArray(merchant.cookies) && merchant.cookies.length > 0) {
        try {
          await context.addCookies(merchant.cookies);
          await this.emitLog(merchantId, `♻️ Restored ${merchant.cookies.length} saved cookies for quick access.`, 'info');
        } catch (err) {
          await this.emitLog(merchantId, `⚠️ Could not restore cookies: ${err.message}`, 'warning');
        }
      }

      this.contexts.set(merchantId, context);

      // Track if this is a proxy context
      if (needsProxy) {
        this._proxyContexts.add(merchantId);
        await this.emitLog(merchantId, `🌐 Session created via scrape.do proxy (domain was blocked).`, 'warning');
      } else {
        this._proxyContexts.delete(merchantId);
      }
    }

    const page = await context.newPage();
    return { browser, context, page, merchant, usingProxy: needsProxy };
  }

  /**
   * Close and destroy a context so the next getPageWithSession() creates a fresh
   * one with a different fingerprint. Used for retry-after-block flows.
   */
  async recreateContext(merchantId) {
    await this.closeSession(merchantId);
    // Brief pause so the site doesn't see an instant reconnect
    await BrowserService.randomDelay(2000, 5000);
  }

  /**
   * Destroy current context and recreate it with proxy enabled.
   * Called when block is detected mid-session.
   */
  async recreateContextWithProxy(merchantId) {
    const merchant = await Merchant.findById(merchantId);
    const targetUrl = merchant?.website || merchant?.merchantUrl || merchant?.domain || '';

    // Mark domain as blocked so future sessions auto-use proxy
    if (targetUrl) proxyManager.markBlocked(targetUrl);

    await this.closeSession(merchantId);
    await BrowserService.randomDelay(2000, 4000);

    // Get fresh session with proxy
    return await this.getPageWithSession(merchantId, { forceProxy: true });
  }

  /**
   * Check current page for block signals and handle proxy escalation.
   * Returns { blocked, escalated, page?, context? }
   */
  async checkAndHandleBlock(merchantId, page) {
    const detection = await proxyManager.detectBlock(page);
    if (!detection.blocked) {
      return { blocked: false, escalated: false };
    }

    await this.emitLog(merchantId, `🚫 Block detected: ${detection.reason}. Escalating to proxy…`, 'warning');

    // Already on proxy? Can't escalate further
    if (this._proxyContexts.has(merchantId)) {
      await this.emitLog(merchantId, `⚠️ Already using proxy but still blocked. Cannot escalate further.`, 'error');
      return { blocked: true, escalated: false };
    }

    // Escalate to proxy
    const fresh = await this.recreateContextWithProxy(merchantId);
    return { blocked: true, escalated: true, ...fresh };
  }

  /**
   * Snapshot and persist cookies from the given context to MongoDB.
   * Validates cookies, strips expired ones, handles all edge cases.
   * Also updates `lastLoginAttempt.lastAttempted` timestamp.
   */
  async saveSession(merchantId, context) {
    try {
      if (!context) {
        console.warn(`[${merchantId}] saveSession called with no context. Skipping.`);
        return;
      }

      let cookies;
      try {
        cookies = await context.cookies();
      } catch (err) {
        // Context might be closing/closed
        console.warn(`[${merchantId}] Could not extract cookies: ${err.message}`);
        return;
      }

      if (!Array.isArray(cookies) || cookies.length === 0) {
        console.log(`[${merchantId}] No cookies to save.`);
        return;
      }

      // Filter out expired cookies
      const now = Date.now() / 1000; // cookies use epoch seconds
      const validCookies = cookies.filter(c => {
        // Keep session cookies (no expires) and non-expired cookies
        if (!c.expires || c.expires === -1) return true;
        return c.expires > now;
      });

      // Validate each cookie has required fields
      const cleanCookies = validCookies.filter(c =>
        c && typeof c.name === 'string' && c.name.length > 0 &&
        typeof c.value === 'string'
      );

      if (cleanCookies.length === 0) {
        console.log(`[${merchantId}] All cookies expired or invalid. Not overwriting DB.`);
        return;
      }

      await Merchant.findByIdAndUpdate(merchantId, {
        cookies: cleanCookies,
        'lastLoginAttempt.lastAttempted': new Date(),
      });
      console.log(`[${merchantId}] Saved ${cleanCookies.length} cookies to DB (${cookies.length - cleanCookies.length} expired/invalid dropped).`);
    } catch (err) {
      console.error(`[${merchantId}] saveSession error: ${err.message}`);
      // Non-fatal: don't throw
    }
  }

  /**
   * Import cookies from external source (manual login, browser extension export, etc.)
   * Validates and saves to DB without needing an active browser context.
   */
  async importCookies(merchantId, rawCookies) {
    if (!Array.isArray(rawCookies) || rawCookies.length === 0) {
      throw new Error('No cookies to import');
    }

    // Validate and normalize
    const validCookies = rawCookies.filter(c =>
      c && typeof c.name === 'string' && c.name.length > 0 &&
      typeof c.value === 'string'
    ).map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '',
      path: c.path || '/',
      expires: c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: c.sameSite || 'Lax',
    }));

    if (validCookies.length === 0) {
      throw new Error('No valid cookies found (need name + value)');
    }

    await Merchant.findByIdAndUpdate(merchantId, {
      cookies: validCookies,
      'lastLoginAttempt.status': 'success',
      'lastLoginAttempt.message': `Imported ${validCookies.length} cookies manually`,
      'lastLoginAttempt.lastAttempted': new Date(),
    });

    return validCookies.length;
  }

  async closeSession(merchantId) {
    const context = this.contexts.get(merchantId);
    if (context) {
      // Best-effort final cookie save before closing
      try {
        await this.saveSession(merchantId, context);
      } catch (_) {
        // Non-fatal
      }
      try {
        await context.close();
      } catch (closeErr) {
        console.warn(`[${merchantId}] Context close error: ${closeErr.message}`);
      }
      this.contexts.delete(merchantId);
      this._proxyContexts.delete(merchantId);
    }
  }

  async emitLog(merchantId, message, type = 'info') {
    try {
      io.emit(`log:${merchantId}`, { message, type, timestamp: new Date() });
    } catch (_) {
      // Socket might not be available
    }
    console.log(`[${merchantId}] [${type}] ${message}`);
  }

  async emitNotification(merchantId, type, message, data = {}) {
    const merchant = await Merchant.findById(merchantId);
    const notification = {
      id: Math.random().toString(36).substring(2, 11),
      merchantId,
      merchantName: merchant?.merchantName || 'Unknown Merchant',
      type,
      message,
      timestamp: new Date(),
      data
    };
    io.emit('automation:notification', notification);
    console.log(`[Notification] [${type}] ${merchant?.merchantName}: ${message}`);
  }

  /**
   * Waits for a dashboard user to submit an OTP via the socket event.
   * Resolves with the OTP string, or null on timeout (5 min).
   */
  async waitForOTP(merchantId) {
    this.emitLog(merchantId, '🔒 Waiting for OTP input from dashboard…', 'warning');
    await Merchant.findByIdAndUpdate(merchantId, {
      'lastLoginAttempt.status': 'pending_otp',
    });

    return new Promise((resolve) => {
      let resolved = false;
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        io.off('otp_provided', onOTP);
      };

      const onOTP = (data) => {
        if (data.merchantId === merchantId.toString()) {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(data.otp);
          }
        }
      };

      io.on('otp_provided', onOTP);

      // Timeout after 5 minutes
      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      }, 300_000);
    });
  }

  /**
   * Derives a stable CSS selector for a DOM element found via coordinates.
   */
  async getUniqueSelector(page, element) {
    return await page.evaluate((el) => {
      if (el.id) return `#${el.id}`;
      if (el.getAttribute('name')) return `[name="${el.getAttribute('name')}"]`;
      if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;

      // Build a short CSS path (max 4 levels)
      const path = [];
      let current = el;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();
        if (current.id) {
          selector = `#${current.id}`;
          path.unshift(selector);
          break;
        }
        if (current.className) {
          const classes = Array.from(current.classList)
            .filter((c) => !/[0-9]/.test(c)) // skip purely numeric class names
            .slice(0, 2)
            .join('.');
          if (classes) selector += `.${classes}`;
        }
        path.unshift(selector);
        current = current.parentNode;
        if (path.length > 4) break;
      }
      return path.join(' > ');
    }, element);
  }

  // ─── Static helpers ──────────────────────────────────────────────────

  /** Random delay between min and max ms */
  static randomDelay(min = 500, max = 2000) {
    return new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));
  }

  /** Simulate human-like mouse movement to target coordinates */
  static async humanMove(page, targetX, targetY) {
    const steps = 5 + Math.floor(Math.random() * 10);
    let curX = 200 + Math.random() * 400;
    let curY = 150 + Math.random() * 200;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      curX += (targetX - curX) * t + (Math.random() - 0.5) * 4;
      curY += (targetY - curY) * t + (Math.random() - 0.5) * 4;
      await page.mouse.move(curX, curY);
      await new Promise(r => setTimeout(r, 10 + Math.random() * 30));
    }
  }

  /**
   * Perform some initial human-like interactions on a freshly loaded page
   * to look less like a bot (scroll, move mouse around).
   */
  static async warmUpPage(page) {
    await BrowserService.randomDelay(500, 1500);
    await BrowserService.humanMove(page, 640, 360);
    await page.mouse.wheel(0, 50 + Math.random() * 100);
    await BrowserService.randomDelay(400, 1000);
  }
}

export default new BrowserService();
