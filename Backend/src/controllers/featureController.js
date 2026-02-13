const axios = require('axios');
const aiExtractionService = require('../services/aiExtractionService');
const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const geminiService = require('../services/geminiExtractionService');

/**
 * Handle OCR extraction and coupon creation
 */
exports.processScreenshot = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { image, userId } = req.body; // Expecting base64 image string

        if (!image) {
            return res.status(400).json({ success: false, message: 'Image data is required' });
        }

        // 1. Extract Data
        const extractedData = await aiExtractionService.extractFromOCR(image);

        // 2. Validate Confidence
        if (extractedData.confidence_score && extractedData.confidence_score < 0.70) {
            logger.warn(`Specific validation failed: Low confidence score (${extractedData.confidence_score})`);
             // We can chose to reject or just flag. For now, we proceed but log it.
             // Or return specific warning
        }

        // 3. Map to Schema
        // existing Schema fields: brandName, couponName, couponCode, discountType, discountValue, expireBy, etc.
        const newCouponData = {
            userId: userId || req.user?.userId || 'system_ocr_user', // Fallback if no auth
            brandName: extractedData.merchant || 'Unknown',
            couponName: extractedData.coupon_title || 'OCR Coupon',
            couponTitle: extractedData.coupon_title,
            couponCode: extractedData.coupon_code || null,
            discountType: extractedData.discount_type || 'unknown',
            discountValue: extractedData.discount_value,
            minimumOrder: extractedData.minimum_order_value,
            expireBy: extractedData.expiry_date ? new Date(extractedData.expiry_date) : new Date(Date.now() + 30*24*60*60*1000), // Default 30 days if null
            description: extractedData.coupon_title + (extractedData.max_discount ? ` Max Discount: ${extractedData.max_discount}` : ''),
            categoryLabel: 'Other', // Default
            useCouponVia: extractedData.coupon_code ? 'Coupon Code' : 'None',
            sourceWebsite: 'OCR Upload',
            status: 'active',
            addedMethod: 'manual' // Since scraped/ocr specific enum isn't there
        };

        // 4. Schema Validations logic (simple check)
        // Check for duplicates
        if (newCouponData.couponCode) {
            const existing = await Coupon.findOne({ 
                couponCode: newCouponData.couponCode, 
                brandName: newCouponData.brandName 
            });
            if (existing) {
                return res.status(409).json({ success: false, message: 'Duplicate coupon found', data: existing });
            }
        }

        // 5. Save
        const coupon = new Coupon(newCouponData);
        await coupon.save();

        res.status(201).json({
            success: true,
            message: 'Coupon processed from OCR successfully',
            data: coupon,
            confidence: extractedData.confidence_score
        });

    } catch (error) {
        logger.error('OCR Controller Error:', error);
        res.status(500).json({ success: false, message: 'Failed to process screenshot', error: error.message });
    }
};

/**
 * Get history of OCR uploaded coupons
 */
exports.getOcrHistory = async (req, res) => {
    try {
        const coupons = await Coupon.find({ sourceWebsite: 'OCR Upload' })
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.status(200).json({ success: true, count: coupons.length, data: coupons });
    } catch (error) {
        logger.error('OCR History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
};

/**
 * Handle Email extraction and coupon creation (Direct Text)
 */
exports.processEmail = async (req, res) => {
    try {
        const { emailContent, sender, userId } = req.body;
        if (!emailContent) {
            return res.status(400).json({ success: false, message: 'Email content is required' });
        }
        
        const coupon = await processSingleEmailContent(emailContent, sender || 'Unknown', userId);

        res.status(201).json({
            success: true,
            message: 'Coupon processed from Email successfully',
            data: coupon.data,
            confidence: coupon.confidence
        });

    } catch (error) {
        if (error.status === 409) {
             return res.status(409).json({ success: false, message: 'Duplicate coupon found', data: error.existing });
        }
        logger.error('Email Controller Error:', error);
        res.status(500).json({ success: false, message: 'Failed to process email', error: error.message });
    }
};

/**
 * Sync Gmail Endpoint
 */
exports.syncGmail = async (req, res) => {
    try {
        const { accessToken, userId } = req.body;
        if (!accessToken) {
            return res.status(400).json({ success: false, message: 'Access Token is required' });
        }

        // 1. Fetch Lists of Messages from Gmail API
        logger.info('Fetching emails from Gmail API (last 2 days)...');
        const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
        
        // Calculate date range for email fetching
        // DEVELOPER NOTE: To change the date range:
        // Change the number below (e.g., -2 to -10 for last 10 days, -30 for last 30 days)
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - 2); // Currently: last 2 days
        const dateString = daysAgo.toISOString().split('T')[0].replace(/-/g, '/'); // Format: YYYY/MM/DD
        
        // Gmail API query: promotional emails from specified date range
        const listParams = {
            maxResults: 20, // Keep low to avoid rate limits and timeouts on free Gemini tier
            q: `category:promotions after:${dateString}` // Fetches promotional emails after the calculated date
        };
        
        const listResponse = await axios.get(listUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: listParams,
            timeout: 10000 // 10 second timeout for Gmail API
        });

        const messages = listResponse.data.messages || [];
        if (messages.length === 0) {
            return res.status(200).json({ success: true, message: 'No promotional emails found', count: 0 });
        }

        // Process all emails sequentially with 30s timeout per email to prevent server hanging
        // DEVELOPER NOTE: Each email is processed one-by-one with timeout protection
        const messagesToProcess = messages;
        logger.info(`Found ${messages.length} messages. Processing all emails one-by-one through AI...`);

        // 2. Fetch full content for each message
        const processedCoupons = [];
        const skipped = [];
        const errors = [];

        for (const msg of messagesToProcess) {
            try {
                const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
                const msgRes = await axios.get(msgUrl, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                const payload = msgRes.data.payload;
                const headers = payload.headers;
                
                // Get Sender
                const fromHeader = headers.find(h => h.name === 'From');
                const sender = fromHeader ? fromHeader.value : 'Unknown';
                
                // Get Subject
                const subjectHeader = headers.find(h => h.name === 'Subject');
                const subject = subjectHeader ? subjectHeader.value : '';

                // Get Body (Snippet is often enough for simple extraction, but Body is better)
                // Decode body data (Base64Url encoded)
                let body = msgRes.data.snippet; // Fallback to snippet
                
                // Try to find text/plain part
                if (payload.parts) {
                    const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
                    if (textPart && textPart.body.data) {
                        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                    }
                } else if (payload.body && payload.body.data) {
                    body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
                }

                // Combine Subject + Body for better context
                const fullContent = `Subject: ${subject}\nFrom: ${sender}\n\n${body}`;

                // Simple Heuristic Filter: Skip if no coupon keywords
                if (!/discount|off|code|coupon|deal/i.test(fullContent)) {
                    skipped.push(msg.id);
                    continue;
                }

                // Call AI extraction with a 30-second timeout to prevent hanging
                try {
                    const aiTimeout = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('AI extraction timed out after 30s')), 30000)
                    );
                    const aiWork = processSingleEmailContent(fullContent, sender, userId, true);
                    const couponResult = await Promise.race([aiWork, aiTimeout]);
                    processedCoupons.push(couponResult.data);
                    logger.info(`Successfully extracted coupon from email ${msg.id}`);
                } catch (innerErr) {
                    if (innerErr.status !== 409) { // Ignore duplicates silently
                        logger.warn(`Failed to process email ${msg.id}: ${innerErr.message}`);
                    }
                }

            } catch (err) {
                logger.error(`Error fetching message ${msg.id}: ${err.message}`);
                errors.push(msg.id);
            }
        }

        res.status(200).json({
            success: true,
            message: `Found ${messages.length} emails (last 2 days). Processed all ${messagesToProcess.length} emails, extracted ${processedCoupons.length} coupons. ${skipped.length} skipped (no coupon keywords), ${errors.length} errors.`,
            totalFound: messages.length,
            processedCount: messagesToProcess.length,
            extractedCount: processedCoupons.length,
            skippedCount: skipped.length,
            errorCount: errors.length,
            coupons: processedCoupons
        });

    } catch (error) {
        logger.error('Gmail Sync Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Failed to sync gmail', error: error.message });
    }
};

/**
 * Helper to process email content (Shared by Direct & Sync)
 * @param {string} emailContent 
 * @param {string} sender 
 * @param {string} userId
 * @param {boolean} skipDuplicateError - If true, throws specific error object for duplicate, else throws normal error
 */
async function processSingleEmailContent(emailContent, sender, userId, skipDuplicateError = false) {
    // 1. Extract Data
    const extractedData = await aiExtractionService.extractFromEmail(emailContent, sender);

    // 2. Map to Schema
    const newCouponData = {
        userId: userId || 'system_email_user',
        brandName: extractedData.merchant || 'Unknown',
        couponName: extractedData.coupon_title || 'Email Coupon',
        couponTitle: extractedData.coupon_title,
        couponCode: extractedData.coupon_code || null,
        discountType: extractedData.discount_type || 'unknown',
        discountValue: extractedData.discount_value,
        minimumOrder: extractedData.minimum_order_value,
        expireBy: extractedData.expiry_date ? new Date(extractedData.expiry_date) : new Date(Date.now() + 30*24*60*60*1000),
        description: `From Email: ${sender}. ${extractedData.coupon_title}`,
        categoryLabel: 'Other',
        useCouponVia: extractedData.coupon_code ? 'Coupon Code' : 'None',
        sourceWebsite: 'Email Parsing',
        status: 'active',
        addedMethod: 'manual'
    };

    // 3. Validation & Duplicate Check
    if (newCouponData.couponCode) {
        const existing = await Coupon.findOne({ 
            couponCode: newCouponData.couponCode, 
            brandName: newCouponData.brandName 
        });
        if (existing) {
            const err = new Error('Duplicate coupon');
            err.status = 409;
            err.existing = existing;
            throw err;
        }
    }

    // 4. Save
    const coupon = new Coupon(newCouponData);
    await coupon.save();

    return { data: coupon, confidence: extractedData.confidence_score };
}

/**
 * Get history of Email parsed coupons
 */
exports.getEmailHistory = async (req, res) => {
    try {
        const coupons = await Coupon.find({ sourceWebsite: 'Email Parsing' })
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.status(200).json({ success: true, count: coupons.length, data: coupons });
    } catch (error) {
        logger.error('Email History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
};

/**
 * Check AI Status (lightweight - doesn't trigger full model discovery)
 */
exports.getStatus = async (req, res) => {
    try {
        // Use cached model if available, don't trigger full discovery on every status check
        const hasModel = geminiService.model !== null;
        const isEnabled = geminiService.enabled !== false;
        
        res.status(200).json({
            status: isEnabled ? (hasModel ? 'online' : 'initializing') : 'offline',
            service: 'Gemini Vision AI',
            model: geminiService.workingModelName || 'discovering...',
            keyConfigured: !!process.env.GEMINI_API_KEY,
            availableFeatures: ['OCR Screenshot', 'Gmail Sync']
        });
    } catch (error) {
        res.status(503).json({ status: 'error', message: error.message });
    }
};
