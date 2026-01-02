const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');

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

                for (const rawData of coupons) {
                    try {
                        const normalizedData = adapter.normalize(rawData);
                        const result = await this.saveOrUpdate(normalizedData);
                        if (result.isNew) totalAdded++;
                        else totalUpdated++;
                    } catch (err) {
                        logger.error(`Error processing coupon from ${adapter.sourceName}:`, err.message);
                    }
                }
            } catch (error) {
                logger.error(`Failed to scrape ${adapter.sourceName}:`, error.message);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        logger.info(`Scraping completed. Added: ${totalAdded}, Updated: ${totalUpdated}`);
        return { totalAdded, totalUpdated };
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
