const axios = require('axios');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const aiExtractionService = require('../services/aiExtractionService');
const logger = require('../utils/logger');
const ImportedCoupons = require('../models/ImportedCoupons');

/**
 * Run daily sync for all users with linked Gmail accounts
 */
const runDailySync = async () => {
    logger.info('Starting daily Gmail sync for all users...');

    try {
        const users = await User.find({ "connectedEmails.0": { $exists: true } });
        logger.info(`Found ${users.length} users with linked emails.`);

        let totalProcessed = 0;
        let totalEmailsSync = 0;
        let totalRemoved = 0;

        for (const user of users) {
            for (const connectedEmail of user.connectedEmails) {
                totalProcessed++;
                try {
                    await syncIndividualEmail(user.uid, connectedEmail.email, connectedEmail.refreshToken);
                    totalEmailsSync++;
                } catch (error) {
                    if (error.response && (error.response.status === 400 || error.response.status === 401)) {
                        // Likely expired refresh token
                        logger.warn(`Refresh token expired for ${connectedEmail.email} (User: ${user.uid}). Removing email...`);
                        await User.updateOne(
                            { uid: user.uid },
                            { $pull: { connectedEmails: { email: connectedEmail.email } } }
                        );
                        totalRemoved++;
                    } else {
                        logger.error(`Failed to sync ${connectedEmail.email} for ${user.uid}: ${error.message}`);
                    }
                }
            }
        }

        logger.info(`Daily Gmail sync complete. Processed: ${totalProcessed}, Successful: ${totalEmailsSync}, Removed (Expired): ${totalRemoved}`);
        return { totalProcessed, totalEmailsSync, totalRemoved };

    } catch (error) {
        logger.error('Error in runDailySync:', error);
        throw error;
    }
};

/**
 * Sync logic for a single email account
 */
const syncIndividualEmail = async (userId, email, refreshToken) => {
    logger.info(`Syncing ${email} for user ${userId}...`);

    // 1. Get fresh Access Token
    let accessToken;
    try {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        });
        accessToken = tokenResponse.data.access_token;
    } catch (tokenErr) {
        throw tokenErr; // Re-throw to be handled by runDailySync
    }

    // 2. Update lastSynced
    await User.updateOne(
        { uid: userId, "connectedEmails.email": email },
        { $set: { "connectedEmails.$.lastSynced": new Date() } }
    );

    // 3. Fetch Emails (last 7 day for cron)
    const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 7);
    const dateString = yesterday.toISOString().split('T')[0].replace(/-/g, '/');

    const listParams = {
        maxResults: 20, //Maxium limit of email fetched per account
        q: `category:promotions after:${dateString}`
    };

    const listResponse = await axios.get(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: listParams
    });

    const messages = listResponse.data.messages || [];
    if (messages.length === 0) {
        logger.info(`No new emails for ${email}`);
        return;
    }

    for (const msg of messages) {
        try {
            const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
            const msgRes = await axios.get(msgUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            const payload = msgRes.data.payload;
            const headers = payload.headers;
            const fromHeader = headers.find(h => h.name === 'From');
            const sender = fromHeader ? fromHeader.value : 'Unknown';
            const subjectHeader = headers.find(h => h.name === 'Subject');
            const subject = subjectHeader ? subjectHeader.value : '';

            let body = msgRes.data.snippet;
            if (payload.parts) {
                const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
                if (textPart && textPart.body.data) {
                    body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                }
            } else if (payload.body && payload.body.data) {
                body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
            }

            const fullContent = `Subject: ${subject}\nFrom: ${sender}\n\n${body}`;

            if (!/discount|off|code|coupon|deal/i.test(fullContent)) {
                continue;
            }

            // Extract using AI
            const extractedData = await aiExtractionService.extractFromEmail(fullContent, sender);
            if (extractedData.confidence_score < 0.7) {
                const err = new Error('Invalid Coupon');
                err.status = 400;
                throw err;
            }
            // Map to Schema
            const newCouponData = {
                userId: userId,
                couponName: extractedData.coupon_title || 'Email Coupon',
                brandName: extractedData.merchant || 'Unknown',
                couponTitle: extractedData.coupon_title || extractedData.merchant || 'Email Coupon',
                description: `From Email: ${sender}. ${extractedData.coupon_title}`,
                expireBy: extractedData.expiry_date ? new Date(extractedData.expiry_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                categoryLabel: extractedData.categoryLabel || 'Other',
                fetchedEmail: email,
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
                userType: extractedData.user_type || "both"
            };

            // Duplicate Check
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

            // Save
            // 4. Save
            const Importedcoupon = new ImportedCoupons(newCouponData);
            await Importedcoupon.save();
            logger.info(`Saved coupon from ${email}: ${newCouponData.couponTitle}`);

        } catch (err) {
            logger.error(`Error processing message ${msg.id} for ${email}: ${err.message}`);
        }
    }
};

module.exports = { runDailySync };
