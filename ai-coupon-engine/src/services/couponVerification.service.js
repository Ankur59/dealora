import browserService from './browser.service.js';
import geminiService from './gemini.service.js';
import Coupon from '../models/coupon.model.js';
import Merchant from '../models/merchant.model.js';
import CouponVerification from '../models/couponVerification.model.js';

export class CouponVerificationService {
  /**
   * Main entry point to verify all pending coupons for a merchant.
   * Assumes the page already has a valid session (restored from cookies).
   */
  async verifyAllMerchantCoupons(merchantId, page, context, jobTracker = null) {
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
        await browserService.emitLog(merchantId, `❌ Verification failed for ${coupon.code}: ${err.message}`, 'error');
        if (jobTracker) jobTracker.failedCount++;
      }

      // Random human-like delay between coupons
      await page.waitForTimeout(2000 + Math.random() * 3000);
    }
  }

  async verifySingleCoupon(merchantId, coupon, page, context) {
    const couponId = coupon._id;
    let verification = await CouponVerification.findOne({ couponId, merchantId });

    if (!verification) {
      verification = new CouponVerification({ couponId, merchantId });
    }

    // 1. Check if we are already on a checkout/cart page or logged in
    // This is a fast check to skip redundant login/navigation
    const currentUrl = page.url();
    const isLoggedIn = await this.checkLoginStatus(page);

    if (!isLoggedIn) {
      await browserService.emitLog(merchantId, `🔑 Not logged in, performing auto-login first...`);
      // Logic to trigger login would go here, but for batch verification, 
      // we assume verifyAllMerchantCoupons handles the initial setup.
    }

    // 2. Try Macro first
    if (verification.verificationMacro && verification.verificationMacro.length > 0) {
      await browserService.emitLog(merchantId, `⚡ Replaying macro for coupon ${coupon.code}…`);
      const success = await this.replayMacro(page, verification.verificationMacro);
      if (success) {
        await this.markVerified(verification, coupon);
        return;
      }
    }

    // 2. AI Path: Deep analysis of T&C and Cart matching
    await browserService.emitLog(merchantId, `🤖 Using AI to verify coupon ${coupon.code}…`);

    // Extract T&C if we don't have them
    if (!verification.termsSummary || !verification.termsSummary.minOrderValue) {
      await this.analyzeTerms(page, coupon, verification, merchantId);
    }

    // Match Cart Requirements
    await this.prepareCart(page, verification.termsSummary, merchantId);

    // Apply & Verify
    const result = await this.applyAndCheck(page, coupon.code, merchantId);

    verification.result = result;
    verification.status = result.success ? 'verified' : 'failed';
    verification.lastAttemptedAt = new Date();
    if (result.success) verification.verifiedAt = new Date();

    await verification.save();

    if (result.success) {
      await this.markVerified(verification, coupon);
      // Logic to record successful macro here would go in applyAndCheck or a wrapper
    }
  }

  async analyzeTerms(page, coupon, verification, merchantId) {
    // Navigate to product page or T&C section
    // For now, assume we are on a page where we can see some info or the coupon description helps
    const screenshot = await page.screenshot({ type: 'png' });
    const analysis = await geminiService.analyzeTermsAndConditions(screenshot.toString('base64'), coupon.description);

    verification.termsSummary = analysis;
    await verification.save();
    await browserService.emitLog(merchantId, `📝 AI extracted T&C: Min Order ${analysis.minOrderValue || 'None'}`);
  }

  async prepareCart(page, terms, merchantId) {
    // AI suggests what to add to cart to meet terms
    const screenshot = await page.screenshot({ type: 'png' });
    const suggestion = await geminiService.suggestCartActions(screenshot.toString('base64'), terms);

    if (suggestion.action === 'add_item') {
      await browserService.emitLog(merchantId, `🛒 Adding items to cart to meet requirements…`);
      // Perform the click/navigate to add item
      // This would use the same logic as runAutomationLoop but focused on cart prep
    }
  }

  async applyAndCheck(page, code, merchantId) {
    // Navigate to checkout/cart
    // Find coupon input, type code, click apply
    // Check if "Success" or "Discount Applied" appears
    return { success: true, couponApplied: true }; // Placeholder
  }

  async checkLoginStatus(page) {
    try {
      // Common indicators of being logged in: absence of "Login/Sign In" or presence of "Account/Logout"
      const loginText = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('logout') || text.includes('my account') || text.includes('sign out');
      });
      return loginText;
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
