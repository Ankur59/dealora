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

        // Track rate-limited models to avoid retrying them immediately
        this.rateLimitedModels = new Map(); // modelName -> timestamp

        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = null;
            this.workingModelName = null;
            this.enabled = true;
            logger.info('Gemini Extraction Service initialized. Will auto-detect working model on first use.');
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

                logger.info(`Programmatically discovered ${contentModels.length} compatible Gemini models.`);
                return contentModels;
            }
            return [];
        } catch (error) {
            logger.debug(`Dynamic model discovery failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Discover only vision-capable models (excludes text-only models like Gemma)
     */
    async discoverVisionModels() {
        const allModels = await this.discoverModels();
        
        const visionModels = allModels.filter(modelName => {
            const lowerName = modelName.toLowerCase();
            return lowerName.includes('gemini') && !lowerName.includes('gemma');
        });

        logger.info(`Discovered ${visionModels.length} vision-capable models out of ${allModels.length} total.`);
        return visionModels;
    }

    /**
     * Find a working model by trying each one
     */
    async findWorkingModel() {
        if (!this.enabled || this.model) {
            return this.model;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        logger.info(`Initiating Gemini model discovery. Key presence: ${!!apiKey}, Prefix: ${apiKey ? apiKey.substring(0, 5) : 'N/A'}`);

        // 1. Try dynamic discovery first (programmatic fetch)
        const discoveredNames = await this.discoverModels();

        // 2. Prioritize our hardcoded preference list (Gemini 1.5, 2.0)
        // Then add discovered models that weren't in our list
        const candidates = [
            ...this.modelNames,
            ...discoveredNames.filter(name => !this.modelNames.includes(name))
        ];

        // Filter out recently rate-limited models (skip for 60s)
        const now = Date.now();
        const availableCandidates = candidates.filter(name => {
            const limitedTime = this.rateLimitedModels.get(name);
            if (!limitedTime) return true;
            if (now - limitedTime < 60000) { // 60 seconds cooldown
                return false;
            }
            // Remove from rate limit list after cooldown
            this.rateLimitedModels.delete(name);
            return true;
        });

        logger.info(`Trying ${availableCandidates.length} candidate models (${candidates.length - availableCandidates.length} rate-limited, prioritizing preferred ones)...`);

        for (const modelName of availableCandidates) {
            try {
                const testModel = this.genAI.getGenerativeModel({ model: modelName });
                // Test with a simple prompt
                const testResult = await testModel.generateContent('OK');
                await testResult.response;

                // If we get here, the model works!
                this.model = testModel;
                this.workingModelName = modelName;
                logger.info(`Found working Gemini model: ${modelName}`);
                return this.model;
            } catch (error) {
                const errorMsg = error.message || String(error);

                // Specific handling for quota issues (429)
                if (errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('quota')) {
                    logger.warn(`Model ${modelName} rate limited. Marking for cooldown.`);
                    this.rateLimitedModels.set(modelName, Date.now());
                } else {
                    logger.debug(`Model ${modelName} failed detection: ${errorMsg.split('\n')[0]}`);
                }
                continue;
            }
        }

        logger.error(`All available Gemini models failed. This is likely due to invalid API key or exhausted quota.`);
        this.enabled = false;
        return null;
    }

    /**
     * Get next available model when current one is rate-limited
     * @param {string} failedModelName - The model that just failed
     * @param {boolean} visionOnly - If true, only find vision-capable models
     */
    async getNextAvailableModel(failedModelName, visionOnly = false) {
        // Mark the failed model as rate-limited
        if (failedModelName) {
            this.rateLimitedModels.set(failedModelName, Date.now());
            logger.info(`Marked ${failedModelName} as rate-limited. Trying alternative models...`);
        }

        // Reset cached model to force finding a new one
        this.model = null;
        this.workingModelName = null;

        // Try to find another working model
        return visionOnly ? await this.findWorkingVisionModel() : await this.findWorkingModel();
    }

    /**
     * Find a working vision-capable model (for OCR/image tasks)
     */
    async findWorkingVisionModel() {
        if (!this.enabled) return null;

        const apiKey = process.env.GEMINI_API_KEY;
        logger.info(`Finding vision-capable Gemini model. Key presence: ${!!apiKey}`);

        const discoveredVisionModels = await this.discoverVisionModels();

        const visionCandidates = [
            ...this.modelNames,
            ...discoveredVisionModels.filter(name => !this.modelNames.includes(name))
        ];

        const now = Date.now();
        const availableCandidates = visionCandidates.filter(name => {
            const limitedTime = this.rateLimitedModels.get(name);
            if (!limitedTime) return true;
            if (now - limitedTime < 60000) return false;
            this.rateLimitedModels.delete(name);
            return true;
        });

        logger.info(`Trying ${availableCandidates.length} vision-capable models...`);

        for (const modelName of availableCandidates) {
            try {
                const testModel = this.genAI.getGenerativeModel({ model: modelName });
                const testResult = await testModel.generateContent('OK');
                await testResult.response;

                this.model = testModel;
                this.workingModelName = modelName;
                logger.info(`Found working vision model: ${modelName}`);
                return this.model;
            } catch (error) {
                const errorMsg = error.message || String(error);

                if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
                    logger.warn(`Vision model ${modelName} rate limited.`);
                    this.rateLimitedModels.set(modelName, Date.now());
                } else {
                    logger.debug(`Vision model ${modelName} failed: ${errorMsg.split('\n')[0]}`);
                }
                continue;
            }
        }

        logger.error(`No working vision-capable models available.`);
        return null;
    }

    /**
     * Extract and clean only 3 fields using Gemini AI: couponCode, couponDetails, terms
     * All other fields remain untouched from the scraper
     * @param {Object} rawData - Raw scraped coupon data
     * @returns {Promise<Object>} - Data with 3 fields cleaned and standardized
     */
    async extractCouponData(rawData) {
        if (!this.enabled) {
            logger.warn('Gemini extraction disabled. Using local fallback cleaner.');
            return this.fallbackFieldCleaner(rawData);
        }

        // Find working model if not already found
        let model = this.model;
        if (!model) {
            model = await this.findWorkingModel();
            if (!model) {
                logger.warn('No working Gemini model found. Using local fallback cleaner.');
                return this.fallbackFieldCleaner(rawData);
            }
        }

        const prompt = this.buildFocusedCleaningPrompt(rawData);

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse the cleaned 3 fields and merge with original data
            const cleanedData = this.parseCleanedFieldsResponse(text, rawData);

            logger.info(`Gemini (${this.workingModelName}) cleaned 3 fields for: ${rawData.couponTitle || rawData.couponName || 'Unknown'}`);
            return cleanedData;

        } catch (error) {
            const errorMsg = error.message || String(error);

            if (errorMsg.includes('API key')) {
                logger.error('Gemini API key error. Please check your GEMINI_API_KEY environment variable.');
                this.enabled = false;
            } else if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
                logger.warn('Gemini API rate limit/quota exceeded. Using local fallback cleaner.');
                return this.fallbackFieldCleaner(rawData);
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
                        const cleanedData = this.parseCleanedFieldsResponse(retryText, rawData);
                        logger.info(`Gemini (${this.workingModelName}) cleaned 3 fields after switching model`);
                        return cleanedData;
                    } catch (retryError) {
                        logger.error(`Gemini field cleaning failed even after trying new model: ${retryError.message?.split('\n')[0] || retryError}`);
                    }
                }
            } else {
                logger.error(`Gemini field cleaning failed: ${errorMsg.split('\n')[0]}`);
            }

            // Use local fallback cleaner if Gemini fails completely
            logger.warn('Using local fallback cleaner due to Gemini failure.');
            return this.fallbackFieldCleaner(rawData);
        }
    }

    /**
     * Build focused cleaning prompt - only for 3 fields
     */
    buildFocusedCleaningPrompt(rawData) {
        const brandName = rawData.brandName || rawData.brand || 'Brand';
        const couponCode = rawData.couponCode || rawData.code || 'N/A';
        const couponDetails = rawData.couponDetails || rawData.description || rawData.details || 'N/A';
        const terms = rawData.terms || rawData.conditions || 'N/A';

        return `You are a coupon data normalization engine.

Your task is to clean and standardize ONLY these 3 fields:
1. couponCode
2. couponDetails
3. terms

The scraped data may contain:
- Website navigation text
- Festival headings
- Unrelated promotional text
- Repeated offers
- Emoji content
- Garbage values
- UI labels like "View All Offers", "Blog", etc.

You must clean and normalize the data.
Do NOT copy raw text.
Do NOT include unrelated content.
Return structured JSON only.

INPUT DATA:

Brand Name: ${brandName}

Raw Coupon Code:
${couponCode}

Raw Coupon Details:
${couponDetails}

Raw Terms:
${terms}

INSTRUCTIONS:

1. COUPON CODE RULES:
   - FIRST, extract any alphanumeric code from the raw text (4-20 characters).
   - THEN, validate it.
   - Must be alphanumeric only (A-Z, 0-9).
   - Length between 4–20 characters.
   - No spaces.
   - REJECT if the entire raw value is one of these phrases:
     "CODE ACTIVATED"
     "DEAL ACTIVATED"
     "CLICK TO COPY"
     "UNLOCK"
     "GRAB DEAL"
     "GET DEAL"
     "REVEAL CODE"
     "SHOW CODE"
     "NO CODE NEEDED"
     "ACTIVATED"
   - But if the raw value CONTAINS a real code + garbage text (e.g., "PARTY15 - CLICK TO COPY"), extract the code part.
   - If no valid alphanumeric code found → return null.
   - If it is a deal (no code required) → return null.

2. COUPON DETAILS RULES:
   - Write a CLEAN, PROFESSIONAL description.
   - 2–3 lines MAXIMUM.
   - ABSOLUTELY NO EMOJIS (💞 🎉 ❤️ etc).
   - ABSOLUTELY NO navigation text ("Blog", "View All", "Follow Us", etc).
   - ABSOLUTELY NO repeated headings or titles.
   - Remove festival headings ("Valentine's Day", "Diwali Offers", etc).
   - Should clearly and professionally explain:
        • What discount is offered
        • On what product/service
        • Any minimum order (if available)
   - Use ONLY plain text, proper grammar, professional tone.

3. TERMS RULES:
   - Convert into clean bullet points.
   - Maximum 5 bullet points.
   - Short, clear, and professional.
   - ABSOLUTELY NO emojis.
   - ABSOLUTELY NO navigation text ("Blog", "Subscribe", "Follow Us").
   - ABSOLUTELY NO generic phrases ("Terms apply", "Special Offer").
   - Do NOT repeat information from coupon details.
   - Focus on: validity conditions, user eligibility, usage restrictions.
   - If no real terms exist in the raw data, generate 3-5 logical, relevant conditions based on the offer type.
   - Examples of good terms:
        • Valid on party orders only.
        • Minimum order value of ₹348 required.
        • Offer valid for a limited time.
        • Cannot be combined with other promotions.
        • Applicable on selected menu items.

4. Keep format consistent across all coupons.

EXAMPLE:

Input (Messy):
Brand: Box8
Code: PARTY15 - CLICK TO COPY
Details: Valentine's💞 Day! Get flat 15% off. Min ₹348. Blog Subscribe
Terms: 🎉 Offer! View All Terms apply

Expected Output:
{
  "validatedCouponCode": "PARTY15",
  "cleanCouponDetails": "Get flat 15% discount on party orders at Box8. Offer applicable on orders above ₹348 for a limited period.",
  "standardizedTerms": [
    "Valid on party orders only.",
    "Minimum order value of ₹348 required.",
    "Offer valid for a limited time.",
    "Cannot be combined with other promotions.",
    "Applicable on selected menu items."
  ]
}

OUTPUT FORMAT (Return ONLY this JSON, no markdown, no commentary):

{
  "validatedCouponCode": null,
  "cleanCouponDetails": "",
  "standardizedTerms": [
    "",
    "",
    ""
  ]
}`;
    }

    /**
     * Parse Gemini's response for the 3 cleaned fields and merge with original data
     */
    parseCleanedFieldsResponse(text, originalData) {
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
            const cleaned = JSON.parse(jsonString);

            // Validate and apply the cleaned couponCode
            let validatedCode = cleaned.validatedCouponCode;
            if (validatedCode && typeof validatedCode === 'string') {
                validatedCode = validatedCode.trim().toUpperCase();
                // Final validation - must be 4-20 alphanumeric chars
                if (!/^[A-Z0-9]{4,20}$/.test(validatedCode)) {
                    validatedCode = null;
                }
            } else {
                validatedCode = null;
            }

            // Validate cleaned coupon details
            let cleanedDetails = cleaned.cleanCouponDetails;
            if (!cleanedDetails || typeof cleanedDetails !== 'string' || cleanedDetails.trim().length < 10) {
                cleanedDetails = originalData.couponDetails || null;
            } else {
                cleanedDetails = cleanedDetails.trim().substring(0, 2000);
            }

            // Validate standardized terms
            let standardizedTerms = cleaned.standardizedTerms;
            if (Array.isArray(standardizedTerms) && standardizedTerms.length > 0) {
                // Convert array to bullet points string
                const validTerms = standardizedTerms
                    .filter(t => t && typeof t === 'string' && t.trim().length > 0)
                    .map(t => `• ${t.trim()}`)
                    .slice(0, 5); // Max 5 terms
                
                standardizedTerms = validTerms.length > 0 ? validTerms.join('\n') : null;
            } else {
                standardizedTerms = originalData.terms || null;
            }

            // Merge cleaned fields with original data
            const result = {
                ...originalData,
                couponCode: validatedCode,
                couponDetails: cleanedDetails,
                terms: standardizedTerms,
            };

            // Recalculate useCouponVia based on cleaned couponCode and existing link
            const hasCode = validatedCode && validatedCode.length >= 4;
            const hasLink = originalData.couponVisitingLink || originalData.couponLink;
            
            if (hasCode && hasLink) {
                result.useCouponVia = 'Both';
            } else if (hasCode && !hasLink) {
                result.useCouponVia = 'Coupon Code';
            } else if (!hasCode && hasLink) {
                result.useCouponVia = 'Coupon Visiting Link';
            } else {
                result.useCouponVia = 'None';
            }

            logger.info(`Successfully cleaned 3 fields. Code: ${validatedCode || 'null'}, Details length: ${cleanedDetails?.length || 0}, Terms: ${standardizedTerms ? 'Yes' : 'No'}`);
            return result;

        } catch (error) {
            logger.error('Failed to parse Gemini cleaned fields response:', error.message);
            logger.debug('Gemini response text:', text.substring(0, 500));
            // Return original data if parsing fails
            return originalData;
        }
    }

    /**
     * Local fallback cleaner when Gemini is unavailable
     * Does basic cleaning of the 3 fields without AI
     */
    fallbackFieldCleaner(rawData) {
        logger.info('Applying local fallback cleaning for 3 fields...');

        // 1. Clean couponCode
        let cleanedCode = this.localCleanCouponCode(rawData.couponCode || rawData.code);

        // 2. Clean couponDetails
        let cleanedDetails = this.localCleanCouponDetails(rawData.couponDetails || rawData.description || rawData.details);

        // 3. Clean terms
        let cleanedTerms = this.localCleanTerms(rawData.terms || rawData.conditions);

        // Merge with original data
        const result = {
            ...rawData,
            couponCode: cleanedCode,
            couponDetails: cleanedDetails,
            terms: cleanedTerms,
        };

        // Recalculate useCouponVia
        const hasCode = cleanedCode && cleanedCode.length >= 4;
        const hasLink = rawData.couponVisitingLink || rawData.couponLink;
        
        if (hasCode && hasLink) {
            result.useCouponVia = 'Both';
        } else if (hasCode && !hasLink) {
            result.useCouponVia = 'Coupon Code';
        } else if (!hasCode && hasLink) {
            result.useCouponVia = 'Coupon Visiting Link';
        } else {
            result.useCouponVia = 'None';
        }

        logger.info(`Local cleaning applied. Code: ${cleanedCode || 'null'}, Details: ${cleanedDetails ? cleanedDetails.substring(0, 50) + '...' : 'null'}, Terms: ${cleanedTerms ? 'Yes' : 'null'}`);
        return result;
    }

    /**
     * Local coupon code cleaner (no AI)
     */
    localCleanCouponCode(code) {
        if (!code || typeof code !== 'string') return null;

        let cleaned = code.trim().toUpperCase();

        // List of garbage phrases to reject completely
        const garbagePhrasesExact = [
            'CODE ACTIVATED',
            'DEAL ACTIVATED',
            'CLICK TO COPY',
            'UNLOCK',
            'UNLOCKED',
            'GRAB DEAL',
            'GET DEAL',
            'REVEAL CODE',
            'SHOW CODE',
            'NO CODE NEEDED',
            'ACTIVATED',
            'GET CODE',
            'COPY CODE',
            'N/A',
            'NA',
            'NOT APPLICABLE',
        ];

        // Check if the entire value is a garbage phrase
        if (garbagePhrasesExact.includes(cleaned)) {
            return null;
        }

        // List of words that typically appear in garbage codes
        const garbageWords = [
            'UNLOCKED',
            'ACTIVATED',
            'CLICK',
            'COPY',
            'REVEAL',
            'SHOW',
            'UNLOCK',
            'GRAB',
            'GET',
        ];

        // Try to extract a real code by:
        // 1. Split by common separators (space, dash, pipe, etc.)
        // 2. Find the first alphanumeric token that's 4-20 chars and doesn't contain garbage words
        const tokens = cleaned.split(/[\s\-_|:,;.]+/).filter(t => t.length > 0);
        
        for (const token of tokens) {
            // Must be alphanumeric only
            if (!/^[A-Z0-9]+$/.test(token)) continue;
            
            // Must be 4-20 chars
            if (token.length < 4 || token.length > 20) continue;
            
            // Must not be a garbage word
            if (garbagePhrasesExact.includes(token)) continue;
            
            // Must not contain common garbage words
            const hasGarbage = garbageWords.some(word => token.includes(word));
            if (hasGarbage) continue;
            
            // This looks like a valid code
            return token;
        }

        // No valid code found
        return null;
    }

    /**
     * Local coupon details cleaner (no AI)
     */
    localCleanCouponDetails(details) {
        if (!details || typeof details !== 'string') return null;

        let cleaned = details.trim();

        // Remove emojis
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

        // Remove common navigation/UI text patterns
        const uiPatterns = [
            /View All [A-Za-z\s]+ Offers/gi,
            /Speciality Pages/gi,
            /AI Tools/gi,
            /Surge \d+/gi,
            /Blog/gi,
            /Mobile Apps/gi,
            /Product Deals/gi,
            /Charities/gi,
            /Gift Cards/gi,
            /More…/gi,
            /More\.\.\./gi,
            /City Offers/gi,
            /Brand Offers/gi,
            /Bank Offers/gi,
            /Festival Offers/gi,
            /Subscribe/gi,
            /Contact Us/gi,
            /Follow Us/gi,
            /Show Details/gi,
            /Hide Details/gi,
            /Click Here/gi,
            /Get Deal/gi,
            /Grab Now/gi,
            /Shop Now/gi,
        ];

        uiPatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });

        // Remove URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '');

        // Remove excessive whitespace and newlines
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Limit length
        cleaned = cleaned.substring(0, 500);

        // Must have at least 10 chars to be valid
        if (cleaned.length < 10) return null;

        return cleaned;
    }

    /**
     * Local terms cleaner (no AI)
     */
    localCleanTerms(terms) {
        if (!terms || typeof terms !== 'string') return null;

        let cleaned = terms.trim();

        // Remove emojis
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

        // Remove common navigation/UI text patterns (same as details)
        const uiPatterns = [
            /View All [A-Za-z\s]+ Offers/gi,
            /Speciality Pages/gi,
            /AI Tools/gi,
            /Surge \d+/gi,
            /Blog/gi,
            /Mobile Apps/gi,
            /Product Deals/gi,
            /Charities/gi,
            /Gift Cards/gi,
            /More…/gi,
            /More\.\.\./gi,
            /City Offers/gi,
            /Brand Offers/gi,
            /Bank Offers/gi,
            /Festival Offers/gi,
            /Subscribe/gi,
            /Contact Us/gi,
            /Follow Us/gi,
            /Show Details/gi,
            /Hide Details/gi,
        ];

        uiPatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });

        // Remove URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '');

        // Remove generic phrases
        cleaned = cleaned.replace(/Special Offer!?/gi, '');
        cleaned = cleaned.replace(/Limited Time Offer!?/gi, '');

        // Split into sentences/lines and clean each
        const lines = cleaned.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 3);

        // Remove duplicates and keep only meaningful lines
        const uniqueLines = [...new Set(lines)].slice(0, 5);

        // Convert to bullet points if we have valid lines
        if (uniqueLines.length > 0) {
            const bulletPoints = uniqueLines.map(line => `• ${line}`).join('\n');
            return bulletPoints;
        }

        return null;
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
