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

      // Random human-like delay between coupons (reduced)
      await page.waitForTimeout(1000 + Math.random() * 2000);
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
      await browserService.emitLog(merchantId, `🔑 Session lost or not logged in, attempting auto-login...`);
      // Use the existing login flow from automation.controller
      const targetUrl = page.url();
      const goal = 'Login to the merchant account using the provided credentials. Fill email with EMAIL, password with PASSWORD.';
      // We need to import or access runAutomationLoop logic here.
      // For now, let's assume we can trigger a login via the controller or a simplified version.
      await browserService.emitLog(merchantId, `⚠️ Login logic required but currently in batch mode. Continuing...`, 'warning');
    }

    // 2. Deep analysis of T&C and Cart matching
    await browserService.emitLog(merchantId, `🤖 Verifying coupon ${coupon.code}…`);

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

  async analyzeTerms(page, coupon, verification, merchantId) {
    const description = coupon.description || '';
    // If description is clear enough, we might not even need a screenshot, but Gemini likes it.
    try {
      const screenshot = await page.screenshot({ type: 'png' });
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

    await browserService.emitLog(merchantId, `🛒 Preparing cart (Current: ${cartValue}, Target: ${minOrder})…`);
    
    const screenshot = await page.screenshot({ type: 'png' });
    const suggestion = await geminiService.suggestCartActions(screenshot.toString('base64'), terms);

    if (suggestion.action === 'add_item' || suggestion.action === 'navigate') {
      await browserService.emitLog(merchantId, `🛒 AI suggests: ${suggestion.reason}`);
      if (suggestion.x && suggestion.y) {
        const vp = page.viewportSize();
        await page.mouse.click((suggestion.x / 1000) * vp.width, (suggestion.y / 1000) * vp.height);
        await page.waitForTimeout(3000); // Wait for navigation/add
      }
    }
  }

  async applyAndCheck(page, code, merchantId) {
    await browserService.emitLog(merchantId, `🎟️ Applying code ${code}…`);
    
    // Use AI to find and apply coupon
    const url = page.url();
    let attempts = 0;
    const maxAttempts = 3; // Allow up to 3 AI-guided steps (e.g., click section -> fill code -> click apply)

    while (attempts < maxAttempts) {
      attempts++;
      const screenshot = await page.screenshot({ type: 'png' });
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
    const finalScreenshot = await page.screenshot({ type: 'png' });
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
