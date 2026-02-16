const cron = require('node-cron');
const { runScraper } = require('../scraper');
const Coupon = require('../models/Coupon');
const PrivateCoupon = require('../models/PrivateCoupon');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { syncSheet } = require('../controllers/exclusiveCouponController');
const logger = require('../utils/logger');

const initCronJobs = () => {
    // 1. Daily Scraping at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
        logger.info('CRON: Starting daily coupon scraping job...');
        try {
            await runScraper();
            logger.info('CRON: Daily scraping job completed successfully.');
        } catch (error) {
            logger.error('CRON: Scraping job failed:', error);
        }
    });

    // 2. Daily Cleanup of Expired Coupons at 4:00 AM - Remove expired coupons from DB
    cron.schedule('0 4 * * *', async () => {
        logger.info('CRON: Starting daily expired coupons cleanup (removing from DB)...');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to start of today

            const result = await Coupon.deleteMany({
                expireBy: { $lt: today },
                userId: 'system_scraper' // Only remove scraper-created coupons
            });

            logger.info(`CRON: Cleanup completed. Removed ${result.deletedCount} expired coupon(s) from database.`);
        } catch (error) {
            logger.error('CRON: Cleanup job failed:', error);
        }
    });

    // 3. Expiry Notification for Private Coupons - Every 12 hours
    cron.schedule('0 */12 * * *', async () => {
        logger.info('CRON: Starting expiry notification job for private coupons...');
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Find coupons expiring in the next 24 hours
            const expiringCoupons = await PrivateCoupon.find({
                expiryDate: { $gte: now, $lte: tomorrow },
                redeemed: false
            });

            if (expiringCoupons.length === 0) {
                logger.info('CRON: No coupons expiring in the next 24 hours.');
                return;
            }

            logger.info(`CRON: Found ${expiringCoupons.length} expiring coupons. Fetching user tokens...`);

            // Fetch all users with a valid fcmToken
            const users = await User.find({ fcmToken: { $ne: null } }, 'fcmToken');
            const tokens = users.map(u => u.fcmToken).filter(t => !!t);

            if (tokens.length === 0) {
                logger.warn('CRON: No user tokens found. Skipping notifications.');
                return;
            }

            for (const coupon of expiringCoupons) {
                const title = `Coupon Expiring Soon: ${coupon.couponTitle}`;
                const body = `Your ${coupon.brandName} coupon is about to expire. Redeem it soon!`;
                const data = {
                    couponId: coupon._id.toString(),
                    type: 'expiry_alert'
                };

                await notificationService.sendMulticastNotification(tokens, title, body, data);
            }

            logger.info('CRON: Expiry notification job completed.');
        } catch (error) {
            logger.error('CRON: Expiry notification job failed:', error);
    // 3. Google Sheet Sync Every 24 Hours at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
        logger.info('CRON: Starting Google Sheet sync for exclusive coupons...');
        try {
            const result = await syncSheet();
            if (result.success) {
                logger.info(`CRON: Sheet sync completed. ${result.stats?.successCount || 0} coupons synced.`);
            } else {
                logger.error(`CRON: Sheet sync failed: ${result.message}`);
            }
        } catch (error) {
            logger.error('CRON: Sheet sync job failed:', error);
        }
    });

    logger.info('Cron jobs initialized successfully');
};

module.exports = { initCronJobs };
