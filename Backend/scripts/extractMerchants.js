require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/database');
const RawScrapedCoupon = require('./src/models/RawScrapedCoupon');
const RawScrapedMerchant = require('./src/models/RawScrapedMerchant');
const GenericAdapter = require('./src/scraper/sources/GenericAdapter');
const logger = require('./src/utils/logger');

// Instantiate a generic adapter to use its normalization logic
const adapter = new GenericAdapter('Internal', 'http://localhost');

async function extractMerchants() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Connected to database.');

        console.log('Aggregating brands from rawScrapedCoupons...');

        // We group by lowercased brand name to catch "myntra" and "Myntra" together
        const pipeline = [
            {
                $group: {
                    _id: { $toLower: "$brandName" },
                    rawBrandName: { $first: "$brandName" }, // Keep one version for normalization
                    category: { $first: "$category" },
                    domain: { $first: "$couponLink" },
                    score: { $max: "$trustscore" },
                    sourceAdapters: { $addToSet: "$sourceAdapter" },
                    lastScrapedAt: { $max: "$scrapedAt" },
                    couponCount: { $sum: 1 }
                }
            }
        ];

        const aggregatedBrands = await RawScrapedCoupon.aggregate(pipeline);

        console.log(`Found ${aggregatedBrands.length} distinct brand groups.`);

        let newMerchantsCount = 0;
        let updatedMerchantsCount = 0;

        for (const brandGroup of aggregatedBrands) {
            // Normalize the brand name using GenericAdapter logic
            const normalizedName = adapter.normalizeBrand(brandGroup.rawBrandName);
            
            // Get the official brand URL for domain/merchantUrl
            const officialUrl = adapter.getBrandUrl(normalizedName) || brandGroup.domain;

            const merchantData = {
                merchantName: normalizedName,
                category: brandGroup.category || 'Other',
                domain: officialUrl,
                merchantUrl: officialUrl,
                score: brandGroup.score || 0,
                isActive: true,
                sourceAdapters: brandGroup.sourceAdapters,
                lastScrapedAt: brandGroup.lastScrapedAt,
                couponCount: brandGroup.couponCount
            };

            const result = await RawScrapedMerchant.findOneAndUpdate(
                { merchantName: normalizedName },
                { $set: merchantData },
                { 
                    upsert: true, 
                    new: true, 
                    setDefaultsOnInsert: true,
                    includeResultMetadata: true 
                }
            );

            if (result.lastErrorObject && result.lastErrorObject.updatedExisting) {
                updatedMerchantsCount++;
            } else {
                newMerchantsCount++;
            }
        }

        console.log('\nMerchant Extraction Complete!');
        console.log(`Total Brand Groups Processed: ${aggregatedBrands.length}`);
        console.log(`New Merchants Created: ${newMerchantsCount}`);
        console.log(`Existing Merchants Updated: ${updatedMerchantsCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Error during extraction:', error);
        logger.error(`Merchant Extraction Error: ${error.message}`);
        process.exit(1);
    }
}

extractMerchants();
