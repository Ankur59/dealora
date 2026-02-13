const geminiService = require('./geminiExtractionService');
const logger = require('../utils/logger');

class AiExtractionService {

    /**
     * Parse coupon data from an OCR screenshot (Base64 image)
     * @param {string} base64Image - Base64 encoded image string
     * @returns {Promise<Object>} - Structured coupon data
     */
    async extractFromOCR(base64Image) {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const model = await geminiService.findWorkingVisionModel();
                if (!model) {
                    throw new Error('No vision-capable Gemini models available');
                }

                // Remove header if present (e.g., "data:image/jpeg;base64,")
                const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

                const prompt = `
                Analyze this screenshot of a coupon/deal. Extract the following information into a strictly valid JSON object:
                {
                    "merchant": "Name of the brand/merchant (e.g., Swiggy, Amazon)",
                    "coupon_title": "Main title of the offer (e.g., 20% OFF on Orders)",
                    "coupon_code": "The extracted coupon code if visible (e.g., SWIGGY20). Null if none.",
                    "discount_type": "One of: percentage, flat, cashback, freebie, unknown",
                    "discount_value": "Numeric value of discount (e.g., 20 for 20%)",
                    "max_discount": "Maximum discount amount if specified (numeric)",
                    "minimum_order_value": "Minimum order amount required (numeric)",
                    "expiry_date": "Expiry date in YYYY-MM-DD format if visible, else null",
                    "confidence_score": "A number between 0.0 and 1.0 indicating confidence in extraction"
                }

                Return ONLY the JSON object. Do not include markdown formatting or explanations.
            `;

                const imagePart = {
                    inlineData: {
                        data: cleanBase64,
                        mimeType: "image/jpeg"
                    }
                };

                const result = await model.generateContent([prompt, imagePart]);
                const response = await result.response;
                const text = response.text();

                return this.parseResponse(text);

            } catch (error) {
                const errorMsg = error.message || String(error);
                
                // Check if it's a rate limit or model capability error
                const isRateLimit = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Quota');
                const isModelError = errorMsg.includes('modality') || errorMsg.includes('400');
                
                if ((isRateLimit || isModelError) && attempts < maxAttempts - 1) {
                    attempts++;
                    logger.warn(`OCR failed (attempt ${attempts}/${maxAttempts}). Trying alternative vision model...`);
                    
                    const nextModel = await geminiService.getNextAvailableModel(geminiService.workingModelName, true);
                    if (!nextModel) {
                        throw new Error('All vision-capable models unavailable. Try again later.');
                    }
                    
                    continue;
                }
                
                logger.error('OCR Extraction Failed:', error.message);
                throw error;
            }
        }

        throw new Error('OCR extraction failed after maximum retry attempts');
    }

    /**
     * Parse coupon data from email content
     * @param {string} emailContent - The body text of the email
     * @param {string} sender - The sender email address
     * @returns {Promise<Object>} - Structured coupon data
     */
    async extractFromEmail(emailContent, sender) {
        try {
            const model = await geminiService.findWorkingModel();
            if (!model) {
                throw new Error('Gemini AI service is not available');
            }

            const prompt = `
                Analyze this promotional email from "${sender}". Extract coupon details into a strictly valid JSON object:
                
                Email Content:
                ${emailContent.substring(0, 2000)} 
                
                Expected JSON Format:
                {
                    "merchant": "Name of the brand",
                    "coupon_title": "Main offer title",
                    "coupon_code": "The coupon code (e.g. AMAZ200). Null if none.",
                    "discount_type": "One of: percentage, flat, cashback, unknown",
                    "discount_value": "Numeric value (e.g. 200)",
                    "minimum_order_value": "Minimum order amount (numeric)",
                    "expiry_date": "YYYY-MM-DD format or null",
                    "email_sender": "${sender}",
                    "confidence_score": "Number between 0.0 and 1.0"
                }

                Return ONLY the JSON object. No markdown.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return this.parseResponse(text);

        } catch (error) {
            logger.error('Email Extraction Failed:', error.message);
            throw error;
        }
    }

    /**
     * Clean and parse the JSON response from Gemini
     */
    parseResponse(text) {
        try {
            let jsonString = text.trim();
            // Remove markdown code blocks
            jsonString = jsonString.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(jsonString);
            
            // Normalize numeric fields
            if (parsed.discount_value) parsed.discount_value = Number(parsed.discount_value) || 0;
            if (parsed.max_discount) parsed.max_discount = Number(parsed.max_discount) || 0;
            if (parsed.minimum_order_value) parsed.minimum_order_value = Number(parsed.minimum_order_value) || 0;
            
            // Normalize dates
            if (parsed.expiry_date) {
                // Ensure YYYY-MM-DD
                const date = new Date(parsed.expiry_date);
                if (!isNaN(date.getTime())) {
                    parsed.expiry_date = date.toISOString().split('T')[0];
                } else {
                    parsed.expiry_date = null;
                }
            }

            return parsed;
        } catch (error) {
            logger.error('Failed to parse AI JSON:', error);
            throw new Error('Failed to parse AI response');
        }
    }
}

module.exports = new AiExtractionService();
