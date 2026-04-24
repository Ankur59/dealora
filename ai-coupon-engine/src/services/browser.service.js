import { chromium } from 'playwright';
import Merchant from '../models/merchant.model.js';
import { io } from '../index.js';

export class BrowserService {
  constructor() {
    this.browser = null;
    /** @type {Map<string, import('playwright').BrowserContext>} */
    this.contexts = new Map();
  }

  async launchBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: process.env.NODE_ENV === 'production',
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
      });
    }
    return this.browser;
  }

  async getPageWithSession(merchantId) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const browser = await this.launchBrowser();

    // Reuse existing context if one is alive
    let context = this.contexts.get(merchantId);
    if (!context) {
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

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
    }

    const page = await context.newPage();
    return { browser, context, page, merchant };
  }

  /**
   * Snapshot and persist cookies from the given context to MongoDB.
   * Also updates `lastLoginAttempt.lastAttempted` timestamp.
   */
  async saveSession(merchantId, context) {
    const cookies = await context.cookies();
    await Merchant.findByIdAndUpdate(merchantId, {
      cookies,
      'lastLoginAttempt.lastAttempted': new Date(),
    });
    console.log(`[${merchantId}] Saved ${cookies.length} cookies to DB.`);
  }

  async closeSession(merchantId) {
    const context = this.contexts.get(merchantId);
    if (context) {
      await context.close();
      this.contexts.delete(merchantId);
    }
  }

  async emitLog(merchantId, message, type = 'info') {
    io.emit(`log:${merchantId}`, { message, type, timestamp: new Date() });
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
      const onOTP = (data) => {
        if (data.merchantId === merchantId.toString()) {
          io.off('otp_provided', onOTP);
          resolve(data.otp);
        }
      };
      io.on('otp_provided', onOTP);

      // Timeout after 5 minutes
      setTimeout(() => {
        io.off('otp_provided', onOTP);
        resolve(null);
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
}

export default new BrowserService();
