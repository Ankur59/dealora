const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');
const { generateCouponImage } = require('../services/couponImageService');
const { addDisplayFields } = require('../utils/couponHelpers');

class ScraperEngine {
    constructor(adapters = []) {
        this.adapters = adapters;
    }

    async runAll() {
        logger.info(`Starting scraping for ${this.adapters.length} sources...`);
        let totalAdded = 0;
        let totalUpdated = 0;

        for (const adapter of this.adapters) {
            try {
                logger.info(`Scraping source: ${adapter.sourceName}`);
                const coupons = await adapter.scrape();
                
                if (!coupons || coupons.length === 0) {
                    logger.warn(`⚠️ No coupons found for ${adapter.sourceName}. This might mean:`);
                    logger.warn(`   - Website structure changed (selectors don't match)`);
                    logger.warn(`   - Website is blocking scrapers`);
                    logger.warn(`   - Pages are returning 404 or empty responses`);
                    logger.warn(`   - Website requires JavaScript (dynamic content)`);
                } else {
                    logger.info(`✅ ${adapter.sourceName} found ${coupons.length} coupons to process`);
                }

                for (const rawData of coupons) {
                    try {
                        // normalize() is now async due to Gemini integration
                        const normalizedData = await adapter.normalize(rawData);
                        const result = await this.saveOrUpdate(normalizedData);
                        if (result.isNew) totalAdded++;
                        else totalUpdated++;
                    } catch (err) {
                        // Extract relevant info for better error logging
                        const couponInfo = rawData.couponTitle || rawData.couponName || 'Unknown Coupon';
                        const brandInfo = rawData.brandName || 'Unknown Brand';
                        
                        logger.error(`Error processing coupon from ${adapter.sourceName}: ${couponInfo} (${brandInfo})`);
                        logger.error(`Error details: ${err.message}`);
                        
                        // Only log raw data in debug mode to avoid cluttering logs
                        if (process.env.LOG_LEVEL === 'debug') {
                            logger.debug(`Raw data was:`, JSON.stringify(rawData, null, 2).substring(0, 500));
                        }
                    }
                }
            } catch (error) {
                logger.error(`❌ Failed to scrape ${adapter.sourceName}:`, error.message);
                logger.error(`Stack trace:`, error.stack);
                // Continue with next adapter even if one fails completely
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        logger.info(`Scraping completed. Added: ${totalAdded}, Updated: ${totalUpdated}`);
        
        // Clean up expired coupons after scraping
        await this.removeExpiredCoupons();
        
        return { totalAdded, totalUpdated };
    }

    /**
     * Remove expired coupons from the database automatically
     */
    async removeExpiredCoupons() {
        try {
            const now = new Date();
            // Set to start of today to catch all coupons that expired today
            now.setHours(0, 0, 0, 0);
            
            const result = await Coupon.deleteMany({
                expireBy: { $lt: now },
                userId: 'system_scraper' // Only remove scraper-created coupons
            });
            
            if (result.deletedCount > 0) {
                logger.info(`🗑️  Removed ${result.deletedCount} expired coupon(s) from database`);
            } else {
                logger.info(`✅ No expired coupons found to remove`);
            }
            
            return result.deletedCount;
        } catch (error) {
            logger.error(`Error removing expired coupons:`, error.message);
            return 0;
        }
    }

    async saveOrUpdate(data) {
        let query = { brandName: data.brandName };

        if (data.couponCode) {
            query.couponCode = data.couponCode;
        } else {
            query.couponTitle = data.couponTitle;
            query.expireBy = {
                $gte: new Date(new Date(data.expireBy).setHours(0, 0, 0, 0)),
                $lte: new Date(new Date(data.expireBy).setHours(23, 59, 59, 999))
            };
        }

        // We use userId = 'system_scraper' for all scraped coupons to identify them
        data.userId = 'system_scraper';

        const existing = await Coupon.findOne(query);

        // Generate base64 image for the coupon
        try {
            const couponWithDisplay = addDisplayFields(data);
            const imageBase64 = await generateCouponImage(couponWithDisplay);
            data.base64ImageUrl = `data:image/png;base64,${imageBase64}`;
            logger.info(`Generated base64 image for coupon: ${data.couponName || data.couponTitle}`);
        } catch (error) {
            logger.error(`Failed to generate base64 image for coupon: ${data.couponName || data.couponTitle}`, error.message);
            // Continue without base64 image if generation fails
            data.base64ImageUrl = null;
        }

        if (existing) {
            // Update existing if it's more recent or has changes (simple update for now)
            Object.assign(existing, data);
            await existing.save();
            return { isNew: false };
        } else {
            await Coupon.create(data);
            return { isNew: true };
        }
    }
}

module.exports = ScraperEngine;
