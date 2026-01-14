const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const logger = require('../utils/logger');

class GeminiExtractionService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            logger.warn('GEMINI_API_KEY not found. Gemini extraction will be disabled.');
            this.enabled = false;
            return;
        }

        // List of Gemini models to try (in order of preference)
        // List of Gemini models to try (in order of preference)
        this.modelNames = [
            'gemini-2.0-flash-exp',
            'models/gemini-2.0-flash-exp',
            'gemini-1.5-flash-latest',
            'models/gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'models/gemini-1.5-flash',
            'gemini-1.5-pro',
            'models/gemini-1.5-pro',
            'gemini-pro-latest',
            'models/gemini-pro-latest',
        ];

        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = null;
            this.workingModelName = null;
            this.enabled = true;
            logger.info('✅ Gemini Extraction Service initialized. Will auto-detect working model on first use.');
        } catch (error) {
            logger.error('Failed to initialize Gemini:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Programmatically discover available Gemini models via REST API.
     */
    async discoverModels() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return [];

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const response = await axios.get(url);

            if (response.data && response.data.models) {
                const contentModels = response.data.models
                    .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''));

                logger.info(`🔍 Programmatically discovered ${contentModels.length} compatible Gemini models.`);
                return contentModels;
            }
            return [];
        } catch (error) {
            logger.debug(`Dynamic model discovery failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Find a working model by trying each one
     */
    async findWorkingModel() {
        if (!this.enabled || this.model) {
            return this.model;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        logger.info(`🔍 Initiating Gemini model discovery. Key presence: ${!!apiKey}, Prefix: ${apiKey ? apiKey.substring(0, 5) : 'N/A'}`);

        // 1. Try dynamic discovery first (programmatic fetch)
        const discoveredNames = await this.discoverModels();

        // 2. Prioritize our hardcoded preference list (Gemini 1.5, 2.0)
        // Then add discovered models that weren't in our list
        const candidates = [
            ...this.modelNames,
            ...discoveredNames.filter(name => !this.modelNames.includes(name))
        ];

        logger.info(`🔍 Trying ${candidates.length} candidate models (prioritizing preferred ones)...`);

        for (const modelName of candidates) {
            try {
                const testModel = this.genAI.getGenerativeModel({ model: modelName });
                // Test with a simple prompt
                const testResult = await testModel.generateContent('OK');
                await testResult.response;

                // If we get here, the model works!
                this.model = testModel;
                this.workingModelName = modelName;
                logger.info(`✅ Found working Gemini model: ${modelName}`);
                return this.model;
            } catch (error) {
                const errorMsg = error.message || String(error);

                // Specific handling for quota issues (429)
                if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
                    logger.error(`🚨 Gemini Quota Exceeded for ${modelName}: Please check your API plan/limits.`);
                } else {
                    logger.debug(`⚠️ Model ${modelName} failed detection: ${errorMsg.split('\n')[0]}`);
                }
                continue;
            }
        }

        logger.error(`❌ All available Gemini models failed. This is likely due to invalid API key or exhausted quota.`);
        this.enabled = false;
        return null;
    }

    /**
     * Extract and segregate coupon data using Gemini AI
     * @param {Object} rawData - Raw scraped coupon data
     * @returns {Promise<Object>} - Properly extracted and segregated coupon data
     */
    async extractCouponData(rawData) {
        if (!this.enabled) {
            logger.warn('Gemini extraction disabled. Using basic normalization.');
            return rawData;
        }

        // Find working model if not already found
        let model = this.model;
        if (!model) {
            model = await this.findWorkingModel();
            if (!model) {
                logger.warn('No working Gemini model found. Using fallback extraction.');
                return rawData;
            }
        }

        const prompt = this.buildExtractionPrompt(rawData);

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse and clean the extracted data
            const extractedData = this.parseGeminiResponse(text, rawData);

            logger.info(`✅ Gemini (${this.workingModelName}) extracted data for: ${extractedData.couponName || rawData.couponTitle || 'Unknown'}`);
            return extractedData;

        } catch (error) {
            const errorMsg = error.message || String(error);

            if (errorMsg.includes('API key')) {
                logger.error('Gemini API key error. Please check your GEMINI_API_KEY environment variable.');
                this.enabled = false;
            } else if (errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
                logger.warn('Gemini API rate limit/quota exceeded. Using fallback extraction.');
            } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
                // Model became unavailable, try to find a new one
                logger.warn(`Model ${this.workingModelName || 'current'} became unavailable. Trying to find a new working model...`);
                this.model = null;
                this.workingModelName = null;
                const newModel = await this.findWorkingModel();
                if (newModel) {
                    // Retry once with new model
                    try {
                        const retryResult = await newModel.generateContent(prompt);
                        const retryResponse = await retryResult.response;
                        const retryText = retryResponse.text();
                        const extractedData = this.parseGeminiResponse(retryText, rawData);
                        logger.info(`✅ Gemini (${this.workingModelName}) extracted data after switching model`);
                        return extractedData;
                    } catch (retryError) {
                        logger.error(`Gemini extraction failed even after trying new model: ${retryError.message?.split('\n')[0] || retryError}`);
                    }
                }
            } else {
                logger.error(`Gemini extraction failed: ${errorMsg.split('\n')[0]}`);
            }

            // Return raw data if Gemini fails - scraping can continue without AI extraction
            return rawData;
        }
    }

    buildExtractionPrompt(rawData) {
        const dataString = JSON.stringify(rawData, null, 2);

        return `You are an expert at extracting and segregating coupon/deal information from scraped web data. Your goal is to transform messy web data into premium, professional-looking coupons.

IMPORTANT: Each field must contain ONLY its designated content. The text should be catchy, professional, and benefit-oriented.

Raw scraped data:
${dataString}

Extract and return ONLY a valid JSON object with these EXACT fields (use null if value is not available):

{
  "couponName": "A catchy, benefit-oriented name. Focus on the main offer (e.g., '50% Off' or '₹200 Cashback'). DO NOT use the example phrases from this prompt.",
  "couponTitle": "A professional marketing title including the brand context (e.g., 'Freshmenu Weekend Special' or 'Limited Time Myntra Offer').",
  "description": "CRAFT a conversationally imaginative summary. TALK like a real person sharing a great find with a friend. BUT: Stay 100% grounded in the facts provided in the raw data. Do NOT invent items (like 'Indian food' for a grocery store unless mentioned). Focus on the REAL value proposition.",
  "couponCode": "ONLY extract if there is a REAL alphanumeric code (e.g., 'SAVE20'). Use null if none. Do NOT use terms or title text here.",
  "couponVisitingLink": "The direct merchant/deal URL. Full URL starting with http:// or https://.",
  "expireBy": "Expiry date in YYYY-MM-DD format or null.",
  "brandName": "Clean brand name (e.g., 'Zomato', 'Amazon'). Max 2 words.",
  "discountType": "ONE of: percentage, flat, cashback, freebie, buy1get1, free_delivery, wallet_upi, prepaid_only, unknown",
  "discountValue": "Numeric or percentage value (e.g., '50', '₹100', '20%').",
  "minimumOrder": "Minimum order value as number or null (e.g., 500).",
  "categoryLabel": "ONE of: Food, Fashion, Grocery, Wallet Rewards, Beauty, Travel, Entertainment, Other",
  "couponDetails": "Step-by-step instructions on how to redeem. Max 2000 chars.",
  "terms": "Detailed Terms & Conditions and eligibility criteria. Max 2000 chars.",
  "useCouponVia": "ONE of: 'Coupon Code', 'Coupon Visiting Link', 'Both', 'None'"
}

CRITICAL QUALITY RULES:
1. TONE: Description MUST be imaginative and conversational. Talk like a friend sharing a great find! BUT do not hallucinate details not in the text.
2. ACCURACY: If the merchant is BigBasket or Blinkit, it is 'Grocery', NOT 'Food'. If it's Zomato or Swiggy, it's 'Food'.
3. CATEGORY MAP: 
   - 'Food': Restaurants, delivery (Zomato, Swiggy, Dominos, KFC).
   - 'Fashion': Clothing, shoes, accessories (Myntra, Ajio, Amazon Fashion, Nykaa Fashion).
   - 'Grocery': Supermarkets, fruits, milk, daily essentials (BigBasket, Blinkit, Amazon Fresh, Zepto).
   - 'Wallet Rewards': ONLY for platform-wide payment rewards (GPay, PhonePe, Cred) that aren't specific to a food/fashion/grocery merchant.
   - 'Beauty': Cosmetics, makeup (Nykaa, Mamaearth).
   - 'Travel': Flights, hotels, cabs (MakeMyTrip, Indigo, Uber).
   - 'Entertainment': Movies, gaming, OTT (BookMyShow, Netflix).
   - 'Other': Everything else.
4. EXAMPLES: Do NOT include the words 'Example', 'Punch', or 'Context' in your JSON values.

Return ONLY the JSON object. No markdown, no commentary.`;
    }

    /**
     * Parse Gemini's JSON response and clean the data
     */
    parseGeminiResponse(text, fallbackData) {
        try {
            // Clean the response text
            let jsonString = text.trim();

            // Remove markdown code blocks if present
            jsonString = jsonString.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

            // Find the first { and last } to extract JSON object
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            }

            // Parse the JSON
            const parsed = JSON.parse(jsonString);

            // Clean and validate each field
            // Clean couponCode first
            const cleanedCode = this.cleanCouponCode(parsed.couponCode || fallbackData.couponCode);
            // Clean couponVisitingLink first
            const cleanedLink = this.cleanUrl(parsed.couponVisitingLink || fallbackData.couponVisitingLink || fallbackData.couponLink);
            // Get title for description comparison
            const title = parsed.couponName || fallbackData.couponName || fallbackData.couponTitle;

            const result = {
                ...fallbackData,
                ...parsed,

                // Clean couponName - remove codes, URLs, dates
                couponName: this.cleanCouponName(title),

                // Clean couponCode - only alphanumeric (must be a real code, not title/description)
                couponCode: cleanedCode,

                // Clean couponVisitingLink - only valid URLs
                couponVisitingLink: cleanedLink,

                // Clean description - make sure it's different from title, read from entire coupon data
                description: this.cleanDescription(
                    parsed.description || fallbackData.description,
                    title
                ),

                // Parse expiry date
                expireBy: this.parseDate(parsed.expireBy || fallbackData.expireBy),

                // Clean couponDetails - redemption instructions
                couponDetails: this.cleanCouponDetails(parsed.couponDetails || fallbackData.couponDetails),

                // Clean terms - T&C and eligibility
                terms: this.cleanTerms(parsed.terms || fallbackData.terms),

                // Clean brandName
                brandName: this.cleanBrandName(parsed.brandName || fallbackData.brandName),

                // Validate discountType
                discountType: this.validateDiscountType(parsed.discountType || fallbackData.discountType),

                // Clean discountValue
                discountValue: parsed.discountValue || fallbackData.discountValue || null,

                // Validate categoryLabel
                categoryLabel: this.validateCategory(parsed.categoryLabel || fallbackData.categoryLabel || fallbackData.category),

                // Set minimumOrder
                minimumOrder: parsed.minimumOrder || fallbackData.minimumOrder || null,

                // Set useCouponVia based on cleaned code and link
                useCouponVia: this.determineUseCouponVia(cleanedCode, cleanedLink),
            };

            return result;

        } catch (error) {
            logger.error('Failed to parse Gemini response:', error.message);
            logger.debug('Gemini response text:', text.substring(0, 500));
            return fallbackData;
        }
    }

    /**
     * Clean coupon name - remove codes, URLs, dates, etc.
     */
    cleanCouponName(name) {
        if (!name || typeof name !== 'string') return 'Exciting Offer';

        let cleaned = name.trim();

        // Remove coupon codes (alphanumeric codes in caps or mixed case)
        cleaned = cleaned.replace(/\b[A-Z0-9]{4,20}\b/g, '').trim();

        // Remove URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '').trim();

        // Remove common phrases
        cleaned = cleaned.replace(/(Show Code|Click Here|Reveal Code|Copy Code|Get Code)/gi, '').trim();

        // Remove dates
        cleaned = cleaned.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '').trim();
        cleaned = cleaned.replace(/\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}/gi, '').trim();

        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Limit length
        cleaned = cleaned.substring(0, 100);

        return cleaned || 'Exciting Offer';
    }

    /**
     * Clean coupon code - only alphanumeric, uppercase
     * Must be a single word/code, not a sentence, title, or description
     */
    cleanCouponCode(code) {
        if (!code || typeof code !== 'string') return null;

        let cleaned = code.trim().toUpperCase();

        // Remove common phrases
        cleaned = cleaned.replace(/(SHOW CODE|CLICK HERE|REVEAL CODE|COPY CODE|GET CODE|CODE:|COUPON CODE:)/gi, '').trim();

        // Extract only alphanumeric (remove special chars, spaces, punctuation, etc.)
        cleaned = cleaned.replace(/[^A-Z0-9]/g, '');

        // Must be between 3-50 characters to be valid coupon code
        if (cleaned.length < 3 || cleaned.length > 50) {
            return null;
        }

        // Check if it looks like actual coupon code (not sentence/text/title)
        // Valid codes are typically: short (3-20 chars), mix of letters and numbers
        // If it's too long (>20 chars), it's likely not a code (might be title/description)
        if (cleaned.length > 20) {
            return null;
        }

        // Check if it has at least one number or one letter (real codes have mix)
        const hasNumber = /[0-9]/.test(cleaned);
        const hasLetter = /[A-Z]/.test(cleaned);

        // Must have at least letters OR numbers
        if (!hasNumber && !hasLetter) {
            return null;
        }

        // If too many vowels (like "AAAAA" or "EEEEE"), likely not a code
        // Codes typically have balanced consonants and vowels
        const vowelCount = (cleaned.match(/[AEIOU]/g) || []).length;
        if (cleaned.length >= 10 && vowelCount / cleaned.length > 0.6) {
            return null;
        }

        return cleaned;
    }

    /**
     * Clean URL - validate it's a proper URL
     */
    cleanUrl(url) {
        if (!url || typeof url !== 'string') return null;

        let cleaned = url.trim();

        // Must start with http:// or https://
        if (!cleaned.match(/^https?:\/\//i)) {
            return null;
        }

        // Basic URL validation
        try {
            new URL(cleaned);
            return cleaned;
        } catch {
            return null;
        }
    }

    /**
     * Clean description - ensure it's different from title, read from entire coupon data
     */
    cleanDescription(desc, title) {
        if (!desc || typeof desc !== 'string' || desc.trim().length === 0) {
            // If no description provided, create a generic one (but don't just copy title)
            return 'Limited time offer. Shop now and save big on your favorite products!';
        }

        let cleaned = desc.trim();

        // If description is same as title (or very similar), reject it and create proper description
        // Description should come from reading the ENTIRE coupon data, not copying title
        if (title && (cleaned.toLowerCase() === title.toLowerCase() || cleaned.toLowerCase() === title.toLowerCase().substring(0, cleaned.length))) {
            // Description was just copied from title - create a meaningful one instead
            cleaned = 'Limited time offer. Shop now and save big on your favorite products!';
        }

        // Remove URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '').trim();

        // Remove coupon codes
        cleaned = cleaned.replace(/\b[A-Z0-9]{4,20}\b/g, '').trim();

        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Ensure minimum length and it's meaningful
        if (cleaned.length < 10) {
            cleaned = `${cleaned} Limited time offer. Shop now and save big!`;
        }

        // If cleaned description is too short or just repeats title, enhance it
        if (title && cleaned.length < 50 && cleaned.toLowerCase().includes(title.toLowerCase().substring(0, 20))) {
            // Too similar to title, create a proper description
            cleaned = 'Limited time offer. Shop now and save big on your favorite products!';
        }

        // Limit length
        cleaned = cleaned.substring(0, 1000);

        return cleaned;
    }

    /**
     * Clean coupon details (terms and conditions)
     */
    cleanCouponDetails(details) {
        if (!details || typeof details !== 'string') return null;

        let cleaned = details.trim();

        // Remove URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '').trim();

        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Limit length
        cleaned = cleaned.substring(0, 2000);

        return cleaned || null;
    }

    /**
     * Clean terms and conditions
     */
    cleanTerms(terms) {
        if (!terms || typeof terms !== 'string') return null;

        let cleaned = terms.trim();

        // Remove URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '').trim();

        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Limit length
        cleaned = cleaned.substring(0, 2000);

        return cleaned || null;
    }

    /**
     * Clean brand name
     */
    cleanBrandName(brand) {
        if (!brand || typeof brand !== 'string') return 'General';

        let cleaned = brand.trim();

        // Take first word only
        cleaned = cleaned.split(' ')[0];

        // Remove special chars
        cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, '');

        // Limit length
        cleaned = cleaned.substring(0, 50);

        return cleaned || 'General';
    }

    /**
     * Validate discount type
     */
    validateDiscountType(type) {
        const validTypes = ['percentage', 'flat', 'cashback', 'freebie', 'buy1get1', 'free_delivery', 'wallet_upi', 'prepaid_only', 'unknown'];
        if (!type || typeof type !== 'string') return 'unknown';

        const lowerType = type.toLowerCase();
        return validTypes.includes(lowerType) ? lowerType : 'unknown';
    }

    /**
     * Validate category
     */
    validateCategory(category) {
        const validCategories = ['Food', 'Fashion', 'Grocery', 'Wallet Rewards', 'Beauty', 'Travel', 'Entertainment', 'Other'];
        if (!category || typeof category !== 'string') return 'Other';

        const found = validCategories.find(c => c.toLowerCase() === category.toLowerCase());
        return found || 'Other';
    }

    /**
     * Determine useCouponVia based on available data
     * Check properly for null/empty values
     */
    determineUseCouponVia(code, link) {
        // Check if code exists and is valid (not null, not empty, not just whitespace)
        const hasCode = code && typeof code === 'string' && code.trim().length >= 3;

        // Check if link exists and is valid URL (not null, not empty, starts with http)
        const hasLink = link && typeof link === 'string' && link.trim().length > 0 && link.trim().startsWith('http');

        // Return based on what we have
        if (hasCode && hasLink) {
            return 'Both';
        } else if (hasCode && !hasLink) {
            return 'Coupon Code';
        } else if (!hasCode && hasLink) {
            return 'Coupon Visiting Link';
        } else {
            return 'None';
        }
    }

    /**
     * Parse date string to Date object
     */
    parseDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;

        try {
            const cleanDate = dateString.trim();

            // Try ISO format first (YYYY-MM-DD)
            if (/^\d{4}-\d{2}-\d{2}/.test(cleanDate)) {
                const date = new Date(cleanDate);
                if (!isNaN(date.getTime()) && date.getFullYear() > 2000 && date.getFullYear() < 2100) {
                    return date;
                }
            }

            // Try parsing directly
            const date = new Date(cleanDate);
            if (!isNaN(date.getTime()) && date.getFullYear() > 2000 && date.getFullYear() < 2100) {
                return date;
            }

            // Try DD/MM/YYYY or MM/DD/YYYY format
            const slashMatch = cleanDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (slashMatch) {
                const [, day, month, year] = slashMatch;
                const date1 = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                if (!isNaN(date1.getTime())) {
                    return date1;
                }
            }

            // Try "DD Mon YYYY" format
            const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const monthMatch = cleanDate.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i);
            if (monthMatch) {
                const [, day, month, year] = monthMatch;
                const monthIndex = monthNames.indexOf(month.toLowerCase());
                if (monthIndex !== -1) {
                    const date2 = new Date(year, monthIndex, parseInt(day));
                    if (!isNaN(date2.getTime())) {
                        return date2;
                    }
                }
            }

            logger.warn(`Could not parse date: ${cleanDate}`);
            return null;
        } catch (error) {
            logger.error('Date parsing error:', error.message);
            return null;
        }
    }
}

// Export singleton instance
module.exports = new GeminiExtractionService();
