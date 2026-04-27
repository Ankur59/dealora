const Coupon = require('../models/Coupon');
const RawScrapedCoupon = require('../models/RawScrapedCoupon');
const logger = require('../utils/logger');
const { generateCouponImage } = require('../services/couponImageService');
const { addDisplayFields } = require('../utils/couponHelpers');
const aiExtractionService = require('../services/aiExtractionService');

/**
 * Compute a 0-100 discount weight for a coupon based on its discountType
 * and discountValue.  This is calculated once at scrape time and stored on
 * both RawScrapedCoupon and Coupon so the filter/scoring scripts can use it
 * as a signal — ensuring high-value coupons survive below-average pruning.
 *
 * @param {string|null} discountType  - e.g. 'percentage', 'flat', 'cashback'
 * @param {*}           discountValue - raw value (number, string, or null)
 * @returns {number} score 0-100
 */
function computeDiscountWeight(discountType, discountValue) {
    const type = (discountType || 'unknown').toLowerCase();

    // ── Fixed-value types (no numeric parsing needed) ─────────────────────
    if (type === 'freebie')        return 60;
    if (type === 'buy1get1')       return 70;
    if (type === 'free_delivery')  return 40;
    if (type === 'wallet_upi')     return 45;
    if (type === 'prepaid_only')   return 35;

    // ── Try to extract a numeric value from discountValue ────────────────
    // discountValue can be a number, or a raw string like:
    //   "60% OFF", "All (32)", "₹500 off", "33 People Used Today 40% Off..."
    let numericValue = null;

    if (typeof discountValue === 'number' && !isNaN(discountValue)) {
        numericValue = discountValue;
    } else if (typeof discountValue === 'string') {
        // Priority 1: percentage pattern (e.g. "60%", "40 % OFF")
        const pctMatch = discountValue.match(/(\d+(?:\.\d+)?)\s*%/);
        if (pctMatch) {
            numericValue = parseFloat(pctMatch[1]);
            // If we hit a percentage pattern but type is unknown/flat, promote type
            if (type === 'unknown' || type === 'flat') {
                return Math.min(Math.round(numericValue * 1.5), 100);
            }
        }
        if (numericValue === null) {
            // Priority 2: rupee / flat amount (e.g. "₹500", "Rs. 200")
            const flatMatch = discountValue.match(/(?:₹|rs\.?\s*)(\d+(?:,\d+)*)/i);
            if (flatMatch) {
                numericValue = parseInt(flatMatch[1].replace(/,/g, ''), 10);
            }
        }
        if (numericValue === null) {
            // Priority 3: bare integer (e.g. "200")
            const bareMatch = discountValue.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
            if (bareMatch) numericValue = parseFloat(bareMatch[1]);
        }
    }

    // ── Score by type using extracted numeric value ───────────────────────
    if (type === 'percentage') {
        if (numericValue === null) return 25; // type known but can't parse value
        // Cap at 100: 30 % → 45, 50 % → 75, 67 % → 100
        return Math.min(Math.round(numericValue * 1.5), 100);
    }

    if (type === 'flat' || type === 'cashback') {
        if (numericValue === null) return 20;
        // Log-scale on a ₹5000 ceiling: ₹100→26, ₹500→54, ₹1000→67, ₹5000→100
        const score = (Math.log10(numericValue + 1) / Math.log10(5001)) * 100;
        return Math.min(Math.round(score), 100);
    }

    // unknown type — use numeric value if parseable, otherwise floor
    if (numericValue !== null) {
        // Treat as percentage if ≤100, else as flat
        if (numericValue <= 100) return Math.min(Math.round(numericValue * 1.5), 100);
        const score = (Math.log10(numericValue + 1) / Math.log10(5001)) * 100;
        return Math.min(Math.round(score), 100);
    }

    return 10; // no discount info at all
}

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

                    // Fire-and-forget: persist raw adapter output to RawScrapedCoupon collection
                    // This runs non-blocking so it doesn't slow down the normalization pipeline
                    this.saveRawCoupons(adapter.sourceName, coupons).catch(err =>
                        logger.error(`Failed to save raw coupons for ${adapter.sourceName}: ${err.message}`)
                    );

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

    /**
     * Persist raw adapter output to the RawScrapedCoupon collection.
     * Uses upsert on (sourceAdapter + brandName + couponTitle) so that
     * re-scraping the same coupon always refreshes the signal fields
     * (usedBy, verified, trustscore) with the latest values.
     *
     * @param {string} sourceName - Adapter name (e.g. "GrabOn")
     * @param {object[]} coupons  - Raw coupon objects from adapter.scrape()
     */
    async saveRawCoupons(sourceName, coupons) {
        if (!coupons || coupons.length === 0) return;

        const now = new Date();
        let saved = 0;
        let errors = 0;
        let enriched = 0;

        for (let coupon of coupons) {
            try {
                // ── AI Enrichment pass ────────────────────────────────────────
                // Fills in userType, websiteLink, homePage, minimumOrder, terms
                // for fields that the listing-page scraper could not extract.
                // This is best-effort: if Gemini is unavailable the raw data is used.
                const needsEnrichment =
                    !coupon.userType ||
                    !coupon.websiteLink ||
                    !coupon.homePage ||
                    coupon.minimumOrder === null ||
                    coupon.minimumOrder === undefined ||
                    !coupon.terms;

                if (needsEnrichment) {
                    coupon = await aiExtractionService.enrichScrapedCoupon(coupon);
                    enriched++;
                }

                // Debug log for signal fields
                if (coupon.trustscore !== null && coupon.trustscore !== undefined) {
                    logger.info(`ScraperEngine: Saving Raw Coupon Signal - Brand: ${coupon.brandName}, TrustScore: ${coupon.trustscore}, Type: ${typeof coupon.trustscore}, UsedBy: ${coupon.usedBy}`);
                }

                const filter = {
                    sourceAdapter: sourceName,
                    brandName: coupon.brandName || 'Unknown',
                    couponTitle: (coupon.couponTitle || '').substring(0, 200) || 'Untitled',
                };

                const update = {
                    $set: {
                        sourceAdapter: sourceName,
                        scrapedAt: now,
                        brandName: coupon.brandName || 'Unknown',
                        couponTitle: (coupon.couponTitle || '').substring(0, 200) || 'Untitled',
                        description: coupon.description || null,
                        couponCode: coupon.couponCode || null,
                        discountType: coupon.discountType || 'unknown',
                        discountValue: coupon.discountValue || null,
                        category: coupon.category || null,
                        couponLink: coupon.couponLink || null,
                        terms: coupon.terms || null,
                        minimumOrder: (coupon.minimumOrder !== null && coupon.minimumOrder !== undefined)
                            ? Number(coupon.minimumOrder)
                            : null,

                        // ── AI-enriched metadata fields ───────────────────────────────
                        userType:    coupon.userType    || null,
                        websiteLink: coupon.websiteLink || null,
                        homePage:    coupon.homePage    || null,

                        // ── Signal fields (scraped from source) ──────────────────────
                        // Only update signals if they are present in this scrape run
                        // This prevents overwriting valid data with null from duplicate/incomplete scrape fragments
                        ...((coupon.usedBy || coupon.usedBy === 0) ? { usedBy: Number(coupon.usedBy) } : {}),
                        ...((coupon.trustscore || coupon.trustscore === 0) ? { trustscore: Number(coupon.trustscore) } : {}),
                        ...((coupon.liveSuccessRate || coupon.liveSuccessRate === 0) ? { liveSuccessRate: Number(coupon.liveSuccessRate) } : {}),
                        
                        verified:             typeof coupon.verified === 'boolean' ? coupon.verified : null,
                        platformVerified:     typeof coupon.platformVerified === 'boolean' ? coupon.platformVerified : null,
                        expiryDate:           coupon.expiryDate instanceof Date             ? coupon.expiryDate            : null,

                        // ── Static / computed signal fields ───────────────────────────
                        sourceCredibilityScore: Number.isFinite(coupon.sourceCredibilityScore) ? coupon.sourceCredibilityScore : null,

                        // ── Discount weight: computed from discountType + discountValue ──
                        // Gives high-value coupons a boost so they survive the
                        // below-average filter even when other signals are weak.
                        discountWeight: computeDiscountWeight(coupon.discountType, coupon.discountValue),

                        // ── User-feedback / AI-computed fields (null until pipeline runs) ──
                        recencyScore:         Number.isFinite(coupon.recencyScore)          ? coupon.recencyScore          : null,
                        failureRate:          Number.isFinite(coupon.failureRate)           ? coupon.failureRate           : null,
                        confidenceScore:      Number.isFinite(coupon.confidenceScore)       ? coupon.confidenceScore       : null,
                        trendVelocity:        Number.isFinite(coupon.trendVelocity)         ? coupon.trendVelocity         : null,
                    },
                    // Only set aiValidationStatus to 'pending' on first insert;
                    // don't reset it if the AI engine has already processed this coupon
                    $setOnInsert: {
                        aiValidationStatus: 'pending',
                        aiValidationScore: null,
                        aiValidationNotes: null,
                        processedAt: null,
                        validatedCouponId: null,
                    },
                };

                await RawScrapedCoupon.findOneAndUpdate(filter, update, {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                });
                saved++;
            } catch (err) {
                // Don't let individual failures kill the batch
                errors++;
                if (process.env.LOG_LEVEL === 'debug') {
                    logger.debug(`saveRawCoupons: failed for "${coupon.couponTitle}" - ${err.message}`);
                }
            }
        }

        logger.info(`saveRawCoupons [${sourceName}]: upserted=${saved} enriched=${enriched} errors=${errors} total=${coupons.length}`);
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

        // Compute discountWeight from discount signals scraped on this coupon.
        // This ensures the Coupon collection (read by filterBelowAverageCoupons)
        // always has the weight — even when saveRawCoupons ran asynchronously.
        if (data.discountWeight === undefined || data.discountWeight === null) {
            data.discountWeight = computeDiscountWeight(data.discountType, data.discountValue);
        }

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
