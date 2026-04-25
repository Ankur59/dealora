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
  const globalId = '000000000000000000000000';

  // 1. Start with hardcoded defaults
  const creds = { ...STANDARD_CREDENTIALS };

  // 2. Load and apply Global overrides
  const globalCustom = await MerchantCredential.find({ merchantId: globalId }).lean();
  applyCustomCreds(creds, globalCustom);

  // 3. Load and apply Merchant-specific overrides (takes precedence)
  const merchantCustom = await MerchantCredential.find({ merchantId }).lean();
  applyCustomCreds(creds, merchantCustom);

  return creds;
}

function applyCustomCreds(creds, customList) {
  for (const c of customList) {
    if (c.credentialType === 'email_password') {
      creds.EMAIL = c.login;
      creds.PASSWORD = c.password;
    } else if (c.credentialType === 'phone_password') {
      creds.PHONE = c.login;
      // We only override the password if we didn't just grab it from email, or if it's explicitly phone_password
      if (!customList.find(x => x.credentialType === 'email_password')) {
        creds.PASSWORD = c.password;
      }
    }
  }
}

/**
 * Mongoose Maps do not support keys containing "." or "$".
 * We replace them with safe placeholders before using them as Map keys.
 */
function sanitizeActionKey(key) {
  return key.replace(/\./g, '__DOT__').replace(/\$/g, '__DOLLAR__');
}

/**
 * Attempts to auto-fill an OTP input and click a submit button
 * after receiving an OTP from the dashboard.
 */
async function attemptPostOTPFill(page, otp, merchantId) {
  const otpSelectors = [
    'input[inputmode="numeric"]',
    'input[type="tel"]',
    'input[name*="otp" i]',
    'input[id*="otp" i]',
    'input[placeholder*="otp" i]',
    'input[placeholder*="code" i]',
    'input[name*="verification" i]',
    'input[id*="verification" i]',
    'input[autocomplete="one-time-code"]',
    'input[maxlength="6"]',
  ];

  let filled = false;
  for (const sel of otpSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await page.fill(sel, otp);
        await browserService.emitLog(merchantId, `Auto-filled OTP into ${sel}`);
        filled = true;
        break;
      }
    } catch (e) {
      // try next selector
    }
  }

  if (!filled) {
    await browserService.emitLog(merchantId, 'Could not auto-detect OTP field; letting AI locate it.', 'warning');
    return false;
  }

  // Try common submit / continue buttons
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Continue")',
    'button:has-text("Submit")',
    'button:has-text("Verify")',
    'button:has-text("Login")',
    'a:has-text("Continue")',
    'a:has-text("Submit")',
    'a:has-text("Verify")',
  ];

  for (const sel of submitSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await page.click(sel);
        await browserService.emitLog(merchantId, `Auto-clicked ${sel}`);
        break;
      }
    } catch (e) {
      // try next selector
    }
  }

  // Give the site time to process the OTP and redirect
  await page.waitForTimeout(4000);
  return true;
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
    res.status(200).json({ success: true, data: { message: 'Automation finished via Macro' } });
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
      const suggestion = await geminiService.suggestNextAction(screenshotBase64, url, finalGoal, activeCreds);

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

        // Emit a high-level notification for the dashboard
        await browserService.emitNotification(merchantId, 'otp_required', 'Verification code requested during automation');

        const otp = await browserService.waitForOTP(merchantId);
        if (otp) {
          context._lastOtp = otp;
          await browserService.emitLog(merchantId, `OTP received: ${otp}. Continuing…`);
          await browserService.saveSession(merchantId, context);
          await browserService.emitLog(merchantId, '🍪 Mid-session cookies saved after OTP.', 'info');
          await Merchant.findByIdAndUpdate(merchantId, {
            'lastLoginAttempt.status': 'running',
          });

          // Try to auto-fill OTP and submit so the AI doesn't get stuck
          const autoFilled = await attemptPostOTPFill(page, otp, merchantId);

          if (autoFilled) {
            // Quick check: if URL changed away from login/otp pages, mark success immediately
            const currentUrl = page.url().toLowerCase();
            const looksLoggedIn =
              !currentUrl.includes('login') &&
              !currentUrl.includes('otp') &&
              !currentUrl.includes('verify') &&
              !currentUrl.includes('auth');

            if (looksLoggedIn) {
              succeeded = true;
              await browserService.saveSession(merchantId, context);
              await browserService.emitLog(merchantId, '✅ Login successful after OTP! Cookies saved.', 'success');
              await Merchant.findByIdAndUpdate(merchantId, {
                'lastLoginAttempt.status': 'success',
                'lastLoginAttempt.message': 'Automation completed successfully after OTP',
              });

              if (currentMacro.length > 0) {
                merchant.automationMacros.set(mode, currentMacro);
                await merchant.save();
                await browserService.emitLog(merchantId, '💾 Saved action sequence as macro for future runs.');
              }
              break;
            }
          }

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
        const actionKey = sanitizeActionKey(`${normalizedUrl}:${suggestion.element}`);
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
      res.status(200).json({ success: true, data: { message: 'Automation finished', automationSuccess: succeeded } });
    }
  } catch (error) {
    console.error('Automation error:', error);
    await browserService.emitLog(merchantId, `🔥 Critical error: ${error.message}`, 'error');
    await Merchant.findByIdAndUpdate(merchantId, {
      'lastLoginAttempt.status': 'failed',
      'lastLoginAttempt.message': error.message,
    }).catch(() => { });
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'merchantId and otp are required' });
    }
    io.emit('otp_provided', { merchantId, otp });
    res.status(200).json({ success: true, data: { message: 'OTP forwarded to automation agent' } });
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
        return res.status(404).json({ success: false, message: 'No active browser session for this merchant. Start an automation first.' });
      }
      await browserService.saveSession(merchantId, context);
      await browserService.emitLog(merchantId, '🍪 Cookies manually saved by dashboard user.', 'success');
      const updated = await Merchant.findById(merchantId).lean();
      res.status(200).json({ success: true, data: { message: 'Session cookies saved', cookieCount: updated?.cookies?.length ?? 0 } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
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
      if (!merchant) return res.status(404).json({ success: false, message: 'Merchant not found' });
      const hasActiveBrowserSession = browserService.contexts.has(merchantId);

      const macroCount = merchant.automationMacros ? Object.keys(Object.fromEntries(merchant.automationMacros)).length : 0;

      res.status(200).json({
        success: true,
        data: {
          merchantId,
          merchantName: merchant.merchantName,
          cookieCount: Array.isArray(merchant.cookies) ? merchant.cookies.length : 0,
          hasSavedCookies: Array.isArray(merchant.cookies) && merchant.cookies.length > 0,
          hasActiveBrowserSession,
          lastLoginAttempt: merchant.lastLoginAttempt ?? { status: 'idle' },
          actionMapCount: (merchant.actionMaps ? Object.keys(Object.fromEntries(merchant.actionMaps)).length : 0) + macroCount,
        }
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
      res.status(200).json({ success: true, data: { message: 'Session cleared' } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export default new AutomationController();
