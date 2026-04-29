import axios from 'axios';

// Default credentials - can be overridden per-merchant
export const DEFAULT_CREDENTIALS = {
  EMAIL: 'Nobentadeal@gmail.com',
  PASSWORD: 'Mumbai@123',
  PHONE: '7425817074'
};

export class GeminiService {
  constructor() {
    this.apiKeys = this.loadApiKeys();
    this.currentKeyIndex = 0;
    this.validatedKeys = new Set();
    // gemini-3-flash-preview is a valid experimental model
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';
  }

  loadApiKeys() {
    let keys = [];
    if (process.env.GEMINI_API_KEYS) {
      keys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim().replace(/['"]/g, '')).filter(Boolean);
    } else if (process.env.GEMINI_API_KEY) {
      keys = [process.env.GEMINI_API_KEY];
    }
    return keys;
  }

  getCurrentKey() {
    // Reload in case keys were added without restart
    if (this.apiKeys.length === 0) {
      this.apiKeys = this.loadApiKeys();
    }
    if (this.apiKeys.length === 0) return null;
    return this.apiKeys[this.currentKeyIndex];
  }

  rotateKey() {
    if (this.apiKeys.length > 0) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      console.log(`Rotated to Gemini API key index ${this.currentKeyIndex}`);
    }
  }

  async validateKey(key) {
    if (this.validatedKeys.has(key)) return true;
    try {
      await axios.post(`${this.apiUrl}?key=${key}`, {
        contents: [{ parts: [{ text: 'Hi' }] }],
      }, { timeout: 10000 });
      this.validatedKeys.add(key);
      return true;
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
        return false;
      }
      // Unknown error, still count as invalid for safety
      return false;
    }
  }

  async analyzePage(screenshotBase64, prompt) {
    let key = this.getCurrentKey();
    if (!key) {
      throw new Error('No GEMINI_API_KEYS configured in .env. Please add GEMINI_API_KEY or GEMINI_API_KEYS to your environment.');
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: screenshotBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    let attempts = 0;
    const maxAttempts = Math.max(1, this.apiKeys.length);

    while (attempts < maxAttempts) {
      key = this.getCurrentKey();
      const isValid = await this.validateKey(key);
      if (!isValid) {
        console.error(`Gemini key index ${this.currentKeyIndex} is INVALID (auth/quota). Skipping...`);
        this.rotateKey();
        attempts++;
        continue;
      }

      try {
        const response = await axios.post(`${this.apiUrl}?key=${key}`, payload, {
          timeout: 30000,
        });
        const text = response.data.candidates[0].content.parts[0].text;
        return JSON.parse(text);
      } catch (error) {
        const status = error.response?.status;
        const errData = error.response?.data?.error;
        const errMsg = errData?.message || error.message;

        console.error(`Gemini API error (key idx ${this.currentKeyIndex}, status ${status}):`, errData || error.message);

        // If it's an auth error, invalidate this key
        if (status === 400 || status === 401 || status === 403) {
          this.validatedKeys.delete(key);
        }

        this.rotateKey();
        attempts++;

        if (attempts >= maxAttempts) {
          if (status === 400 || status === 401 || status === 403) {
            throw new Error(`All Gemini API keys are invalid or expired. Please check your GEMINI_API_KEYS in .env. Last error: ${errMsg}`);
          }
          throw new Error(`Gemini analysis failed after trying all keys: ${errMsg}`);
        }
      }
    }
  }

  async suggestNextAction(screenshotBase64, currentUrl, goal, credentials = DEFAULT_CREDENTIALS) {
    // Merge provided credentials with defaults
    const creds = { ...DEFAULT_CREDENTIALS, ...credentials };

    // Explicitly check for common global overrides if not provided specifically
    // Note: The controller already does this hierarchy check, but we keep this as a safety fallback.

    const prompt = `
You are an AI browser automation agent for Dealora, an e-commerce coupon platform.

GOAL: ${goal}

STANDARD CREDENTIALS (use these for ALL login/registration fields unless specific ones are found):
- Email: ${creds.EMAIL}
- Password: ${creds.PASSWORD}
- Phone: ${creds.PHONE}

CURRENT URL: ${currentUrl}

Analyze the screenshot carefully and suggest the single best next action to get closer to the goal.

RULES:
1. If you need to fill an email field → action "fill", value "EMAIL" (will use ${creds.EMAIL})
2. If you need to fill a password field → action "fill", value "PASSWORD" (will use ${creds.PASSWORD})
3. If you need to fill a phone field → action "fill", value "PHONE" (will use ${creds.PHONE})
4. If you need to fill an OTP/verification code that the user just provided → action "fill", value "OTP_VALUE"
5. If you need to type other text (name, address, etc.) → action "fill", value "<actual text to type>"
6. If you need to click something → action "click"
7. If the goal is FULLY completed (logged in / account created) → action "done"
8. If the page shows an OTP/2FA/verification code input BEFORE we have the OTP → action "otp_needed"
9. If you detect a CAPTCHA that cannot be solved automatically → action "failed", reason "CAPTCHA detected"
10. If the goal is impossible on this site → action "failed"
11. If you need to create an account or login but are not on the registration/login page, look for 'Login', 'Sign In', 'Register', 'Sign Up', or account icons/menus to find the entry point.
12. If a page has a "Apply Coupon" or "Have a promo code?" section that needs to be clicked/expanded to reveal the input field, click that section first.
13. If a page is still loading or content is missing → action "wait"
14. If the page shows a 403 error, "access denied", "request blocked", or any bot/security detection page → action "blocked" (NOT "failed" — the system will retry with a different browser fingerprint)

Return ONLY a valid JSON object (no markdown):
{
  "action": "click" | "fill" | "wait" | "done" | "otp_needed" | "failed" | "blocked",
  "element": "<short description of the element to interact with>",
  "value": "EMAIL" | "PASSWORD" | "PHONE" | "OTP_VALUE" | "<other text>",
  "reason": "<brief explanation of why this action>",
  "x": <center x coordinate 0–1000, required for click/fill>,
  "y": <center y coordinate 0–1000, required for click/fill>
}
    `.trim();
    return await this.analyzePage(screenshotBase64, prompt);
  }

  /**
   * Specifically for analyzing coupon terms and conditions from a screenshot or text.
   */
  async analyzeTermsAndConditions(screenshotBase64, description) {
    const prompt = `
Analyze this e-commerce coupon and its description: "${description}"
Identify requirements to make it work:
1. Minimum order value (numeric)
2. Categories applicable
3. Excluded items
Return JSON:
{
  "minOrderValue": number,
  "applicableCategories": string[],
  "excludedProducts": string[],
  "userTypes": string[]
}
    `.trim();
    return await this.analyzePage(screenshotBase64, prompt);
  }

  /**
   * Suggests how to prepare the cart to meet coupon requirements.
   */
  async suggestCartActions(screenshotBase64, terms) {
    const prompt = `
The cart needs to meet these terms: ${JSON.stringify(terms)}
Look at the screenshot and suggest the next action to add necessary items to cart.
Return JSON:
{
  "action": "add_item" | "navigate" | "done",
  "reason": "explanation",
  "x": number,
  "y": number
}
    `.trim();
    return await this.analyzePage(screenshotBase64, prompt);
  }
}

export default new GeminiService();
