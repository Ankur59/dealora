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
                    "merchant": "Name of the brand/merchant (e.g., Swiggy, Amazon) this field is required and don't leave this empty",

                    "coupon_title": "Main title of the offer (e.g., 20% OFF on Orders) this field is required don't keep this empty",

                    "coupon_code": "The extracted coupon code if visible (e.g., SWIGGY20). Null if none.",

                    "categoryLabel": "One on the following 'Food', 'Fashion', 'Grocery', 'Wallet Rewards', 'Beauty', 'Travel', 'Entertainment', 'Other'"

                    "couponVisitingLink": "Link which can be used to reedem coupon give null if not available"

                    "useCouponVia": "One of: 'Coupon Code', 'Coupon Visiting Link', 'Both', 'None' according to what method is available for redeeming coupon"

                    "terms":"terms and condition coupon has for redeeming it"

                    "discount_type": "One of: percentage, flat, cashback, unknown",

                    "discount_value": "Numeric value of discount (e.g., 20 for 20%)",

                    "minimum_order_value": "Minimum order amount required (numeric)",

                    "description":"small description for this coupon (Minimum 10 words)"

                    "expiry_date": "Expiry date in YYYY-MM-DD format if visible, else null",

                    "confidence_score": "A number between 0.1 and 1.0 indicating confidence in extraction"

                    "user_type":"for what type of user this coupon is valid for values can be in enum ["new","existing","both"] if nothing is mentioned in coupons give both by default",

                    "websitelink":"Give link for that website without any routes like the home page so user can visit the page (required)"
                }

                Return ONLY the JSON object. Do not include markdown formatting or explanations.
                Give confidence score less than 0.7 if the coupon seems to be invalid but don't give 0
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
                    "merchant": "Name of the brand/merchant (e.g., Swiggy, Amazon) this field is required and don't leave this empty",

                    "description":"Generate a useful description about the coupon don't write anything other than description",

                    "coupon_title": "Main title of the offer (e.g., 20% OFF on Orders) this field is required don't keep this empty",

                    "coupon_code": "The extracted coupon code if visible (e.g., SWIGGY20). Null if none.",

                    "categoryLabel":"One on the following 'Food', 'Fashion',
                    'Grocery', 'Wallet Rewards',
                    'Beauty', 'Travel', 'Entertainment', 'Other'"

                    "couponVisitingLink":"Link which can be used to reedem coupon give null if not available",

                    "useCouponVia":"One of: 'Coupon Code', 'Coupon Visiting Link', 'Both', 'None' according to what method is available for redeeming coupon"

                    "terms":"terms and condition coupon has for redeeming it"

                    "discount_type": "One of: percentage, flat, cashback, unknown",

                    "discount_value": "Numeric value (e.g. 200)",

                    "minimum_order_value": "Minimum order amount (numeric)",

                    "expiry_date": "YYYY-MM-DD format or null",

                    "email_sender": "${sender}",

                    "confidence_score": "Number between 0.0 and 1.0"

                    "user_type":"for what type of user this coupon is valid for values can be in enum ["new","existing","both"] if nothing is mentioned in coupons give both by default",

                    "websitelink":"Give link for that website without any routes like the home page so user can visit the page (required)"
                }
                give confidence_score less than 0.7 if coupon is seems to be invalid so i can reject it
                Return ONLY the JSON object. No markdown.
            `;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            return this.parseResponse(text);

        } catch (error) {
            logger.error('Email Extraction Failed:', error.message);
            throw error;
        }
    }

    /**
     * Enrich a single raw-scraped coupon with fields that are often missing
     * from listing-page scrapes:
     *   - userType   ('new' | 'existing' | 'both')
     *   - websiteLink (brand's direct offer/promo URL, not the scraper source)
     *   - homePage    (brand's root homepage URL)
     *   - minimumOrder (numeric minimum spend, 0 if none)
     *   - terms       (cleaned / improved terms string)
     *
     * Only the fields that are null/missing in the raw coupon are inferred.
     * Existing values are passed-through unchanged.
     *
     * @param {object} rawCoupon - A coupon object as returned by the adapter
     * @returns {Promise<object>} - The same object with enriched fields merged in
     */
    async enrichScrapedCoupon(rawCoupon) {
        try {
            const model = await geminiService.findWorkingModel();
            if (!model) {
                logger.warn('AiExtractionService.enrichScrapedCoupon: No Gemini model available — skipping enrichment');
                return rawCoupon;
            }

            // Build a compact text block from whatever data we have so the AI has context
            const context = [
                `Brand: ${rawCoupon.brandName || 'Unknown'}`,
                `Title: ${rawCoupon.couponTitle || ''}`,
                `Description: ${rawCoupon.description || ''}`,
                `Coupon Code: ${rawCoupon.couponCode || 'N/A'}`,
                `Category: ${rawCoupon.category || 'Unknown'}`,
                `Discount Type: ${rawCoupon.discountType || 'unknown'}`,
                `Discount Value: ${rawCoupon.discountValue || 'N/A'}`,
                `Existing Terms: ${rawCoupon.terms || 'None'}`,
                `Existing Minimum Order: ${rawCoupon.minimumOrder ?? 'Not found'}`,
            ].join('\n');

            const prompt = `
You are a coupon data enrichment assistant. Given the following scraped coupon data, 
extract or infer ONLY the specified fields. Be concise and accurate.

SCRAPED COUPON DATA:
${context}

Return a strictly valid JSON object with EXACTLY these fields:
{
  "userType": "Which user segment this coupon targets. Must be one of: 'new', 'existing', 'both'. Use 'new' only if the offer explicitly says 'new users'. Use 'existing' if it says 'existing users'. Otherwise return 'both'.",
  "websiteLink": "The brand's own website promo/deals URL (e.g. https://www.zomato.com/offers). NOT a GrabOn or coupon-aggregator URL. Return null if unknown.",
  "homePage": "The brand's root homepage URL (e.g. https://www.zomato.com). Return null if unknown.",
  "minimumOrder": "Minimum spend amount as a plain number (e.g. 299). Return 0 if there is no minimum order. Return null ONLY if you cannot determine it at all.",
  "terms": "A clean, concise bullet-point list of the key redemption terms. Each bullet on a new line starting with '•'. If terms already exist in the input and are complete, return them cleaned up. If missing, infer from the title/description. Keep under 300 characters."
}

Rules:
- Return ONLY the JSON object. No markdown, no explanation.
- Do not invent URLs — if genuinely unknown, return null for URL fields.
- minimumOrder must be a NUMBER or null, never a string.
- userType must be exactly one of: 'new', 'existing', 'both'.
`;

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const enriched = this.parseResponse(text);

            // Validate and merge — only overwrite fields that are currently null/missing
            const merged = { ...rawCoupon };

            // userType: only accept valid enum values
            if (!merged.userType && enriched.userType && ['new', 'existing', 'both'].includes(enriched.userType)) {
                merged.userType = enriched.userType;
            }

            // websiteLink: only accept if it looks like a URL and the field is empty
            if (!merged.websiteLink && typeof enriched.websiteLink === 'string' && enriched.websiteLink.startsWith('http')) {
                merged.websiteLink = enriched.websiteLink;
            }

            // homePage: same rules as websiteLink
            if (!merged.homePage && typeof enriched.homePage === 'string' && enriched.homePage.startsWith('http')) {
                merged.homePage = enriched.homePage;
            }

            // minimumOrder: accept numeric values (including 0 which is valid "no minimum")
            if ((merged.minimumOrder === null || merged.minimumOrder === undefined) && typeof enriched.minimumOrder === 'number') {
                merged.minimumOrder = enriched.minimumOrder;
            }

            // terms: only enrich if empty and the AI returned something meaningful
            if (!merged.terms && typeof enriched.terms === 'string' && enriched.terms.trim().length > 5) {
                merged.terms = enriched.terms.trim();
            }

            logger.info(
                `AiExtractionService.enrichScrapedCoupon: Enriched "${rawCoupon.couponTitle}" (${rawCoupon.brandName}) ` +
                `userType=${merged.userType} minOrder=${merged.minimumOrder} hasWebsite=${!!merged.websiteLink}`
            );

            return merged;

        } catch (error) {
            // Enrichment is best-effort — never block the scraper pipeline
            logger.warn(`AiExtractionService.enrichScrapedCoupon: Failed for "${rawCoupon.couponTitle}" — ${error.message}. Returning raw data.`);
            return rawCoupon;
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
