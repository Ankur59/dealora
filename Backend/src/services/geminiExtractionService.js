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
  "description": "Detailed description of the offer (min 10 chars, max 1000 chars). Should explain the deal clearly",
  "couponCode": "ONLY the alphanumeric coupon code if present (e.g., 'SAVE20', 'WELCOME50'). If no code, use null. Remove phrases like 'Show Code', 'Click Here', 'Reveal Code'",
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
2. couponCode: Extract ONLY alphanumeric codes (A-Z, 0-9). Ignore phrases, text, or descriptions. If you see "SAVE20" or "WELCOME50", extract exactly that. Remove spaces, special chars.
3. couponVisitingLink: Extract ONLY valid URLs. Must start with http:// or https://. Not aggregator homepages. Actual merchant/deal pages.
4. couponDetails: Extract terms, conditions, restrictions, validity info. Should NOT contain coupon codes or URLs. Only terms text.
5. description: Should be a clear, readable description of the offer. Not codes, not URLs, just what the offer is about.
6. expireBy: Parse any date format to YYYY-MM-DD. If date mentions "expires", "valid till", "ends", extract that date.
7. discountType: "50% off" or "50 percent" = percentage, "₹100 off" or "Rs 100 off" = flat, "₹50 cashback" = cashback, "free delivery" = free_delivery, "buy 1 get 1" = buy1get1.
8. If a field value is found in wrong field (e.g., code in title), extract it correctly to the right field.

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
            const result = {
                ...fallbackData,
                ...parsed,
                
                // Clean couponName - remove codes, URLs, dates
                couponName: this.cleanCouponName(parsed.couponName || fallbackData.couponName || fallbackData.couponTitle),
                
                // Clean couponCode - only alphanumeric
                couponCode: this.cleanCouponCode(parsed.couponCode || fallbackData.couponCode),
                
                // Clean couponVisitingLink - only valid URLs
                couponVisitingLink: this.cleanUrl(parsed.couponVisitingLink || fallbackData.couponVisitingLink || fallbackData.couponLink),
                
                // Clean description
                description: this.cleanDescription(parsed.description || fallbackData.description || parsed.couponName || fallbackData.couponTitle),
                
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
                
                // Set useCouponVia based on what we have
                useCouponVia: this.determineUseCouponVia(
                    this.cleanCouponCode(parsed.couponCode || fallbackData.couponCode),
                    this.cleanUrl(parsed.couponVisitingLink || fallbackData.couponVisitingLink || fallbackData.couponLink)
                ),
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
     */
    cleanCouponCode(code) {
        if (!code || typeof code !== 'string') return null;
        
        let cleaned = code.trim().toUpperCase();
        
        // Remove common phrases
        cleaned = cleaned.replace(/(SHOW CODE|CLICK HERE|REVEAL CODE|COPY CODE|GET CODE|CODE:)/gi, '').trim();
        
        // Extract only alphanumeric (remove special chars)
        cleaned = cleaned.replace(/[^A-Z0-9]/g, '');
        
        // Must be between 3-50 characters to be valid
        if (cleaned.length < 3 || cleaned.length > 50) {
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
     * Clean description
     */
    cleanDescription(desc) {
        if (!desc || typeof desc !== 'string') return 'Limited time offer';
        
        let cleaned = desc.trim();
        
        // Remove URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '').trim();
        
        // Remove coupon codes
        cleaned = cleaned.replace(/\b[A-Z0-9]{4,20}\b/g, '').trim();
        
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        // Ensure minimum length
        if (cleaned.length < 10) {
            cleaned = `${cleaned} - Limited time offer`;
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
     */
    determineUseCouponVia(code, link) {
        const hasCode = code && code.length >= 3;
        const hasLink = link && link.startsWith('http');
        
        if (hasCode && hasLink) return 'Both';
        if (hasCode) return 'Coupon Code';
        if (hasLink) return 'Coupon Visiting Link';
        return 'None';
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
