const cron = require('node-cron');
const { runScraper } = require('../scraper');
const Coupon = require('../models/Coupon');
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
