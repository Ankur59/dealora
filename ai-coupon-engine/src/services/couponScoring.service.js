import { calculateCouponScore } from './scoring.service.js';

/**
 * Service to handle batch scoring of coupons.
 * This can be triggered from controllers or scripts.
 */
export const scoreMerchantCoupons = async (merchantName, coupons) => {
    console.log(`Scoring ${coupons.length} coupons for ${merchantName}...`);
    
    let scoredCount = 0;
    
    for (const coupon of coupons) {
        // Prepare a copy of the coupon data for scoring without modifying the DB fields
        const scoringData = typeof coupon.toObject === 'function' ? coupon.toObject() : { ...coupon };

        // Map missing fields for scoring logic without saving them to the DB
        if (!scoringData.verifiedOn) scoringData.verifiedOn = coupon.scrapedAt;
        if (scoringData.isVerified === undefined || scoringData.isVerified === null) {
            scoringData.isVerified = coupon.platformVerified;
        }
        if (!scoringData.partner) scoringData.partner = coupon.sourceAdapter;
        if (scoringData.usedByCount === undefined || scoringData.usedByCount === null) {
            scoringData.usedByCount = coupon.usedBy || 0;
        }

        // Calculate score
        const scoreResult = calculateCouponScore(scoringData);

        // Update ONLY the score-related fields
        coupon.couponScore = scoreResult.finalScore;
        coupon.scoreCalculatedAt = new Date();
        coupon.scoreDetails = scoreResult;

        if (typeof coupon.save === 'function') {
            await coupon.save();
        }
        scoredCount++;
    }
    
    return scoredCount;
};
