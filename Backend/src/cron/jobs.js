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

    // 2. Cleanup expired scraper coupons at 4 AM
    cron.schedule('0 4 * * *', async () => {
        logger.info('CRON: Starting daily expired coupons cleanup...');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const result = await Coupon.deleteMany({
                expireBy: { $lt: today },
                userId: 'system_scraper'
            });

            logger.info(`CRON: Removed ${result.deletedCount} expired coupons.`);
        } catch (error) {
            logger.error('CRON: Cleanup job failed:', error);
        }
    });

    // 3. Expiry notifications every 12 hours
    cron.schedule('0 */12 * * *', async () => {
        logger.info('CRON: Starting expiry notification job...');
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const expiringCoupons = await PrivateCoupon.find({
                expiryDate: { $gte: now, $lte: tomorrow },
                redeemed: false
            });

            if (!expiringCoupons.length) {
                logger.info('CRON: No expiring coupons.');
                return;
            }

            const users = await User.find({ fcmToken: { $ne: null } }, 'fcmToken');
            const tokens = users.map(u => u.fcmToken).filter(Boolean);

            if (!tokens.length) {
                logger.warn('CRON: No tokens found.');
                return;
            }

            for (const coupon of expiringCoupons) {
                const title = `Coupon Expiring Soon: ${coupon.couponTitle}`;
                const body = `Your ${coupon.brandName} coupon is about to expire.`;
                const data = {
                    couponId: coupon._id.toString(),
                    type: 'expiry_alert'
                };

                await notificationService.sendMulticastNotification(tokens, title, body, data);
            }

            logger.info('CRON: Expiry notifications sent.');
        } catch (error) {
            logger.error('CRON: Expiry notification job failed:', error);
        }
    });

    // 4. Google Sheet sync at 3 AM
    cron.schedule('0 3 * * *', async () => {
        logger.info('CRON: Starting Google Sheet sync...');
        try {
            const result = await syncSheet();
            if (result.success) {
                logger.info(`CRON: Sheet sync completed. ${result.stats?.successCount || 0} synced.`);
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
