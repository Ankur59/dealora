import { chromium } from 'playwright';
import Merchant from '../models/merchant.model.js';
import { io } from '../index.js';

export class BrowserService {
  constructor() {
    this.browser = null;
    this.contexts = new Map();
  }

  async launchBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({ 
        headless: process.env.NODE_ENV === 'production',
        args: ['--disable-blink-features=AutomationControlled']
      });
    }
    return this.browser;
  }

  async getPageWithSession(merchantId) {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    const browser = await this.launchBrowser();
    
    // Reuse context if exists
    let context = this.contexts.get(merchantId);
    if (!context) {
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      if (merchant.cookies) {
        await context.addCookies(merchant.cookies);
      }
      this.contexts.set(merchantId, context);
    }

    const page = await context.newPage();
    return { browser, context, page, merchant };
  }

  async saveSession(merchantId, context) {
    const cookies = await context.cookies();
    await Merchant.findByIdAndUpdate(merchantId, { cookies });
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

  async waitForOTP(merchantId) {
    this.emitLog(merchantId, 'Waiting for OTP input from dashboard...', 'warning');
    await Merchant.findByIdAndUpdate(merchantId, { 
      'lastLoginAttempt.status': 'pending_otp' 
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
      }, 300000);
    });
  }

  async getUniqueSelector(page, element) {
    // This helper tries to get a robust selector for an element found by Gemini
    return await page.evaluate((el) => {
      if (el.id) return `#${el.id}`;
      if (el.getAttribute('name')) return `[name="${el.getAttribute('name')}"]`;
      
      // Fallback to a simplified CSS path
      const path = [];
      let current = el;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();
        if (current.className) {
          selector += '.' + Array.from(current.classList).join('.');
        }
        path.unshift(selector);
        current = current.parentNode;
        if (path.length > 3) break; // Don't make it too long
      }
      return path.join(' > ');
    }, element);
  }
}

export default new BrowserService();
