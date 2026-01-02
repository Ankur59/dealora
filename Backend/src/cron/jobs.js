const cron = require('node-cron');
const { runScraper } = require('../scraper');
const Coupon = require('../models/Coupon');
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

    // 2. Daily Cleanup of Expired Coupons at 4:00 AM
    cron.schedule('0 4 * * *', async () => {
        logger.info('CRON: Starting daily expired coupons cleanup...');
        try {
            const today = new Date();
            const result = await Coupon.updateMany(
                {
                    expireBy: { $lt: today },
                    status: 'active'
                },
                {
                    $set: { status: 'expired' }
                }
            );
            logger.info(`CRON: Cleanup completed. Marked ${result.modifiedCount} coupons as expired.`);
        } catch (error) {
            logger.error('CRON: Cleanup job failed:', error);
        }
    });

    logger.info('Cron jobs initialized successfully');
};

module.exports = { initCronJobs };
