import browserService, { BrowserService } from './browser.service.js';
import geminiService from './gemini.service.js';
import Coupon from '../models/coupon.model.js';
import Merchant from '../models/merchant.model.js';
import CouponVerification from '../models/couponVerification.model.js';
import { getActiveCredentials, executeMacro, runAutomationLoop } from '../controllers/automation.controller.js';

export class CouponVerificationService {
  /**
   * Main entry point to verify all pending coupons for a merchant.
   * Assumes the page already has a valid session (restored from cookies).
   */
  async verifyAllMerchantCoupons(merchantId, page, context, jobTracker = null) {
    if (!page || page.isClosed()) {
      throw new Error('PAGE_FATAL: Page is closed before verification started');
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      throw new Error(`Merchant not found: ${merchantId}`);
    }
    const coupons = await Coupon.find({ brandName: merchant.merchantName, status: 'active' });

    await browserService.emitLog(merchantId, `🔍 Starting verification for ${coupons.length} coupons…`);

    for (const coupon of coupons) {
      try {
        await this.verifySingleCoupon(merchantId, coupon, page, context);
        if (jobTracker) jobTracker.verifiedCount++;
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('PAGE_FATAL') || msg.includes('Target page, context or browser has been closed')) {
          await browserService.emitLog(merchantId, `💀 Fatal browser error for ${coupon.code}: ${err.message}`, 'error');
          if (jobTracker) jobTracker.failedCount++;
          // Re-throw so scheduler can clean up and move to next merchant
          throw err;
        }
        await browserService.emitLog(merchantId, `❌ Verification failed for ${coupon.code}: ${err.message}`, 'error');
        if (jobTracker) jobTracker.failedCount++;
      }

      // Faster delay to achieve 3-4 coupons/minute (15-20s per coupon total cycle)
      if (!page.isClosed()) {
        await page.waitForTimeout(500 + Math.random() * 1000);
      }
    }
  }

  async verifySingleCoupon(merchantId, coupon, page, context) {
    const couponId = coupon._id;
    let verification = await CouponVerification.findOne({ couponId, merchantId });

    if (!verification) {
      verification = new CouponVerification({ couponId, merchantId });
    }

    // 1. Check if we are already on a checkout/cart page or logged in
    const isLoggedIn = await this.checkLoginStatus(page);

    if (!isLoggedIn) {
      await this.performLoginRecovery(merchantId, page, context);
    }

    // 2. Deep analysis of T&C and Cart matching
    await browserService.emitLog(merchantId, `🤖 Verifying coupon ${coupon.code}…`);

    // Extract T&C if we don't have them
    const existingTerms = await CouponVerification.findOne({
      merchantId,
      'termsSummary.minOrderValue': { $exists: true }
    }).sort({ lastAttemptedAt: -1 });

    if (!verification.termsSummary || !verification.termsSummary.minOrderValue) {
      if (existingTerms && existingTerms.termsSummary && !coupon.description) {
        // Reuse terms from another coupon of the same merchant if this one has no specific description
        verification.termsSummary = existingTerms.termsSummary;
        await browserService.emitLog(merchantId, `♻️ Reusing mapped T&C from previous verification.`);
      } else {
        await this.analyzeTerms(page, coupon, verification, merchantId);
      }
    }

    // Match Cart Requirements
    await this.prepareCart(page, verification.termsSummary, merchantId);

    // Apply & Verify
    const result = await this.applyAndCheck(page, coupon.code, merchantId);

    verification.result = result;
    verification.status = result.success ? 'verified' : 'failed';
    verification.lastAttemptedAt = new Date();
    if (result.success) {
      verification.verifiedAt = new Date();
      await browserService.emitLog(merchantId, `✅ Coupon ${coupon.code} verified successfully!`, 'success');
    } else {
      await browserService.emitLog(merchantId, `❌ Coupon ${coupon.code} verification failed: ${result.errorMessage || 'Unknown error'}`, 'error');
    }

    await verification.save();

    if (result.success) {
      await this.markVerified(verification, coupon);
    }
  }

  /**
   * Attempts to recover a lost session by re-logging in.
   * Tries macro first, then falls back to AI-driven login.
   */
  async performLoginRecovery(merchantId, page, context) {
    await browserService.emitLog(merchantId, `🔑 Session lost. Starting auto-login recovery...`);

    // Fetch active credentials
    const activeCreds = await getActiveCredentials(merchantId);
    if (!activeCreds.EMAIL && !activeCreds.PHONE) {
      throw new Error('LOGIN_RECOVERY_FAILED: No credentials configured for this merchant');
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      throw new Error('LOGIN_RECOVERY_FAILED: Merchant not found');
    }

    let macroSucceeded = false;

    // 1. Try Macro-based login first (fastest, zero AI tokens)
    if (merchant.automationMacros && merchant.automationMacros.has('login')) {
      await browserService.emitLog(merchantId, `⚡ Attempting macro-based login recovery...`);
      try {
        macroSucceeded = await executeMacro(merchantId, merchant, 'login', page, context, null, activeCreds);
        if (macroSucceeded) {
          await browserService.emitLog(merchantId, `✅ Macro login recovery succeeded.`, 'success');
        } else {
          await browserService.emitLog(merchantId, `⚠️ Macro login failed, falling back to AI...`, 'warning');
        }
      } catch (macroErr) {
        await browserService.emitLog(merchantId, `⚠️ Macro login crashed: ${macroErr.message}. Falling back to AI...`, 'warning');
      }
    }

    // 2. If macro didn't succeed, use AI-driven login loop
    const isLoggedInAfterMacro = await this.checkLoginStatus(page);
    if (!isLoggedInAfterMacro) {
      await browserService.emitLog(merchantId, `🤖 Attempting AI-based login recovery...`);
      const goal = 'Login to the merchant account using the provided credentials. Fill email with EMAIL, password with PASSWORD.';

      try {
        const aiSucceeded = await runAutomationLoop(merchantId, goal, null, 'login');
        if (aiSucceeded) {
          // Reload the current page so it picks up the new session cookies
          if (!page.isClosed()) {
            try {
              await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
              await BrowserService.warmUpPage(page);
            } catch (reloadErr) {
              await browserService.emitLog(merchantId, `⚠️ Page reload after login failed: ${reloadErr.message}`, 'warning');
            }
          }
        }
      } catch (aiErr) {
        await browserService.emitLog(merchantId, `❌ AI login recovery failed: ${aiErr.message}`, 'error');
      }
    }

    // 3. Final check
    const finalCheck = await this.checkLoginStatus(page);
    if (!finalCheck) {
      throw new Error('LOGIN_RECOVERY_FAILED: Could not restore session after login attempts');
    }

    await browserService.emitLog(merchantId, `✅ Login recovery successful.`, 'success');
  }

  /**
   * Robust screenshot helper with retry, animation disabling, and fatal-error detection.
   */
  async _safeScreenshot(page, options = {}, merchantId = null) {
    if (!page || page.isClosed()) {
      throw new Error('PAGE_FATAL: Page is closed');
    }

    // Best-effort stabilization: wait for network idle (short timeout)
    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      // Page may already be stable or have long-polling requests
    }

    const screenshotOptions = {
      type: 'png',
      animations: 'disabled',
      timeout: 15000,
      ...options,
    };

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (page.isClosed()) {
          throw new Error('PAGE_FATAL: Page closed during screenshot attempt');
        }
        return await page.screenshot(screenshotOptions);
      } catch (err) {
        lastError = err;
        const msg = err.message || '';

        // Fatal: browser or context died — no point retrying
        if (msg.includes('Target page, context or browser has been closed')) {
          throw new Error('PAGE_FATAL: Browser context closed during screenshot');
        }

        if (attempt === 1) {
          if (merchantId) {
            await browserService.emitLog(merchantId, `⚠️ Screenshot attempt ${attempt} failed (${err.message}), retrying with viewport-only...`, 'warning');
          }
          // Fallback: disable fullPage if it was enabled, try viewport-only
          screenshotOptions.fullPage = false;
          try {
            if (!page.isClosed()) {
              await page.waitForTimeout(500);
            }
          } catch {
            // ignore
          }
        }
      }
    }

    throw new Error(`Screenshot failed after retries: ${lastError.message}`);
  }

  async analyzeTerms(page, coupon, verification, merchantId) {
    const description = coupon.description || '';
    // If description is clear enough, we might not even need a screenshot, but Gemini likes it.
    try {
      const screenshot = await this._safeScreenshot(page, { type: 'png' }, merchantId);
      const analysis = await geminiService.analyzeTermsAndConditions(screenshot.toString('base64'), description);

      verification.termsSummary = {
        minOrderValue: analysis.minOrderValue || 0,
        applicableCategories: analysis.applicableCategories || [],
        excludedProducts: analysis.excludedProducts || [],
        userTypes: analysis.userTypes || ['all_users']
      };
      await verification.save();
      await browserService.emitLog(merchantId, `📝 T&C: Min Order ${analysis.minOrderValue || 'None'}`);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('PAGE_FATAL')) throw err;
      await browserService.emitLog(merchantId, `⚠️ AI T&C analysis failed: ${err.message}`, 'warning');
      // Fallback defaults
      verification.termsSummary = { minOrderValue: 0 };
    }
  }

  async prepareCart(page, terms, merchantId) {
    const minOrder = terms?.minOrderValue || 0;

    // Check current cart value if possible
    const cartValue = await page.evaluate(() => {
      // Common cart value selectors
      const selectors = ['.cart-total', '.subtotal', '.cart-value', '.amount', '#cart-total'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const val = parseFloat(el.innerText.replace(/[^0-9.]/g, ''));
          if (!isNaN(val)) return val;
        }
      }
      return 0;
    });

    if (cartValue >= minOrder && cartValue > 0) {
      await browserService.emitLog(merchantId, `🛒 Cart value ${cartValue} already meets requirement ${minOrder}.`);
      return;
    }

    // Optimization: If cart already has items and we're just short of minOrder,
    // Gemini might suggest adding more of the same or navigating.
    // To speed up, we only run prepareCart if absolutely necessary.
    if (cartValue > 0 && minOrder > 0 && cartValue >= minOrder) return;

    await browserService.emitLog(merchantId, `🛒 Preparing cart (Current: ${cartValue}, Target: ${minOrder})…`);

    try {
      const screenshot = await this._safeScreenshot(page, { type: 'png' }, merchantId);
      const suggestion = await geminiService.suggestCartActions(screenshot.toString('base64'), terms);

      if (suggestion.action === 'add_item' || suggestion.action === 'navigate') {
        await browserService.emitLog(merchantId, `🛒 AI suggests: ${suggestion.reason}`);
        if (suggestion.x && suggestion.y) {
          const vp = page.viewportSize();
          await page.mouse.click((suggestion.x / 1000) * vp.width, (suggestion.y / 1000) * vp.height);
          await page.waitForTimeout(3000); // Wait for navigation/add
        }
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('PAGE_FATAL')) throw err;
      await browserService.emitLog(merchantId, `⚠️ Cart preparation failed: ${err.message}`, 'warning');
    }
  }

  async applyAndCheck(page, code, merchantId) {
    await browserService.emitLog(merchantId, `🎟️ Applying code ${code}…`);

    // Optimization: Check if coupon input is already visible from a previous attempt
    // to avoid redundant AI analysis steps.
    const url = page.url();
    let attempts = 0;
    const maxAttempts = 2; // Reduced from 3 to speed up cycle time per coupon

    while (attempts < maxAttempts) {
      attempts++;
      let screenshot;
      try {
        screenshot = await this._safeScreenshot(page, { type: 'png', fullPage: false }, merchantId);
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('PAGE_FATAL')) throw err;
        return { success: false, errorMessage: `Screenshot failed: ${err.message}` };
      }

      const goal = `Find the coupon/promo code input field, type "${code}", and click Apply. If you see an "Apply Coupon" section that needs to be clicked to reveal the input, click that first. Then tell me if it worked.`;

      const suggestion = await geminiService.suggestNextAction(screenshot.toString('base64'), page.url(), goal);
      await browserService.emitLog(merchantId, `🤖 AI Suggestion (${attempts}/${maxAttempts}): ${suggestion.action} - ${suggestion.reason}`);

      if (suggestion.action === 'done') {
        return { success: true, couponApplied: true, errorMessage: null };
      }

      if (suggestion.action === 'failed') {
        return { success: false, errorMessage: suggestion.reason };
      }

      if (suggestion.action === 'fill' || suggestion.action === 'click') {
        if (suggestion.x && suggestion.y) {
          const vp = page.viewportSize();
          const targetX = (suggestion.x / 1000) * vp.width;
          const targetY = (suggestion.y / 1000) * vp.height;

          if (suggestion.action === 'fill') {
            await page.mouse.click(targetX, targetY);
            // Clear existing value if any
            await page.keyboard.down('Meta');
            await page.keyboard.press('a');
            await page.keyboard.up('Meta');
            await page.keyboard.press('Backspace');

            await page.keyboard.type(code);
            await page.keyboard.press('Enter');
          } else {
            await page.mouse.click(targetX, targetY);
          }

          await page.waitForTimeout(3000); // Wait for action to settle

          // After fill/click, let the next loop iteration check the result or perform the next step
          continue;
        }
      }

      if (suggestion.action === 'wait') {
        await page.waitForTimeout(2000);
        continue;
      }

      break; // Unknown action or missing coordinates
    }

    // Final check if we reached here without a definitive "done" or "failed"
    let finalScreenshot;
    try {
      finalScreenshot = await this._safeScreenshot(page, { type: 'png', fullPage: false }, merchantId);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('PAGE_FATAL')) throw err;
      return { success: false, errorMessage: `Final screenshot failed: ${err.message}` };
    }

    const checkGoal = `Check if the coupon code "${code}" was successfully applied. Look for "Applied", discount amounts, or success messages.`;
    const check = await geminiService.suggestNextAction(finalScreenshot.toString('base64'), page.url(), checkGoal);

    const success = check.reason?.toLowerCase().includes('success') || check.action === 'done';
    return {
      success,
      couponApplied: success,
      errorMessage: success ? null : (check.reason || 'Could not verify application')
    };
  }

  async checkLoginStatus(page) {
    try {
      if (page.isClosed()) return false;
      return await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const indicators = [
          'logout', 'sign out', 'my account', 'my profile', 'order history',
          'hi,', 'welcome back', 'account settings'
        ];
        return indicators.some(ind => text.includes(ind));
      });
    } catch {
      return false;
    }
  }

  async markVerified(verification, coupon) {
    coupon.isVerified = true;
    coupon.verifiedAt = new Date();
    coupon.verifiedOn = new Date();
    await coupon.save();
  }

  async replayMacro(page, macro) {
    // Replay logic similar to executeMacro in automation.controller.js
    return true; // Placeholder
  }
}

export default new CouponVerificationService();
