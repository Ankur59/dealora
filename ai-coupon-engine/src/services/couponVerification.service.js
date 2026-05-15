import browserService, { BrowserService } from './browser.service.js';
import geminiService from './gemini.service.js';
import Coupon from '../models/coupon.model.js';
import PartnerMerchant from '../models/partnerMerchant.model.js';
import Merchant from '../models/merchant.model.js';
import CouponVerification from '../models/couponVerification.model.js';
import { getActiveCredentials, executeMacro, runAutomationLoop } from '../controllers/automation.controller.js';
import proxyManager from './proxyManager.service.js';

export class CouponVerificationService {
  constructor() {
    this._partnerLinkCache = new Map();
  }

  /**
   * Resolve the internal Merchant._id from a PartnerMerchant._id.
   */
  async _resolveMerchantId(partnerMerchantId) {
    const pm = await PartnerMerchant.findById(partnerMerchantId).lean();
    if (!pm) return null;
    const m = await Merchant.findOne({ merchantName: pm.merchantName }).lean();
    return m ? m._id.toString() : null;
  }

  /**
   * Check if a coupon should be skipped from verification.
   * Skip if: no coupon code, couponType is "No cost EMI", isInStore is true, isNewUser is true
   */
  shouldSkipVerification(coupon) {
    if (!coupon.code || coupon.code.trim() === '') {
      return { skip: true, reason: 'No coupon code' };
    }
    if (coupon.couponType === 'No cost EMI') {
      return { skip: true, reason: 'Coupon type: No cost EMI' };
    }
    if (coupon.isInStore === true) {
      return { skip: true, reason: 'In-store only coupon' };
    }
    if (coupon.isNewUser === true) {
      return { skip: true, reason: 'New user only coupon' };
    }
    return { skip: false, reason: null };
  }

  /**
   * Main entry point to verify all pending coupons for a merchant.
   * Assumes the page already has a valid session (restored from cookies).
   */
  async verifyAllMerchantCoupons(merchantId, page, context, jobTracker = null) {
    if (!page || page.isClosed()) {
      throw new Error('PAGE_FATAL: Page is closed before verification started');
    }

    const merchant = await PartnerMerchant.findById(merchantId);
    if (!merchant) {
      throw new Error(`PartnerMerchant not found: ${merchantId}`);
    }
    const resolved = await Merchant.findOne({ merchantName: merchant.merchantName });
    const browserMerchantId = resolved ? resolved._id.toString() : merchantId.toString();
    const allCoupons = await Coupon.find({
      brandName: merchant.merchantName,
      $or: [
        { status: 'active' },
        { status: { $exists: false } },
        { status: null },
      ],
    });

    const skippedCoupons = [];
    const coupons = allCoupons.filter(coupon => {
      const { skip, reason } = this.shouldSkipVerification(coupon);
      if (skip) {
        skippedCoupons.push({ code: coupon.code, reason });
        return false;
      }
      return true;
    });

    if (skippedCoupons.length > 0) {
      const skipList = skippedCoupons.map(s => `  \u2022 ${s.code || 'N/A'} \u2014 ${s.reason}`).join('\n');
      await browserService.emitLog(browserMerchantId, `\u23ED\uFE0F Skipping ${skippedCoupons.length} coupon(s) from verification:\n${skipList}`);
    }

    await browserService.emitLog(browserMerchantId, `\uD83D\uDD0D Starting verification for ${coupons.length} coupons\u2026`);

    if (coupons.length === 0) {
      await browserService.emitLog(browserMerchantId, `\u2705 No coupons to verify after filtering.`);
      return;
    }

    // Check for block right at the start
    const blockResult = await browserService.checkAndHandleBlock(browserMerchantId, page);
    if (blockResult.blocked && blockResult.escalated) {
      // Swap to proxy page/context
      page = blockResult.page;
      context = blockResult.context;
      // Re-navigate using partner merchant's URL
      const targetUrl = merchant.website || merchant.affiliateLink;
      if (targetUrl) {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await BrowserService.warmUpPage(page);
      }
    } else if (blockResult.blocked && !blockResult.escalated) {
      await browserService.emitLog(browserMerchantId, `⚠️ Blocked and cannot escalate further. Skipping merchant.`, 'error');
      return;
    }

    for (const coupon of coupons) {
      try {
        await this.verifySingleCoupon(merchantId, coupon, page, context, browserMerchantId);
        if (jobTracker) jobTracker.verifiedCount++;
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('PAGE_FATAL') || msg.includes('Target page, context or browser has been closed')) {
          await browserService.emitLog(browserMerchantId, `💀 Fatal browser error for ${coupon.code}: ${err.message}`, 'error');
          if (jobTracker) jobTracker.failedCount++;
          // Re-throw so scheduler can clean up and move to next merchant
          throw err;
        }
        await browserService.emitLog(browserMerchantId, `❌ Verification failed for ${coupon.code}: ${err.message}`, 'error');
        if (jobTracker) jobTracker.failedCount++;
      }

      // Faster delay to achieve 3-4 coupons/minute (15-20s per coupon total cycle)
      if (!page.isClosed()) {
        await page.waitForTimeout(500 + Math.random() * 1000);
      }
    }
  }

  /**
   * Verify a LIMITED batch of coupons for a merchant (default 3).
   * Used by the minute-by-minute scheduler to process exactly N coupons per cycle.
   * Tracks progress via `lastVerifiedIndex` on the merchant doc.
   *
   * @param {string} merchantId
   * @param {import('playwright').Page} page
   * @param {import('playwright').BrowserContext} context
   * @param {number} batchSize - Number of coupons to verify this cycle (default: 3)
   * @param {object} jobTracker - Optional job tracker for stats
   * @returns {{ processed: number, remaining: number, done: boolean }}
   */
  async verifyBatchCoupons(merchantId, page, context, batchSize = 3, jobTracker = null) {
    if (!page || page.isClosed()) {
      throw new Error('PAGE_FATAL: Page is closed before batch verification started');
    }

    const merchant = await PartnerMerchant.findById(merchantId);
    if (!merchant) {
      throw new Error(`PartnerMerchant not found: ${merchantId}`);
    }

    const resolved = await Merchant.findOne({ merchantName: merchant.merchantName });
    const browserMerchantId = resolved ? resolved._id.toString() : merchantId.toString();

    const rawCoupons = await Coupon.find({
      brandName: merchant.merchantName,
      $or: [
        { status: 'active' },
        { status: { $exists: false } },
        { status: null },
      ],
    }).sort({ _id: 1 });

    const skippedCoupons = [];
    const allCoupons = rawCoupons.filter(coupon => {
      const { skip, reason } = this.shouldSkipVerification(coupon);
      if (skip) {
        skippedCoupons.push({ code: coupon.code, reason });
        return false;
      }
      return true;
    });

    if (skippedCoupons.length > 0) {
      const skipList = skippedCoupons.map(s => `  \u2022 ${s.code || 'N/A'} \u2014 ${s.reason}`).join('\n');
      await browserService.emitLog(browserMerchantId, `\u23ED\uFE0F Skipping ${skippedCoupons.length} coupon(s) from verification:\n${skipList}`);
    }

    if (allCoupons.length === 0) {
      await browserService.emitLog(browserMerchantId, `ℹ️ No active coupons to verify.`);
      if (resolved) {
        await Merchant.findByIdAndUpdate(browserMerchantId, { _verificationCursor: 0 });
      }
      return { processed: 0, remaining: 0, done: true };
    }

    // Determine where we left off using the resolved Merchant's cursor
    const startIndex = resolved ? (resolved._verificationCursor || 0) : 0;
    const batch = allCoupons.slice(startIndex, startIndex + batchSize);

    if (batch.length === 0) {
      if (resolved) {
        await Merchant.findByIdAndUpdate(browserMerchantId, { _verificationCursor: 0 });
      }
      await browserService.emitLog(browserMerchantId, `✅ All ${allCoupons.length} coupons verified. Cursor reset.`);
      return { processed: 0, remaining: 0, done: true };
    }

    await browserService.emitLog(browserMerchantId, `🔍 Batch: verifying coupons ${startIndex + 1}–${startIndex + batch.length} of ${allCoupons.length}…`);

    // Check for block before starting
    const blockResult = await browserService.checkAndHandleBlock(browserMerchantId, page);
    if (blockResult.blocked && blockResult.escalated) {
      page = blockResult.page;
      context = blockResult.context;
      const targetUrl = merchant.website || merchant.affiliateLink;
      if (targetUrl) {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await BrowserService.warmUpPage(page);
      }
    } else if (blockResult.blocked && !blockResult.escalated) {
      await browserService.emitLog(browserMerchantId, `⚠️ Blocked, proxy already active. Skipping batch.`, 'error');
      return { processed: 0, remaining: allCoupons.length - startIndex, done: false };
    }

    let processed = 0;
    for (const coupon of batch) {
      try {
        await this.verifySingleCoupon(merchantId, coupon, page, context, browserMerchantId);
        if (jobTracker) jobTracker.verifiedCount++;
        processed++;
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('PAGE_FATAL') || msg.includes('Target page, context or browser has been closed')) {
          await browserService.emitLog(browserMerchantId, `💀 Fatal error for ${coupon.code}: ${err.message}`, 'error');
          if (jobTracker) jobTracker.failedCount++;
          throw err;
        }

        // Check if this was a block — try proxy escalation mid-batch
        if (!page.isClosed()) {
          const midBlock = await browserService.checkAndHandleBlock(browserMerchantId, page);
          if (midBlock.blocked && midBlock.escalated) {
            page = midBlock.page;
            context = midBlock.context;
            await browserService.emitLog(browserMerchantId, `🔄 Switched to proxy mid-batch. Retrying ${coupon.code}…`);
            try {
              const targetUrl = merchant.website || merchant.affiliateLink;
              if (targetUrl) await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
              await this.verifySingleCoupon(merchantId, coupon, page, context, browserMerchantId);
              if (jobTracker) jobTracker.verifiedCount++;
              processed++;
              continue;
            } catch (retryErr) {
              await browserService.emitLog(browserMerchantId, `❌ Retry with proxy failed for ${coupon.code}: ${retryErr.message}`, 'error');
            }
          }
        }

        await browserService.emitLog(browserMerchantId, `❌ Verification failed for ${coupon.code}: ${err.message}`, 'error');
        if (jobTracker) jobTracker.failedCount++;
        processed++; // Still count as processed to advance cursor
      }

      // Brief pause between coupons
      if (!page.isClosed()) {
        await page.waitForTimeout(500 + Math.random() * 1000);
      }
    }

    // Advance cursor on Merchant model
    const newCursor = startIndex + processed;
    const remaining = Math.max(0, allCoupons.length - newCursor);
    const done = remaining <= 0;

    if (resolved) {
      await Merchant.findByIdAndUpdate(browserMerchantId, {
        _verificationCursor: done ? 0 : newCursor,
      });
    }

    await browserService.emitLog(browserMerchantId, `📊 Batch done: ${processed} verified, ${remaining} remaining.`);
    return { processed, remaining: Math.max(0, remaining), done };
  }

  /**
   * Resolve merchant website and affiliate link from PartnerMerchant collection.
   * Falls back to coupon-level trackingLink / couponVisitingLink.
   * @returns {{ website: string|null, affiliateLink: string|null }}
   */
  async resolveMerchantLinks(coupon) {
    const cacheKey = `${coupon.merchantName || ''}|${coupon.partner || ''}|${coupon.merchantId || ''}`;
    const cached = this._partnerLinkCache.get(cacheKey);
    if (cached) return cached;

    const links = { website: null, affiliateLink: null };

    try {
      const query = {};
      if (coupon.merchantId) {
        query.merchantId = coupon.merchantId;
      }
      if (coupon.partner) {
        query.partner = coupon.partner;
      }

      if (Object.keys(query).length > 0) {
        const pm = await PartnerMerchant.findOne(query).lean();
        if (pm) {
          links.website = pm.website || null;
          links.affiliateLink = pm.affiliateLink || null;
        }
      }

      if (!links.website && coupon.merchantName) {
        const pmByName = await PartnerMerchant.findOne({ merchantName: coupon.merchantName }).lean();
        if (pmByName) {
          links.website = links.website || pmByName.website || null;
          links.affiliateLink = links.affiliateLink || pmByName.affiliateLink || null;
        }
      }
    } catch (err) {
      console.warn('[PartnerMerchant] Link resolution failed:', err.message);
    }

    this._partnerLinkCache.set(cacheKey, links);
    return links;
  }

  async verifySingleCoupon(merchantId, coupon, page, context, browserMerchantId = null) {
    const couponId = coupon._id;

    // Resolve the internal Merchant._id for CouponVerification storage
    const resolvedId = browserMerchantId || (await this._resolveMerchantId(merchantId)) || merchantId.toString();
    let verification = await CouponVerification.findOne({ couponId, merchantId: resolvedId });

    if (!verification) {
      verification = new CouponVerification({ couponId, merchantId: resolvedId });
    }

    // 1. Check login status BEFORE navigating away
    const isLoggedIn = await this.checkLoginStatus(page);

    if (!isLoggedIn) {
      // Resolve affiliate link and navigate before login recovery
      const { affiliateLink, website: partnerWebsite } = await this.resolveMerchantLinks(coupon);
      const navigateTo = coupon.trackingLink || affiliateLink || coupon.couponVisitingLink || partnerWebsite;

      if (navigateTo) {
        try {
          await browserService.emitLog(resolvedId, `🔗 Navigating to affiliate link…`);
          await page.goto(navigateTo, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await BrowserService.warmUpPage(page);
        } catch (navErr) {
          await browserService.emitLog(resolvedId, `⚠️ Affiliate link navigation failed: ${navErr.message}`, 'warning');
        }
      }

      await this.performLoginRecovery(merchantId, page, context, resolvedId);
    }

    // 3. Deep analysis of T&C and Cart matching
    await browserService.emitLog(resolvedId, `🤖 Verifying coupon ${coupon.code}…`);

    // Extract T&C if we don't have them
    const existingTerms = await CouponVerification.findOne({
      merchantId: resolvedId,
      'termsSummary.minOrderValue': { $exists: true }
    }).sort({ lastAttemptedAt: -1 });

    if (!verification.termsSummary || !verification.termsSummary.minOrderValue) {
      if (existingTerms && existingTerms.termsSummary && !coupon.description) {
        // Reuse terms from another coupon of the same merchant if this one has no specific description
        verification.termsSummary = existingTerms.termsSummary;
        await browserService.emitLog(resolvedId, `♻️ Reusing mapped T&C from previous verification.`);
      } else {
        await this.analyzeTerms(page, coupon, verification, resolvedId);
      }
    }

    // Match Cart Requirements
    await this.prepareCart(page, verification.termsSummary, resolvedId);

    // Apply & Verify
    const result = await this.applyAndCheck(page, coupon.code, resolvedId);

    verification.result = result;
    verification.status = result.success ? 'verified' : 'failed';
    verification.lastAttemptedAt = new Date();
    if (result.success) {
      verification.verifiedAt = new Date();
      await browserService.emitLog(resolvedId, `✅ Coupon ${coupon.code} verified successfully!`, 'success');
    } else {
      await browserService.emitLog(resolvedId, `❌ Coupon ${coupon.code} verification failed: ${result.errorMessage || 'Unknown error'}`, 'error');
    }

    await verification.save();

    if (result.success) {
      await this.markVerified(verification, coupon);
    }
  }

  /**
   * Attempts to recover a lost session by re-logging in via AI automation.
   * Resolves the internal Merchant id so that cookies, credentials and
   * automation-loop ops target the correct MongoDB document.
   */
  async performLoginRecovery(merchantId, page, context, resolvedMerchantId = null) {
    const partnerMerchant = await PartnerMerchant.findById(merchantId);
    if (!partnerMerchant) {
      throw new Error('LOGIN_RECOVERY_FAILED: PartnerMerchant not found');
    }

    const resolved = resolvedMerchantId
      ? await Merchant.findById(resolvedMerchantId).lean()
      : await Merchant.findOne({ merchantName: partnerMerchant.merchantName }).lean();
    const resolvedId = resolved ? resolved._id.toString() : merchantId.toString();

    await browserService.emitLog(resolvedId, `🔑 Session lost. Starting auto-login recovery...`);

    const activeCreds = await getActiveCredentials(resolvedId);
    if (!activeCreds.EMAIL && !activeCreds.PHONE) {
      throw new Error('LOGIN_RECOVERY_FAILED: No credentials configured for this merchant');
    }

    let macroSucceeded = false;

    // 1. Try Macro-based login first (fastest, zero AI tokens)
    if (resolved && resolved.automationMacros && resolved.automationMacros.has('login')) {
      await browserService.emitLog(resolvedId, `⚡ Attempting macro-based login recovery...`);
      try {
        macroSucceeded = await executeMacro(resolvedId, resolved, 'login', page, context, null, activeCreds);
        if (macroSucceeded) {
          const checkAfterMacro = await this.checkLoginStatus(page);
          if (checkAfterMacro) {
            await browserService.emitLog(resolvedId, `✅ Macro login recovery succeeded.`, 'success');
            return;
          }
          await browserService.emitLog(resolvedId, `⚠️ Macro ran but login not detected. Falling back to AI...`, 'warning');
        } else {
          await browserService.emitLog(resolvedId, `⚠️ Macro login failed, falling back to AI...`, 'warning');
        }
      } catch (macroErr) {
        await browserService.emitLog(resolvedId, `⚠️ Macro login crashed: ${macroErr.message}. Falling back to AI...`, 'warning');
      }
    }

    // 2. Use AI-driven login loop
    await browserService.emitLog(resolvedId, `🤖 Attempting AI-based login recovery...`);
    const goal = 'Login to the merchant account using the provided credentials. Fill email with EMAIL, password with PASSWORD.';

    try {
      const aiSucceeded = await runAutomationLoop(resolvedId, goal, null, 'login');
      if (aiSucceeded) {
        if (!page.isClosed()) {
          try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
            await BrowserService.warmUpPage(page);
          } catch (reloadErr) {
            await browserService.emitLog(resolvedId, `⚠️ Page reload after login failed: ${reloadErr.message}`, 'warning');
          }
        }
      }
    } catch (aiErr) {
      await browserService.emitLog(resolvedId, `❌ AI login recovery failed: ${aiErr.message}`, 'error');
    }

    // 3. Final check
    const finalCheck = await this.checkLoginStatus(page);
    if (!finalCheck) {
      throw new Error('LOGIN_RECOVERY_FAILED: Could not restore session after login attempts');
    }

    await browserService.emitLog(resolvedId, `✅ Login recovery successful.`, 'success');
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
