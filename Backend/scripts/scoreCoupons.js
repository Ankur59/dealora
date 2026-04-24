const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/database.js');
const RawScrapedCoupon = require('../src/models/RawScrapedCoupon.js');
const RawScrapedMerchant = require('../src/models/RawScrapedMerchant.js');
const logger = require('../src/utils/logger');

async function scoreCoupons() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Connected to database.');

        // Dynamic import for ESM scoring service
        const scoringService = await import('../../ai-coupon-engine/src/services/scoring.service.js');
        const calculateCouponScore = scoringService.calculateCouponScore;

        console.log('Fetching merchants...');
        const merchants = await RawScrapedMerchant.find({ isActive: true });
        console.log(`Found ${merchants.length} active merchants.`);

        let totalCouponsScored = 0;

        for (const merchant of merchants) {
            console.log(`\nProcessing merchant: ${merchant.merchantName}`);
            
            const coupons = await RawScrapedCoupon.find({ brandName: merchant.merchantName });
            console.log(`Found ${coupons.length} coupons for ${merchant.merchantName}`);

            for (const coupon of coupons) {
                // Prepare a copy of the coupon data for scoring without modifying the DB fields
                const scoringData = coupon.toObject();

                // Map missing fields for scoring logic without saving them to the DB
                if (!scoringData.verifiedOn) scoringData.verifiedOn = coupon.scrapedAt;
                if (scoringData.isVerified === null) scoringData.isVerified = coupon.platformVerified;
                if (!scoringData.partner) scoringData.partner = coupon.sourceAdapter;
                if (scoringData.usedByCount === null) scoringData.usedByCount = coupon.usedBy || 0;

                // Calculate score
                const scoreResult = calculateCouponScore(scoringData);

                // Update ONLY the score-related fields
                // coupon.couponScore = scoreResult.finalScore;
                // coupon.scoreCalculatedAt = new Date();
                // coupon.scoreDetails = scoreResult;

                await coupon.save();
                totalCouponsScored++;
            }
            console.log(`Finished scoring ${coupons.length} coupons for ${merchant.merchantName}`);
        }

        console.log(`\nScoring Complete!`);
        console.log(`Total Coupons Scored: ${totalCouponsScored}`);

        process.exit(0);
    } catch (error) {
        console.error('Error during scoring:', error);
        logger.error(`Coupon Scoring Error: ${error.message}`);
        process.exit(1);
    }
}
scoreCoupons();
