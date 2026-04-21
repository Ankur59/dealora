import browserService from '../services/browser.service.js';
import geminiService from '../services/gemini.service.js';
import Merchant from '../models/merchant.model.js';
import MerchantCredential from '../models/merchantCredential.model.js';
import { io } from '../index.js';

const STANDARD_CREDENTIALS = {
  EMAIL: 'Nobentadeal@gmail.com',
  PASSWORD: 'Mumbai@123',
  PHONE: '7425817074'
};

/**
 * Fetches dynamic credentials taking manual merchant overrides into account
 */
async function getActiveCredentials(merchantId) {
  const creds = { ...STANDARD_CREDENTIALS };
  const custom = await MerchantCredential.find({ merchantId }).lean();
  
  for (const c of custom) {
    if (c.credentialType === 'email_password') {
       creds.EMAIL = c.login;
       creds.PASSWORD = c.password;
    } else if (c.credentialType === 'phone_password') {
       creds.PHONE = c.login;
       // We only override the password if we didn't just grab it from email, or if it's explicitly phone_password
       if (!custom.find(x => x.credentialType === 'email_password')) {
         creds.PASSWORD = c.password;
       }
    }
  }
  return creds;
}

/**
 * Executes a previously recorded macro of steps strictly.
 */
async function executeMacro(merchantId, merchant, mode, page, context, res, activeCreds) {
  const macro = merchant.automationMacros.get(mode);
  if (!macro || macro.length === 0) return false;

  await browserService.emitLog(merchantId, `⚡ Running fast macro for ${mode} (0 AI tokens)…`);
  await Merchant.findByIdAndUpdate(merchantId, {
    'lastLoginAttempt.status': 'running',
    'lastLoginAttempt.lastAttempted': new Date(),
    'lastLoginAttempt.message': `Executing macro for ${mode}`,
  });

  try {
    for (const step of macro) {
      if (step.action === 'wait') {
        await page.waitForTimeout(3000);
        continue;
      }
      
      if (step.action === 'otp_needed') {
        await Merchant.findByIdAndUpdate(merchantId, { 'lastLoginAttempt.status': 'pending_otp' });
        const otp = await browserService.waitForOTP(merchantId);
        if (otp) {
          context._lastOtp = otp;
          await browserService.emitLog(merchantId, `OTP received: ${otp}. Continuing…`);
          await Merchant.findByIdAndUpdate(merchantId, { 'lastLoginAttempt.status': 'running' });
          continue;
        } else {
          await browserService.emitLog(merchantId, 'OTP timeout / cancelled.', 'error');
          await Merchant.findByIdAndUpdate(merchantId, {
            'lastLoginAttempt.status': 'failed',
            'lastLoginAttempt.message': 'OTP timeout during macro',
          });
          return false; // Macro failed gracefully
        }
      }

      if (step.action === 'click' && step.selector) {
        await page.waitForSelector(step.selector, { timeout: 5000 });
        await page.click(step.selector);
      } else if (step.action === 'fill' && step.selector) {
        let val = step.value;
        if (val === 'EMAIL') val = activeCreds.EMAIL;
        else if (val === 'PASSWORD') val = activeCreds.PASSWORD;
        else if (val === 'PHONE') val = activeCreds.PHONE;
        else if (val === 'OTP_VALUE') val = context._lastOtp || '';

        await page.waitForSelector(step.selector, { timeout: 5000 });
        await page.fill(step.selector, val);
      }
      await page.waitForTimeout(2000);
    }

    // If we completed the macro loop successfully without crashing
    await browserService.saveSession(merchantId, context);
    await browserService.emitLog(merchantId, '✅ Macro completion successful. Cookies saved.', 'success');
    await Merchant.findByIdAndUpdate(merchantId, {
      'lastLoginAttempt.status': 'success',
      'lastLoginAttempt.message': 'Automation completed successfully via Macro',
    });
    res.status(200).json({ message: 'Automation finished via Macro', success: true });
    return true; // Used macro successfully
  } catch (err) {
    await browserService.emitLog(merchantId, `⚠️ Macro execution failed at some step: ${err.message}. Falling back to AI…`, 'warning');
    return false; // Macro failed, fallback to Gemini
  }
}

/**
 * Core automation loop – shared by both loginToMerchant and createAccountOnMerchant.
 * @param {string} merchantId
 * @param {string} goal       – Natural-language goal sent to Gemini
 * @param {object} res        – Express response (called once at end)
 * @param {string} mode       – 'login' or 'create_account'
 */
async function runAutomationLoop(merchantId, goal, res, mode) {
  try {
    const activeCreds = await getActiveCredentials(merchantId);
    
    // Inject custom email into the goal text if appropriate
    let finalGoal = goal.replace(STANDARD_CREDENTIALS.EMAIL, activeCreds.EMAIL);
    finalGoal = finalGoal.replace(STANDARD_CREDENTIALS.PHONE, activeCreds.PHONE);
    
    const { page, context, merchant } = await browserService.getPageWithSession(merchantId);
    if (!merchant.actionMaps) merchant.actionMaps = new Map();
    if (!merchant.automationMacros) merchant.automationMacros = new Map();

    await browserService.emitLog(merchantId, `Starting automation for ${merchant.merchantName}…`);
    await browserService.emitLog(merchantId, `Goal: ${finalGoal}`, 'info');

    const targetUrl = merchant.website || merchant.merchantUrl || merchant.domain;
    if (!targetUrl) {
      throw new Error(`Merchant ${merchant.merchantName} has no website URL configured.`);
    }

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (err) {
      await browserService.emitLog(merchantId, `⚠️ Initial navigation took too long, proceeding anyway: ${err.message}`, 'warning');
    }

    // 1. Try to execute Macro if we have one
    if (merchant.automationMacros.has(mode)) {
       const macroSucceeded = await executeMacro(merchantId, merchant, mode, page, context, res, activeCreds);
       if (macroSucceeded) return; // All done!
       // If failed, we just fall through to the slow Gemini loop.
    }

    // 2. Slow path: Gemini reasoning
    await Merchant.findByIdAndUpdate(merchantId, {
      'lastLoginAttempt.status': 'running',
      'lastLoginAttempt.lastAttempted': new Date(),
      'lastLoginAttempt.message': finalGoal,
    });

    let attempts = 0;
    const maxAttempts = 25;
    let succeeded = false;
    let currentMacro = []; // We will record this run to save it later

    while (attempts < maxAttempts) {
      attempts++;
      const url = page.url();
      const screenshot = await page.screenshot({ type: 'png', fullPage: false });
      const screenshotBase64 = screenshot.toString('base64');

      await browserService.emitLog(merchantId, `Analyzing page (Attempt ${attempts}/${maxAttempts})…`);
      const suggestion = await geminiService.suggestNextAction(screenshotBase64, url, finalGoal);

      await browserService.emitLog(merchantId, `AI → ${suggestion.action}: ${suggestion.reason}`);

      if (suggestion.action === 'done') {
        succeeded = true;
        // Save cookies immediately
        await browserService.saveSession(merchantId, context);
        await browserService.emitLog(merchantId, '✅ Goal achieved! Cookies saved.', 'success');
        await Merchant.findByIdAndUpdate(merchantId, {
          'lastLoginAttempt.status': 'success',
          'lastLoginAttempt.message': 'Automation completed successfully',
        });
        
        // Save the successful sequence to avoid using tokens next time
        if (currentMacro.length > 0) {
            merchant.automationMacros.set(mode, currentMacro);
            await merchant.save();
            await browserService.emitLog(merchantId, '💾 Saved action sequence as macro for future runs.');
        }
        break;
      }

      if (suggestion.action === 'failed') {
        await browserService.emitLog(merchantId, `❌ Goal failed: ${suggestion.reason}`, 'error');
        await Merchant.findByIdAndUpdate(merchantId, {
          'lastLoginAttempt.status': 'failed',
          'lastLoginAttempt.message': suggestion.reason,
        });
        // Clear macro if we fail, so we don't save a bad state
        currentMacro = [];
        break;
      }

      if (suggestion.action === 'otp_needed') {
        currentMacro.push({ action: 'otp_needed' });
        await Merchant.findByIdAndUpdate(merchantId, {
          'lastLoginAttempt.status': 'pending_otp',
        });
        const otp = await browserService.waitForOTP(merchantId);
        if (otp) {
          context._lastOtp = otp;
          await browserService.emitLog(merchantId, `OTP received: ${otp}. Continuing…`);
          await browserService.saveSession(merchantId, context);
          await browserService.emitLog(merchantId, '🍪 Mid-session cookies saved after OTP.', 'info');
          await Merchant.findByIdAndUpdate(merchantId, {
            'lastLoginAttempt.status': 'running',
          });
          continue;
        } else {
          await browserService.emitLog(merchantId, 'OTP timeout / cancelled.', 'error');
          await Merchant.findByIdAndUpdate(merchantId, {
            'lastLoginAttempt.status': 'failed',
            'lastLoginAttempt.message': 'OTP not provided in time',
          });
          currentMacro = [];
          break;
        }
      }

      if (suggestion.action === 'click' || suggestion.action === 'fill') {
        const normalizedUrl = new URL(url).pathname;
        const actionKey = `${normalizedUrl}:${suggestion.element}`;
        let selector = merchant.actionMaps.get(actionKey);

        if (!selector && suggestion.x && suggestion.y) {
          const viewport = page.viewportSize();
          const x = (suggestion.x / 1000) * viewport.width;
          const y = (suggestion.y / 1000) * viewport.height;

          const element = await page.evaluateHandle(([px, py]) => { return document.elementFromPoint(px, py); }, [x, y]);

          if (element) {
            selector = await browserService.getUniqueSelector(page, element);
            if (selector) {
              merchant.actionMaps.set(actionKey, selector);
              await merchant.save();
              await browserService.emitLog(merchantId, `🗺️ Mapped: "${suggestion.element}" → ${selector}`);
            }
          }
        }

        if (selector) {
          currentMacro.push({ 
            action: suggestion.action, 
            selector, 
            value: suggestion.value 
          });
        }

        try {
          if (suggestion.action === 'fill') {
            let val = suggestion.value;
            if (val === 'EMAIL') val = activeCreds.EMAIL;
            else if (val === 'PASSWORD') val = activeCreds.PASSWORD;
            else if (val === 'PHONE') val = activeCreds.PHONE;
            else if (val === 'OTP_VALUE') val = context._lastOtp || '';

            if (selector) {
              await page.fill(selector, val);
            } else if (suggestion.x && suggestion.y) {
              const vp = page.viewportSize();
              await page.mouse.click((suggestion.x / 1000) * vp.width, (suggestion.y / 1000) * vp.height);
              await page.keyboard.type(val);
            }
          } else {
            if (selector) {
              await page.click(selector);
            } else if (suggestion.x && suggestion.y) {
              const vp = page.viewportSize();
              await page.mouse.click((suggestion.x / 1000) * vp.width, (suggestion.y / 1000) * vp.height);
            }
          }
        } catch (err) {
          await browserService.emitLog(merchantId, `⚠️ Action error: ${err.message}. Retrying…`, 'warning');
          if (selector) {
            merchant.actionMaps.delete(actionKey);
            await merchant.save();
          }
          currentMacro.pop(); // Remove the failed action from the macro
        }
      }

      if (suggestion.action === 'wait') {
        currentMacro.push({ action: 'wait' });
        await page.waitForTimeout(3000);
      } else {
        await page.waitForTimeout(2000);
      }
    }

    if (!succeeded && attempts >= maxAttempts) {
      await browserService.emitLog(merchantId, '⚠️ Max attempts reached without completing goal.', 'warning');
      await Merchant.findByIdAndUpdate(merchantId, {
        'lastLoginAttempt.status': 'failed',
        'lastLoginAttempt.message': 'Max attempts exceeded',
      });
    }

    if (!res.headersSent) {
        res.status(200).json({ message: 'Automation finished', success: succeeded });
    }
  } catch (error) {
    console.error('Automation error:', error);
    await browserService.emitLog(merchantId, `🔥 Critical error: ${error.message}`, 'error');
    await Merchant.findByIdAndUpdate(merchantId, {
      'lastLoginAttempt.status': 'failed',
      'lastLoginAttempt.message': error.message,
    }).catch(() => {});
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

export class AutomationController {
  /**
   * POST /api/v1/automation/login/:merchantId
   * Triggers AI-driven login flow using the merchant's saved credentials / standard creds.
   */
  async loginToMerchant(req, res) {
    const { merchantId } = req.params;
    const { goal = 'Login to the merchant account using the provided credentials. Fill email with EMAIL, password with PASSWORD.' } = req.body;
    await runAutomationLoop(merchantId, goal, res, 'login');
  }

  /**
   * POST /api/v1/automation/create-account/:merchantId
   * Triggers AI-driven account CREATION flow using standard credentials.
   */
  async createAccountOnMerchant(req, res) {
    const { merchantId } = req.params;
    const goal = req.body.goal ||
      `Create a new account on this merchant website using these standard credentials:
       Email: ${STANDARD_CREDENTIALS.EMAIL}
       Password: ${STANDARD_CREDENTIALS.PASSWORD}
       Phone: ${STANDARD_CREDENTIALS.PHONE}
       Fill in the registration/signup form, handle any OTP verification, and complete account creation.
       Use EMAIL for email fields, PASSWORD for password fields, PHONE for phone fields.`;
    await runAutomationLoop(merchantId, goal, res, 'create_account');
  }

  /**
   * POST /api/v1/automation/otp
   * Provide OTP to a waiting automation session.
   */
  async provideOTP(req, res) {
    const { merchantId, otp } = req.body;
    if (!merchantId || !otp) {
      return res.status(400).json({ error: 'merchantId and otp are required' });
    }
    io.emit('otp_provided', { merchantId, otp });
    res.status(200).json({ message: 'OTP forwarded to automation agent' });
  }

  /**
   * POST /api/v1/automation/save-session/:merchantId
   * Manually snapshot and persist current browser cookies for a merchant.
   */
  async saveSessionNow(req, res) {
    const { merchantId } = req.params;
    try {
      const context = browserService.contexts.get(merchantId);
      if (!context) {
        return res.status(404).json({ error: 'No active browser session for this merchant. Start an automation first.' });
      }
      await browserService.saveSession(merchantId, context);
      await browserService.emitLog(merchantId, '🍪 Cookies manually saved by dashboard user.', 'success');
      const updated = await Merchant.findById(merchantId).lean();
      res.status(200).json({ message: 'Session cookies saved', cookieCount: updated?.cookies?.length ?? 0 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/v1/automation/session-status/:merchantId
   * Returns cookie count and last login attempt status for a merchant.
   */
  async getSessionStatus(req, res) {
    const { merchantId } = req.params;
    try {
      const merchant = await Merchant.findById(merchantId).lean();
      if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
      const hasActiveBrowserSession = browserService.contexts.has(merchantId);
      
      const macroCount = merchant.automationMacros ? Object.keys(Object.fromEntries(merchant.automationMacros)).length : 0;
      
      res.status(200).json({
        merchantId,
        merchantName: merchant.merchantName,
        cookieCount: Array.isArray(merchant.cookies) ? merchant.cookies.length : 0,
        hasSavedCookies: Array.isArray(merchant.cookies) && merchant.cookies.length > 0,
        hasActiveBrowserSession,
        lastLoginAttempt: merchant.lastLoginAttempt ?? { status: 'idle' },
        actionMapCount: (merchant.actionMaps ? Object.keys(Object.fromEntries(merchant.actionMaps)).length : 0) + macroCount,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * DELETE /api/v1/automation/session/:merchantId
   * Closes active browser context and clears saved cookies from DB.
   */
  async clearSession(req, res) {
    const { merchantId } = req.params;
    try {
      await browserService.closeSession(merchantId);
      await Merchant.findByIdAndUpdate(merchantId, { $set: { cookies: [] } });
      await browserService.emitLog(merchantId, '🗑️ Session cleared by dashboard user.', 'warning');
      res.status(200).json({ message: 'Session cleared' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

export default new AutomationController();
