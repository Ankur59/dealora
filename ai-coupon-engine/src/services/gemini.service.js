import axios from 'axios';

export class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';
  }

  async analyzePage(screenshotBase64, prompt) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: screenshotBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    try {
      const response = await axios.post(`${this.apiUrl}?key=${this.apiKey}`, payload);
      const text = response.data.candidates[0].content.parts[0].text;
      return JSON.parse(text);
    } catch (error) {
      console.error('Gemini API error:', error.response?.data || error.message);
      throw new Error('Failed to analyze page with Gemini');
    }
  }

  async findElement(screenshotBase64, elementName) {
    const prompt = `
      Analyze this screenshot of a website.
      Find the coordinates (box_2d) and a description of the "${elementName}".
      Return a JSON object with:
      {
        "found": boolean,
        "x": number (center x in 0-1000 scale),
        "y": number (center y in 0-1000 scale),
        "description": string,
        "selector_hint": string (any visible ID, class or text that might help identify it in the DOM)
      }
    `;
    return await this.analyzePage(screenshotBase64, prompt);
  }

  async suggestNextAction(screenshotBase64, currentUrl, goal) {
    const prompt = `
      You are an AI browser automation assistant.
      Goal: ${goal}
      Current URL: ${currentUrl}
      
      Analyze the screenshot and suggest the next best action to reach the goal.
      Possible actions: "click", "fill", "wait", "done", "otp_needed", "failed".
      
      Return a JSON object:
      {
        "action": string,
        "element": string (description of element to interact with),
        "value": string (if filling),
        "reason": string,
        "x": number (if click/fill, center x 0-1000),
        "y": number (if click/fill, center y 0-1000)
      }
    `;
    return await this.analyzePage(screenshotBase64, prompt);
  }
}

export default new GeminiService();
