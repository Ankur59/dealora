import browserService from '../services/browser.service.js';
import geminiService from '../services/gemini.service.js';
import Merchant from '../models/merchant.model.js';
import { io } from '../index.js';

const STANDARD_CREDENTIALS = {
  EMAIL: 'Nobentadeal@gmail.com',
  PASSWORD: 'Mumbai@123',
  PHONE: '7425817074'
};

export class AutomationController {
  async loginToMerchant(req, res) {
    const { merchantId } = req.params;
    const { goal = 'Login to account' } = req.body;

    try {
      const { page, context, merchant } = await browserService.getPageWithSession(merchantId);
      if (!merchant.actionMaps) merchant.actionMaps = new Map();

      await browserService.emitLog(merchantId, `Starting automation for ${merchant.merchantName}...`);

      await page.goto(merchant.website, { waitUntil: 'networkidle' });
      
      let attempts = 0;
      const maxAttempts = 20;

      while (attempts < maxAttempts) {
        attempts++;
        const url = page.url();
        const screenshot = await page.screenshot({ type: 'png', fullPage: false });
        const screenshotBase64 = screenshot.toString('base64');

        await browserService.emitLog(merchantId, `Analyzing page state (Attempt ${attempts})...`);
        const suggestion = await geminiService.suggestNextAction(screenshotBase64, url, goal);

        await browserService.emitLog(merchantId, `AI Suggestion: ${suggestion.action} - ${suggestion.reason}`);

        if (suggestion.action === 'done') {
          await browserService.emitLog(merchantId, 'Goal achieved!', 'success');
          await browserService.saveSession(merchantId, context);
          break;
        }

        if (suggestion.action === 'failed') {
          await browserService.emitLog(merchantId, `Goal failed: ${suggestion.reason}`, 'error');
          break;
        }

        if (suggestion.action === 'otp_needed') {
          const otp = await browserService.waitForOTP(merchantId);
          if (otp) {
            await browserService.emitLog(merchantId, `OTP received, continuing...`);
            continue; 
          } else {
            await browserService.emitLog(merchantId, 'OTP timeout/cancelled', 'error');
            break;
          }
        }

        if (suggestion.action === 'click' || suggestion.action === 'fill') {
          // Normalize URL for mapping (remove query params/hash)
          const normalizedUrl = new URL(url).pathname;
          const actionKey = `${normalizedUrl}:${suggestion.element}`;
          let selector = merchant.actionMaps.get(actionKey);

          if (!selector && suggestion.x && suggestion.y) {
            const viewport = page.viewportSize();
            const x = (suggestion.x / 1000) * viewport.width;
            const y = (suggestion.y / 1000) * viewport.height;

            const element = await page.evaluateHandle(([x, y]) => {
              return document.elementFromPoint(x, y);
            }, [x, y]);

            if (element) {
              selector = await browserService.getUniqueSelector(page, element);
              if (selector) {
                merchant.actionMaps.set(actionKey, selector);
                await merchant.save();
                await browserService.emitLog(merchantId, `Mapped new selector: ${suggestion.element} -> ${selector}`);
              }
            }
          }

          try {
            if (suggestion.action === 'fill') {
              const val = suggestion.value === 'PASSWORD' ? STANDARD_CREDENTIALS.PASSWORD : 
                          suggestion.value === 'EMAIL' ? STANDARD_CREDENTIALS.EMAIL : 
                          suggestion.value === 'PHONE' ? STANDARD_CREDENTIALS.PHONE : suggestion.value;
              
              if (selector) {
                await page.fill(selector, val);
              } else if (suggestion.x && suggestion.y) {
                const x = (suggestion.x / 1000) * page.viewportSize().width;
                const y = (suggestion.y / 1000) * page.viewportSize().height;
                await page.mouse.click(x, y);
                await page.keyboard.type(val);
              }
            } else {
              if (selector) {
                await page.click(selector);
              } else if (suggestion.x && suggestion.y) {
                const x = (suggestion.x / 1000) * page.viewportSize().width;
                const y = (suggestion.y / 1000) * page.viewportSize().height;
                await page.mouse.click(x, y);
              }
            }
          } catch (err) {
            await browserService.emitLog(merchantId, `Action failed: ${err.message}. Retrying...`, 'warning');
            if (selector) {
              merchant.actionMaps.delete(actionKey);
              await merchant.save();
            }
          }
        }

        await page.waitForTimeout(2000);
      }

      res.status(200).json({ message: 'Automation finished' });
    } catch (error) {
      console.error('Automation error:', error);
      await browserService.emitLog(merchantId, `Critical error: ${error.message}`, 'error');
      res.status(500).json({ error: error.message });
    }
  }

  async provideOTP(req, res) {
    const { merchantId, otp } = req.body;
    io.emit('otp_provided', { merchantId, otp });
    res.status(200).json({ message: 'OTP sent to automation' });
  }
}

export default new AutomationController();
