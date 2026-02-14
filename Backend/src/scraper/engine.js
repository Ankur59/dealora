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
                    logger.warn(`No coupons found for ${adapter.sourceName}. This might mean:`);
                    logger.warn(`   - Website structure changed (selectors don't match)`);
                    logger.warn(`   - Website is blocking scrapers`);
                    logger.warn(`   - Pages are returning 404 or empty responses`);
                    logger.warn(`   - Website requires JavaScript (dynamic content)`);
                } else {
                    logger.info(`${adapter.sourceName} found ${coupons.length} coupons to process`);
                    
                    // Group coupons by brand for batch processing
                    const couponsByBrand = {};
                    coupons.forEach(coupon => {
                        const brand = coupon.brandName || 'Unknown';
                        if (!couponsByBrand[brand]) {
                            couponsByBrand[brand] = [];
                        }
                        couponsByBrand[brand].push(coupon);
                    });
                    
                    logger.info(`${adapter.sourceName}: Processing ${Object.keys(couponsByBrand).length} brands`);
                    
                    // Process each brand's coupons and save to DB immediately
                    for (const [brandName, brandCoupons] of Object.entries(couponsByBrand)) {
                        logger.info(`📦 Processing ${brandCoupons.length} coupons for ${brandName}...`);
                        
                        let brandAdded = 0;
                        let brandUpdated = 0;
                        
                        for (const rawData of brandCoupons) {
                            try {
                                // normalize() is now async due to Gemini integration
                                const normalizedData = await adapter.normalize(rawData);
                                const result = await this.saveOrUpdate(normalizedData);
                                if (result.isNew) {
                                    totalAdded++;
                                    brandAdded++;
                                } else {
                                    totalUpdated++;
                                    brandUpdated++;
                                }
                            } catch (err) {
                                // Extract relevant info for better error logging
                                const couponInfo = rawData.couponTitle || rawData.couponName || 'Unknown Coupon';

                                logger.error(`Error processing coupon from ${adapter.sourceName}: ${couponInfo} (${brandName})`);
                                logger.error(`Error details: ${err.message}`);

                                // Only log raw data in debug mode to avoid cluttering logs
                                if (process.env.LOG_LEVEL === 'debug') {
                                    logger.debug(`Raw data was:`, JSON.stringify(rawData, null, 2).substring(0, 500));
                                }
                            }
                        }
                        
                        logger.info(`✅ ${brandName}: Saved ${brandAdded} new, updated ${brandUpdated} coupons to DB`);
                        
                        // Small delay between brands to avoid overwhelming the system
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error) {
                logger.error(`Failed to scrape ${adapter.sourceName}:`, error.message);
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
                logger.info(`Removed ${result.deletedCount} expired coupon(s) from database`);
            } else {
                logger.info(`No expired coupons found to remove`);
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

        // Check for duplicate terms and couponDetails across same brand
        // to ensure uniqueness
        if (data.terms || data.couponDetails) {
            const duplicateQuery = {
                brandName: data.brandName,
                userId: 'system_scraper',
                $or: []
            };

            // Check if terms are duplicated
            if (data.terms) {
                duplicateQuery.$or.push({ terms: data.terms });
            }

            // Check if couponDetails are duplicated
            if (data.couponDetails) {
                duplicateQuery.$or.push({ couponDetails: data.couponDetails });
            }

            if (duplicateQuery.$or.length > 0) {
                const duplicates = await Coupon.find(duplicateQuery).select('couponTitle terms couponDetails');
                
                if (duplicates.length > 0) {
                    // Found coupons with same terms/details
                    // Check if it's a different coupon (not the one we're updating)
                    const isDifferentCoupon = duplicates.some(dup => 
                        dup.couponTitle !== data.couponTitle
                    );

                    if (isDifferentCoupon) {
                        logger.warn(`Duplicate terms/details detected for ${data.brandName}. Regenerating unique content...`);
                        
                        // Add unique suffix to make terms/details different
                        const timestamp = new Date().getTime().toString().slice(-6);
                        
                        if (data.terms && duplicates.some(d => d.terms === data.terms)) {
                            data.terms = data.terms + '\n• Updated on ' + new Date().toLocaleDateString();
                        }
                        
                        if (data.couponDetails && duplicates.some(d => d.couponDetails === data.couponDetails)) {
                            data.couponDetails = data.couponDetails + ' This offer is updated regularly for the best experience.';
                        }
                        
                        logger.info(`Generated unique terms/details for: ${data.couponTitle}`);
                    }
                }
            }
        }

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
