import axios from 'axios';

const STANDARD_CREDENTIALS = {
  EMAIL: 'Nobentadeal@gmail.com',
  PASSWORD: 'Mumbai@123',
  PHONE: '7425817074'
};

export class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    // Use gemini-2.0-flash (stable vision model for computer use)
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';
  }

  async analyzePage(screenshotBase64, prompt) {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured in .env');
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

    try {
      const response = await axios.post(`${this.apiUrl}?key=${key}`, payload, {
        timeout: 30000,
      });
      const text = response.data.candidates[0].content.parts[0].text;
      return JSON.parse(text);
    } catch (error) {
      console.error('Gemini API error:', error.response?.data || error.message);
      throw new Error(`Gemini analysis failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async suggestNextAction(screenshotBase64, currentUrl, goal) {
    const prompt = `
You are an AI browser automation agent for Dealora, an e-commerce coupon platform.

GOAL: ${goal}

STANDARD CREDENTIALS (use these when credentials are needed):
- Email: ${STANDARD_CREDENTIALS.EMAIL}
- Password: ${STANDARD_CREDENTIALS.PASSWORD}
- Phone: ${STANDARD_CREDENTIALS.PHONE}

CURRENT URL: ${currentUrl}

Analyze the screenshot carefully and suggest the single best next action to get closer to the goal.

RULES:
1. If you need to fill an email field → action "fill", value "EMAIL"
2. If you need to fill a password field → action "fill", value "PASSWORD"
3. If you need to fill a phone field → action "fill", value "PHONE"
4. If you need to fill an OTP/verification code that the user just provided → action "fill", value "OTP_VALUE"
5. If you need to type other text (name, address, etc.) → action "fill", value "<actual text to type>"
6. If you need to click something → action "click"
7. If the goal is FULLY completed (logged in / account created) → action "done"
8. If the page shows an OTP/2FA/verification code input BEFORE we have the OTP → action "otp_needed"
9. If you detect a CAPTCHA that cannot be solved automatically → action "failed", reason "CAPTCHA detected"
10. If the goal is impossible on this site → action "failed"
11. If you need to create an account or login but are not on the registration/login page, look for 'Login', 'Sign In', 'Register', 'Sign Up', or account icons/menus to find the entry point.
12. If a page is still loading or content is missing → action "wait"

Return ONLY a valid JSON object (no markdown):
{
  "action": "click" | "fill" | "wait" | "done" | "otp_needed" | "failed",
  "element": "<short description of the element to interact with>",
  "value": "<value to fill, or omit if action is click/wait/done/failed>",
  "reason": "<brief explanation of why this action>",
  "x": <center x coordinate 0–1000, required for click/fill>,
  "y": <center y coordinate 0–1000, required for click/fill>
}
    `.trim();

    return await this.analyzePage(screenshotBase64, prompt);
  }
}

export default new GeminiService();
