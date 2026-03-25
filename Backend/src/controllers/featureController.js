const axios = require('axios');
const aiExtractionService = require('../services/aiExtractionService');
const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const geminiService = require('../services/geminiExtractionService');
const User = require('../models/User');
const ImportedCoupons = require('../models/ImportedCoupons');


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
        const userDetails = await User.findOne({ uid: userId })
        if (!userDetails) {
            res.status(400).json({ success: false, message: "Invalid user" })
        }
        const user_id = userDetails._id
        // 1. Extract Data
        const extractedData = await aiExtractionService.extractFromOCR(image);

        // 2. Validate Confidence
        if (extractedData.confidence_score && extractedData.confidence_score < 0.70) {
            logger.warn(`Specific validation failed: Low confidence score (${extractedData.confidence_score})`);
            // We can chose to reject or just flag. For now, we proceed but log it.
            return res.status(400).json({
                success: false,
                message: "Invalid coupon"
            })
            // Or return specific warning
        }
        console.log(extractedData.confidence_score)
        // 3. Map to Schema
        // existing Schema fields: brandName, couponName, couponCode, discountType, discountValue, expireBy, etc.
        const newCouponData = {
            userId: user_id,         //|| req.user?.userId || 'system_ocr_user', // Fallback if no auth

            couponName: extractedData.coupon_title || 'OCR Coupon',

            brandName: extractedData.merchant || 'Unknown',

            couponTitle: extractedData.coupon_title || extractedData.merchant || 'OCR Coupon',
            couponCode: extractedData.coupon_code || null,
            discountType: extractedData.discount_type || 'unknown',
            discountValue: extractedData.discount_value,
            minimumOrder: extractedData.minimum_order_value,
            expireBy: extractedData.expiry_date ? new Date(extractedData.expiry_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days if null
            description: extractedData.coupon_title + (extractedData.max_discount ? ` Max Discount: ${extractedData.max_discount}` : ''),
            terms: extractedData.terms || "",
            expireBy: extractedData.expiry_date ? new Date(extractedData.expiry_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days if null

            categoryLabel: extractedData.categoryLabel || 'Other', // Default

            useCouponVia: extractedData.useCouponVia ? extractedData.useCouponVia : 'None',

            discountType: extractedData.discount_type || 'unknown',

            discountValue: extractedData.discount_value,

            minimumOrder: extractedData.minimum_order_value,

            couponCode: extractedData.coupon_code || null,

            couponVisitingLink: extractedData.couponVisitingLink || null,

            source: 'OCR',
            description: extractedData.description,
            status: 'active',

            addedMethod: 'manual', // Since scraped/ocr specific enum isn't there

            userType: extractedData.user_type || "both",
            websiteLink: extractedData.websitelink || "",
        };

        // 4. Schema Validations logic (simple check)
        // Check for duplicates
        if (newCouponData.couponCode) {
            const existing = await ImportedCoupons.findOne({
                couponCode: newCouponData.couponCode,
                brandName: newCouponData.brandName
            });
            if (existing) {
                return res.status(409).json({ success: false, message: 'Duplicate coupon found', data: existing });
            }
        }

        // 5. Save
        const Importedcoupon = new ImportedCoupons(newCouponData);
        await Importedcoupon.save();

        res.status(201).json({
            success: true,
            message: 'Coupon processed from OCR successfully',
            data: Importedcoupon,
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
        let { userId, selectedEmail, accessToken } = req.body;

        const userDetails = await User.findOne({ uid: userId });

        if (!userDetails) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        // userId coming from frontend is uid in the collection so we are fetch the object id of that user here
        const user_Id = userDetails._id

        // If a selectedEmail is provided, find the matching connectedEmail entry
        // and exchange its refreshToken for a fresh access token from Google
        if (selectedEmail) {
            const connectedEmail = userDetails.connectedEmails.find(
                (entry) => entry.email === selectedEmail.toLowerCase().trim()
            );

            if (!connectedEmail) {
                return res.status(404).json({
                    success: false,
                    message: `No connected email found for '${selectedEmail}'. Please link this account first.`
                });
            }

            // Exchange the stored refresh token for a fresh access token
            try {
                const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                    refresh_token: connectedEmail.refreshToken,
                    grant_type: 'refresh_token'
                });

                accessToken = tokenResponse.data.access_token;
                logger.info(`Access token refreshed successfully for ${selectedEmail}`);

                // Update lastSynced for this email
                await User.updateOne(
                    { uid: userId, "connectedEmails.email": selectedEmail.toLowerCase().trim() },
                    { $set: { "connectedEmails.$.lastSynced": new Date() } }
                );
            } catch (tokenErr) {
                logger.error('Failed to refresh access token:', tokenErr.response?.data || tokenErr.message);
                return res.status(401).json({
                    success: false,
                    message: 'Failed to refresh access token. Please re-link your email account.',
                    error: tokenErr.response?.data || tokenErr.message
                });
            }
        }

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
        daysAgo.setDate(daysAgo.getDate() - 15); //Made it 2 from 7 because of api issue
        const dateString = daysAgo.toISOString().split('T')[0].replace(/-/g, '/'); // Format: YYYY/MM/DD

        // Gmail API query: promotional emails from specified date range
        const listParams = {
            maxResults: 20, // DEMO MODE: increased from 20 to 50 for demo purposes
            q: `category:promotions after:${dateString}` // Fetches promotional emails after the calculated date
        };

        console.log('\n' + '='.repeat(60));
        console.log('🔍  DEALORA EMAIL PARSING — DEMO MODE ACTIVE');
        console.log('='.repeat(60));
        console.log(`📅  Scanning promotional emails from last 7 days`);
        console.log(`🔑  Access Token: ${accessToken ? accessToken.substring(0, 15) + '...' : 'N/A'}`);
        console.log('='.repeat(60) + '\n');

        const listResponse = await axios.get(listUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: listParams,
            timeout: 10000 // 10 second timeout for Gmail API
        });
        const messages = listResponse.data.messages || [];
        if (messages.length === 0) {
            console.log('⚠️  No promotional emails found in inbox for the selected date range.\n');
            return res.status(200).json({ success: true, message: 'No promotional emails found', count: 0 });
        }

        console.log(`📬  Found ${messages.length} promotional emails in inbox!`);
        console.log(`🤖  Sending each email to Gemini AI for coupon extraction...\n`);

        // Process all emails sequentially with 30s timeout per email to prevent server hanging
        // DEVELOPER NOTE: Each email is processed one-by-one with timeout protection
        const messagesToProcess = messages;
        logger.info(`Found ${messages.length} messages. Processing all emails one-by-one through AI...`);

        // 2. Fetch full content for each message
        const processedCoupons = [];
        const skipped = [];
        const errors = [];

        let emailIndex = 0;
        for (const msg of messagesToProcess) {
            emailIndex++;
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

                console.log(`\n--- EMAIL [${emailIndex}/${messagesToProcess.length}] ---`);
                console.log(`📧  FROM   : ${sender}`);
                console.log(`📝  SUBJECT: ${subject || '(no subject)'}`);

                // Simple Heuristic Filter: Skip if no coupon keywords
                if (!/discount|off|code|coupon|deal/i.test(fullContent)) {
                    console.log(`⏭️  SKIPPED : No coupon keywords found in this email`);
                    skipped.push(msg.id);
                    continue;
                }

                console.log(`🔍  PARSING: Sending to Gemini AI for coupon extraction...`);

                // Call AI extraction with a 20-second timeout per email.
                // 20 emails × 20 s = 400 s absolute worst-case, well under the
                // global 180 s server timeout for typical workloads.
                try {
                    const aiTimeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('AI extraction timed out after 120s')), 120000)
                    );
                    console.log("this is selected email", selectedEmail)
                    // 
                    const aiWork = processSingleEmailContent(fullContent, selectedEmail, sender, user_Id, true);
                    const couponResult = await Promise.race([aiWork, aiTimeout]);
                    processedCoupons.push(couponResult.data);
                    logger.info(`Successfully extracted coupon from email ${msg.id}`);

                    // ✅ DEMO: Show what was extracted
                    const extracted = couponResult.data;
                    {
                        console.log(`✅  COUPON EXTRACTED!`);
                        console.log(`    🏷️  Brand        : ${extracted.brandName || 'Unknown'}`);
                        console.log(`    🎟️  Coupon Title : ${extracted.couponTitle || extracted.couponName || 'N/A'}`);
                        console.log(`    🔑  Coupon Code  : ${extracted.couponCode || '(no code — deal link)'}`);
                        console.log(`    💰  Discount     : ${extracted.discountType || 'unknown'} — ${extracted.discountValue || 'N/A'}`);
                        console.log(`    📅  Expires      : ${extracted.expireBy ? new Date(extracted.expireBy).toDateString() : 'N/A'}`);
                        console.log(`    📊  Confidence   : ${couponResult.confidence ? (couponResult.confidence * 100).toFixed(0) + '%' : 'N/A'}`);
                    }

                } catch (innerErr) {
                    if (innerErr.status === 409) {
                        console.log(`⚠️  DUPLICATE: Coupon already exists in DB, skipping.`);
                    } else {
                        console.log(`❌  FAILED   : ${innerErr.message}`);
                        logger.warn(`Failed to process email ${msg.id}: ${innerErr.message}`);
                    }
                }

            } catch (err) {
                logger.error(`Error fetching message ${msg.id}: ${err.message}`);
                console.log(`❌  ERROR fetching email ${msg.id}: ${err.message}`);
                errors.push(msg.id);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`📊  PARSING COMPLETE — SUMMARY`);
        console.log('='.repeat(60));
        console.log(`📬  Total Emails Found : ${messages.length}`);
        console.log(`✅  Coupons Extracted  : ${processedCoupons.length}`);
        console.log(`⏭️  Skipped            : ${skipped.length} (no coupon keywords)`);
        console.log(`❌  Errors             : ${errors.length}`);
        console.log('='.repeat(60) + '\n');
        console.log("these are processed coupons", processedCoupons)
        res.status(200).json({
            success: true,
            message: `Found ${messages.length} emails (last 7 days). Processed all ${messagesToProcess.length} emails, extracted ${processedCoupons.length} coupons. ${skipped.length} skipped (no coupon keywords), ${errors.length} errors.`,
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
async function processSingleEmailContent(emailContent, fetchedEmail, sender, userId, skipDuplicateError = false) {
    // 1. Update lastSynced for this email if userId is provided
    if (userId && fetchedEmail) {
        await User.updateOne(
            { uid: userId, "connectedEmails.email": fetchedEmail.toLowerCase().trim() },
            { $set: { "connectedEmails.$.lastSynced": new Date() } }
        );
    }

    // 1. Extract Data
    const extractedData = await aiExtractionService.extractFromEmail(emailContent, sender);
    if (extractedData.confidence_score < 0.7) {
        const err = new Error('Invalid Coupon');
        err.status = 400;
        throw err;
    }

    // 2. Map to Schema
    const newCouponData = {
        userId: userId,
        couponName: extractedData.coupon_title || 'Email Coupon',
        brandName: extractedData.merchant || 'Unknown',
        couponTitle: extractedData.coupon_title || extractedData.merchant || 'Email Coupon',
        description: extractedData.description || "No Description available",
        expireBy: extractedData.expiry_date ? new Date(extractedData.expiry_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        categoryLabel: extractedData.categoryLabel || 'Other',
        fetchedEmail: fetchedEmail,
        useCouponVia: extractedData.useCouponVia,
        discountType: extractedData.discount_type?.toLowerCase() || 'unknown',
        discountValue: extractedData.discount_value,
        minimumOrder: extractedData.minimum_order_value,
        couponCode: extractedData.coupon_code || "N/A",
        couponVisitingLink: extractedData.couponVisitingLink ? extractedData.couponVisitingLink : null,
        source: 'email-parsing',
        // Need to add terms here
        status: 'active',
        addedMethod: 'manual',
        userType: extractedData.user_type || "both",
        websiteLink: extractedData.websitelink || "",
        // expiresIn: computeExpiresIn(
        //     extractedData.expiry_date
        //         ? new Date(extractedData.expiry_date)
        //         : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        // ),
    };

    // 3. Validation & Duplicate Check
    if (newCouponData.couponCode) {
        const existing = await ImportedCoupons.findOne({
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
    const Importedcoupon = new ImportedCoupons(newCouponData);
    await Importedcoupon.save();

    return { data: Importedcoupon, confidence: extractedData.confidence_score };
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
