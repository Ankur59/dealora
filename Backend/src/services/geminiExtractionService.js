const { GoogleGenerativeAI } = require('@google/generative-ai');
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
        this.modelNames = [
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-pro',
            'models/gemini-1.5-flash',
            'models/gemini-1.5-pro',
            'models/gemini-pro',
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
     * Find a working model by trying each one
     */
    async findWorkingModel() {
        if (!this.enabled || this.model) {
            return this.model; // Already have a working model
        }

        logger.info(`🔍 Finding working Gemini model from ${this.modelNames.length} options...`);
        
        for (const modelName of this.modelNames) {
            try {
                const testModel = this.genAI.getGenerativeModel({ model: modelName });
                // Test with a simple prompt
                const testResult = await testModel.generateContent('test');
                await testResult.response;
                
                // If we get here, the model works!
                this.model = testModel;
                this.workingModelName = modelName;
                logger.info(`✅ Found working Gemini model: ${modelName}`);
                return this.model;
            } catch (error) {
                logger.debug(`❌ Model ${modelName} failed: ${error.message?.split('\n')[0] || String(error)}`);
                continue;
            }
        }

        logger.error(`❌ All ${this.modelNames.length} Gemini models failed. Disabling Gemini extraction.`);
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

    /**
     * Build detailed extraction prompt for Gemini
     */
    buildExtractionPrompt(rawData) {
        const dataString = JSON.stringify(rawData, null, 2);
        
        return `You are an expert at extracting and segregating coupon/deal information from scraped web data. 

IMPORTANT: Extract ONLY the relevant information. Do NOT mix fields. Each field should contain ONLY its designated content.

Raw scraped data:
${dataString}

Extract and return ONLY a valid JSON object with these EXACT fields (use null if value is not available):

{
  "couponName": "Clean coupon name/title ONLY (max 100 chars). Should NOT contain coupon codes, URLs, or terms. Example: 'Get 50% Off on Electronics'",
  "couponTitle": "Full title/title text (max 200 chars). Similar to couponName but can be longer",
  "description": "Detailed description of the offer by reading the ENTIRE coupon/deal data (min 10 chars, max 1000 chars). Should be DIFFERENT from couponName/couponTitle. Explain what the offer is about, what products/services it applies to, any conditions mentioned. Create a meaningful description from all the available coupon information. DO NOT just copy the title.",
  "couponCode": "ONLY extract if there is a REAL alphanumeric coupon code (e.g., 'SAVE20', 'WELCOME50', 'FLAT50'). Must be a SINGLE WORD/CODE (not a sentence, not text, not the title). If the coupon title or description contains text like 'Get 50% off' or 'Save money' - that is NOT a coupon code. Only extract actual codes like 'SAVE20', 'WELCOME50', etc. If no actual coupon code exists, use null (NOT the title, NOT description text, NOT discount info).",
  "couponVisitingLink": "ONLY the actual merchant/deal URL where coupon can be used (full URL starting with http:// or https://). If no link, use null",
  "expireBy": "Expiry date in YYYY-MM-DD format or null. Parse any date format (e.g., 'expires on 15 Jan 2025', 'valid till 2025-01-15', 'ends Jan 15')",
  "brandName": "Brand name (single word preferred, max 50 chars)",
  "discountType": "ONE of: percentage, flat, cashback, freebie, buy1get1, free_delivery, wallet_upi, prepaid_only, unknown",
  "discountValue": "Discount amount as string or number (e.g., '50', '₹100', '20%')",
  "minimumOrder": "Minimum order value as number or null (e.g., 500, 1000)",
  "categoryLabel": "ONE of: Food, Fashion, Grocery, Travel, Wallet Rewards, Beauty, Entertainment, Electronics, All",
  "couponDetails": "Terms and conditions, restrictions, or important details (max 2000 chars). Should NOT be in other fields",
  "useCouponVia": "ONE of: 'Coupon Code' (if only code), 'Coupon Visiting Link' (if only link), 'Both' (if both), 'None' (if neither)"
}

CRITICAL EXTRACTION RULES:
1. couponName: Extract ONLY the offer title/name. Remove coupon codes, URLs, expiry dates, terms, and special characters. Just the clean name.
2. description: Read and analyze the ENTIRE coupon data (title, discount info, terms, category, all available text). Create a COMPREHENSIVE and MEANINGFUL description that explains what the offer is about, what products/services it applies to, any conditions, and key details. This description MUST be DIFFERENT from couponName/couponTitle. DO NOT just copy the title. DO NOT repeat the title. Read all the coupon information and create a unique description from the entire data. For example, if title is "Get 50% Off", description should be something like "Avail amazing 50% discount on electronics, fashion, and lifestyle products. Valid on minimum purchase. Limited period offer."
3. couponCode: Extract ONLY if there is a REAL alphanumeric coupon code (single word/code like 'SAVE20', 'WELCOME50', 'FLAT50'). Must be A-Z and 0-9 only, typically 3-20 characters, usually one word. IMPORTANT: If you see text like "Get 50% off", "Save money", "Big sale", "Limited offer", "Shop now" - that is NOT a coupon code, use null. Only extract actual coupon codes that look like codes: 'SAVE20', 'WELCOME50', 'FLAT50', 'OFFER100'. If the couponTitle, description, or discountValue contains text but NO actual code, use null. Check the ENTIRE coupon data carefully - if no actual code exists anywhere, use null (NOT the title, NOT description, NOT discount text, NOT brand name).
4. couponVisitingLink: Extract ONLY valid URLs. Must start with http:// or https://. Not aggregator homepages. Actual merchant/deal pages.
5. couponDetails: Extract terms, conditions, restrictions, validity info. Should NOT contain coupon codes or URLs. Only terms text.
6. expireBy: Parse any date format to YYYY-MM-DD. If date mentions "expires", "valid till", "ends", extract that date.
7. discountType: "50% off" or "50 percent" = percentage, "₹100 off" or "Rs 100 off" = flat, "₹50 cashback" = cashback, "free delivery" = free_delivery, "buy 1 get 1" = buy1get1.
8. useCouponVia: Set to "Both" if both couponCode AND couponVisitingLink have values. Set to "Coupon Code" if only couponCode has value (link is null/empty). Set to "Coupon Visiting Link" if only couponVisitingLink has value (code is null/empty). Set to "None" if both are null/empty.
9. If a field value is found in wrong field (e.g., code in title), extract it correctly to the right field.

Return ONLY the JSON object. No markdown code blocks. No explanations. Just pure JSON.`;
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
                
                // Clean couponDetails - terms and conditions only
                couponDetails: this.cleanCouponDetails(parsed.couponDetails || fallbackData.couponDetails || fallbackData.terms),
                
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
        const validCategories = ['Food', 'Fashion', 'Grocery', 'Travel', 'Wallet Rewards', 'Beauty', 'Entertainment', 'Electronics', 'All'];
        if (!category || typeof category !== 'string') return 'All';
        
        const found = validCategories.find(c => c.toLowerCase() === category.toLowerCase());
        return found || 'All';
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
