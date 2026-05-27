const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Health Score Calculation Engine
 *
 * Runs every 5 hours to calculate and persist health scores for all active partner coupons.
 *
 * Scores calculated:
 * - reliabilityScore: Based on community feedback (success/fail votes)
 * - freshnessScore: Based on age (calculated in-memory, not stored)
 * - trendScore: Based on recent discover activity
 * - healthScore: Weighted combination of all signals
 */

const col = () => mongoose.connection.db.collection('partnercoupons');

/**
 * Calculate reliability score from community feedback
 * Uses Laplace smoothing to handle small sample sizes fairly
 *
 * Formula: ((successCount + 5) / (successCount + failedCount + 10)) * 100
 *
 * @param {number} successCount - Number of successful votes
 * @param {number} failedCount - Number of failed votes
 * @returns {number} reliabilityScore 0-100
 */
function calculateReliabilityScore(successCount = 0, failedCount = 0) {
    const numerator = successCount + 7;
    const denominator = successCount + failedCount + 10;
    const score = (numerator / denominator) * 100;
    return Math.round(score * 100) / 100;
}

/**
 * Calculate freshness score based on coupon age
 * Newer coupons get slight ranking advantage
 * Old coupons slowly lose freshness value
 *
 * Formula: 100 / (1 + daysOld)
 *
 * IMPORTANT: This score is NOT persisted to database
 * Calculated only in-memory during cron execution
 * because it's derived from createdAt and lightweight
 *
 * @param {Date} createdAt - Coupon creation date
 * @param {Date} now - Current date (for testing)
 * @returns {number} freshnessScore 0-100
 */
function calculateFreshnessScore(createdAt, now = new Date()) {
    const daysOld = (now - new Date(createdAt)) / (1000 * 60 * 60 * 24);
    return 100 / (1 + daysOld);
}

/**
 * Calculate trend score based on recent discover activity
 * Recently explored coupons get slight ranking boost
 *
 * Formula: discoverCount / (1 + hoursSinceDiscover)
 * Clamped to max 100
 *
 * @param {number} discoverCount - Total number of discovers
 * @param {Date} lastDiscoverAt - Last discover timestamp (null if never)
 * @param {Date} now - Current date (for testing)
 * @returns {number} trendScore 0-100 (clamped)
 */
function calculateTrendScore(discoverCount = 0, lastDiscoverAt = null, now = new Date()) {
    // If no discover activity, score is 0
    if (!lastDiscoverAt || discoverCount === 0) {
        return 0;
    }

    const hoursSinceDiscover = (now - new Date(lastDiscoverAt)) / (1000 * 60 * 60);
    let trendScore = discoverCount / (1 + hoursSinceDiscover);

    // Clamp to max 100 and round to 2 decimal places
    return Math.round(Math.min(trendScore, 100) * 100) / 100;
}

/**
 * Calculate overall health score
 * Combines all ranking signals into one final score
 *
 * Formula:
 * healthScore = (discountWeight * 0.4) +
 *               (reliabilityScore * 0.4) +
 *               (freshnessScore * 0.15) +
 *               (trendScore * 0.05)
 *
 * @param {number} discountWeight - Discount value (0-100+)
 * @param {number} reliabilityScore - Reliability score (0-100)
 * @param {number} freshnessScore - Freshness score (0-100)
 * @param {number} trendScore - Trend score (0-100)
 * @returns {number} healthScore
 */
function calculateHealthScore(discountWeight = 0, reliabilityScore, freshnessScore, trendScore = 0) {
    const attractiveness = (discountWeight * 0.9) + (trendScore * 0.1);
    const reliabilityMult = reliabilityScore / 100;
    const freshnessMult = freshnessScore / 100;
    
    const score = attractiveness * reliabilityMult * freshnessMult;
    return Math.round(score * 100) / 100;
}

/**
 * Main health score calculation job
 * Fetches all active coupons and calculates/persists health scores
 *
 * @returns {Promise<Object>} Summary of updates made
 */
async function runHealthScoreCalculation() {
    const startTime = Date.now();
    const now = new Date();

    try {
        logger.info('[HealthScore] Starting health score calculation...');

        // 1. Fetch all active (non-expired) partner coupons
        const filter = {
            status: { $ne: 'expired' },
            end: { $gt: now }  // Not expired
        };

        const coupons = await col().find(filter).toArray();
        logger.info(`[HealthScore] Fetched ${coupons.length} active coupons for scoring`);

        if (coupons.length === 0) {
            logger.info('[HealthScore] No active coupons to score');
            return { processed: 0, updated: 0, duration: Date.now() - startTime };
        }

        // 2. Prepare bulk update operations
        const updateOperations = [];

        for (const coupon of coupons) {
            // Extract relevant fields with safe defaults
            const successCount = coupon.successCount || 0;
            const failedCount = coupon.failedCount || 0;
            const discountWeight = coupon.discountWeight || 0;
            const createdAt = coupon.createdAt || new Date();
            const discoverCount = coupon.trend?.discoverCount || 0;
            const lastDiscoverAt = coupon.trend?.lastDiscoverAt;

            // Calculate all scores
            const reliabilityScore = calculateReliabilityScore(successCount, failedCount);
            const freshnessScore = calculateFreshnessScore(createdAt, now);
            const trendScore = calculateTrendScore(discoverCount, lastDiscoverAt, now);
            const healthScore = calculateHealthScore(discountWeight, reliabilityScore, freshnessScore, trendScore);

            // Prepare update operation (only persist reliable, trend, and health scores)
            updateOperations.push({
                updateOne: {
                    filter: { _id: coupon._id },
                    update: {
                        $set: {
                            'trend.reliabilityScore': reliabilityScore,
                            'trend.trendScore': trendScore,
                            'trend.healthScore': healthScore
                        }
                    }
                }
            });
        }

        // 3. Execute bulk update
        if (updateOperations.length > 0) {
            const result = await col().bulkWrite(updateOperations, { ordered: false });
            logger.info(
                `[HealthScore] Bulk update completed. ` +
                `Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`
            );
        }

        const duration = Date.now() - startTime;
        logger.info(
            `[HealthScore] Health score calculation completed successfully. ` +
            `Processed: ${coupons.length} coupons in ${duration}ms`
        );

        return {
            processed: coupons.length,
            updated: updateOperations.length,
            duration
        };

    } catch (error) {
        logger.error(`[HealthScore] Calculation failed: ${error.message}`);
        throw error;
    }
}

// Export for testing
module.exports = {
    runHealthScoreCalculation,
    calculateReliabilityScore,
    calculateFreshnessScore,
    calculateTrendScore,
    calculateHealthScore
};
