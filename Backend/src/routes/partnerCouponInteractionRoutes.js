/**
 * Partner Coupon Interaction Routes — /api/partner-coupon-interactions
 *
 * Tracks user interactions with partner coupons (from ai-coupon-engine)
 * and drives the "did it work?" feedback popup for partner coupons.
 *
 * Endpoints:
 *   POST   /api/partner-coupon-interactions              — record discover / redeem
 *   GET    /api/partner-coupon-interactions/pending      — get pending interactions for user
 *   PATCH  /api/partner-coupon-interactions/:id/resolve  — resolve with success/failure/skipped
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const PartnerCouponInteraction = require('../models/PartnerCouponInteraction');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(req) {
    // Firebase UID forwarded by the mobile app as a header or query param.
    // The app sends it as X-User-Id (set by the auth interceptor in NetworkModule).
    return req.headers['x-user-id'] || req.query.userId || null;
}

function badRequest(res, message) {
    return res.status(400).json({ success: false, message });
}

// ─── 1. Record an interaction ─────────────────────────────────────────────────
/**
 * POST /api/partner-coupon-interactions
 * Body: { userId, couponId, brandName, couponCode?, couponLink?, action }
 * action: "discover" | "redeem"
 *
 * - For "redeem": immediately increments failedCount on the partner coupon
 *   (explicit redeem press = assumed failure unless user says otherwise)
 *   and creates a PENDING interaction so user can correct it later.
 * - For "discover": creates a PENDING interaction for feedback.
 */
router.post('/', async (req, res) => {
    try {
        const { userId, couponId, brandName, couponCode, couponLink, action } = req.body;

        if (!userId) return badRequest(res, 'userId is required');
        if (!couponId) return badRequest(res, 'couponId is required');
        if (!brandName) return badRequest(res, 'brandName is required');
        if (!['discover', 'redeem'].includes(action))
            return badRequest(res, 'action must be discover | redeem');

        // Create the interaction record
        const interaction = await PartnerCouponInteraction.create({
            userId,
            couponId,
            brandName,
            couponCode: couponCode || null,
            couponLink: couponLink || null,
            action,
            outcome: action === 'redeem' ? 'pending' : 'pending',
        });

        // For explicit Redeem presses: immediately bump failedCount on partner coupon.
        // (User pressed Redeem → they used it → we assume failure until corrected.)
        try {
            if (action === 'redeem') {
                const partnerCouponsCollection = mongoose.connection.db.collection('partnercoupons');
                let coupon = await partnerCouponsCollection.findOne({ couponId: couponId });
                if (!coupon) {
                    try {
                        const { ObjectId } = mongoose.Types;
                        coupon = await partnerCouponsCollection.findOne({ _id: new ObjectId(couponId) });
                    } catch (err) {}
                }

                if (coupon) {
                    const oldSuccessCount = coupon.successCount || 0;
                    const oldFailedCount = coupon.failedCount || 0;

                    // Import calculation helper from cron
                    const { calculateReliabilityScore } = require('../cron/healthScoreCron');

                    const oldReliabilityScore = coupon.trend?.reliabilityScore ?? calculateReliabilityScore(oldSuccessCount, oldFailedCount);
                    const oldHealthScore = coupon.trend?.healthScore || 0;

                    // Compute new success/failed counts
                    const newSuccessCount = oldSuccessCount;
                    const newFailedCount = oldFailedCount + 1; // Explicit redeem: Assumed failure initially

                    // Recalculate reliability
                    const newReliabilityScore = calculateReliabilityScore(newSuccessCount, newFailedCount);

                    // Recalculate health score (removes old reliability contribution and adds the new one with 0.4 weight)
                    const baseHealthScore = oldHealthScore - (oldReliabilityScore * 0.4);
                    const newHealthScore = baseHealthScore + (newReliabilityScore * 0.4);

                    await partnerCouponsCollection.updateOne(
                        { _id: coupon._id },
                        {
                            $set: {
                                failedCount: newFailedCount,
                                'trend.reliabilityScore': newReliabilityScore,
                                'trend.healthScore': newHealthScore
                            }
                        }
                    );

                    console.log(`[PartnerCouponInteraction] Real-time scores updated for initial redeem on coupon ${couponId}. ` +
                        `Reliability: ${oldReliabilityScore.toFixed(2)} -> ${newReliabilityScore.toFixed(2)}, ` +
                        `HealthScore: ${oldHealthScore.toFixed(2)} -> ${newHealthScore.toFixed(2)}`);
                } else {
                    console.warn(`[PartnerCouponInteraction] Coupon not found for initial redeem stats: ${couponId}`);
                }
            }
        } catch (dbError) {
            console.error('[PartnerCouponInteraction] Error updating initial redeem stats:', dbError.message);
            // Don't fail the request - the interaction is still recorded
        }

        res.status(201).json({
            success: true,
            message: 'Partner coupon interaction recorded',
            data: { interactionId: interaction._id },
        });
    } catch (err) {
        console.error('[PartnerCouponInteraction] record interaction error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── 2. Get pending interactions for a user ────────────────────────────────────
/**
 * GET /api/partner-coupon-interactions/pending?userId=UID
 *
 * Returns all interactions with outcome = "pending" for the given user,
 * from the last 7 days, sorted newest first.  The frontend shows these as a feedback popup.
 */
router.get('/pending', async (req, res) => {
    try {
        const userId = req.query.userId || getUserId(req);
        if (!userId) return badRequest(res, 'userId is required');

        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const pending = await PartnerCouponInteraction.find({
            userId,
            outcome: 'pending',
            createdAt: { $gte: sevenDaysAgo }
        })
            .sort({ createdAt: -1 })
            .limit(20)   // cap: show at most 20 feedback prompts at once
            .lean();

        res.json({
            success: true,
            data: { count: pending.length, interactions: pending },
        });
    } catch (err) {
        console.error('[PartnerCouponInteraction] get pending error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── 3. Resolve an interaction ────────────────────────────────────────────────
/**
 * PATCH /api/partner-coupon-interactions/:id/resolve
 * Body: { outcome }  — "success" | "failure" | "skipped"
 *
 * - success  → successCount++ on the partner coupon
 * - failure  → failedCount++ on the partner coupon
 *              (but if action was "redeem", failedCount was already bumped,
 *              so for "redeem" resolving as failure we do NOT double-count)
 * - skipped  → marks the interaction resolved, no coupon stats change
 */
router.patch('/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { outcome } = req.body;

        if (!['success', 'failure', 'skipped'].includes(outcome))
            return badRequest(res, 'outcome must be success | failure | skipped');
        if (!mongoose.Types.ObjectId.isValid(id))
            return badRequest(res, 'Invalid interaction id');

        const interaction = await PartnerCouponInteraction.findById(id);
        if (!interaction)
            return res.status(404).json({ success: false, message: 'Interaction not found' });
        if (interaction.outcome !== 'pending')
            return res.status(409).json({ success: false, message: 'Interaction already resolved' });

        // Update the interaction record
        interaction.outcome = outcome;
        interaction.resolvedAt = new Date();
        await interaction.save();

        // Update partner coupon stats in ai-coupon-engine DB
        try {
            // Get the partnercoupons collection
            const partnerCouponsCollection = mongoose.connection.db.collection('partnercoupons');

            // Determine which field to update based on outcome
            let updateField;
            let updateValue = 1;

            if (outcome === 'success') {
                updateField = 'successCount';
            } else if (outcome === 'failure') {
                updateField = 'failedCount';
                // For redeem actions that are marked as failure, we need to check if failedCount was already incremented
                // The initial redeem action already increments failedCount, so we should not double-count
                if (interaction.action === 'redeem') {
                    // Check if failedCount was already incremented when redeem was recorded
                    // We'll assume it was, so we don't increment again
                    updateValue = 0;
                }
            } else if (outcome === 'skipped') {
                // No stats update for skipped
                updateField = null;
            }

            // Update the coupon stats if needed
            if (updateField && updateValue > 0) {
                // Find current coupon to calculate new reliability and health scores in real-time
                let coupon = await partnerCouponsCollection.findOne({ couponId: interaction.couponId });
                if (!coupon) {
                    try {
                        const { ObjectId } = mongoose.Types;
                        coupon = await partnerCouponsCollection.findOne({ _id: new ObjectId(interaction.couponId) });
                    } catch (err) {}
                }

                if (coupon) {
                    const oldSuccessCount = coupon.successCount || 0;
                    const oldFailedCount = coupon.failedCount || 0;

                    // Import calculation helper from cron
                    const { calculateReliabilityScore } = require('../cron/healthScoreCron');

                    const oldReliabilityScore = coupon.trend?.reliabilityScore ?? calculateReliabilityScore(oldSuccessCount, oldFailedCount);
                    const oldHealthScore = coupon.trend?.healthScore || 0;

                    // Compute new success/failed counts
                    const newSuccessCount = oldSuccessCount + (updateField === 'successCount' ? updateValue : 0);
                    const newFailedCount = oldFailedCount + (updateField === 'failedCount' ? updateValue : 0);

                    // Recalculate reliability
                    const newReliabilityScore = calculateReliabilityScore(newSuccessCount, newFailedCount);

                    // Recalculate health score (removes old reliability contribution and adds the new one with 0.4 weight)
                    const baseHealthScore = oldHealthScore - (oldReliabilityScore * 0.4);
                    const newHealthScore = baseHealthScore + (newReliabilityScore * 0.4);

                    const result = await partnerCouponsCollection.updateOne(
                        { _id: coupon._id },
                        {
                            $set: {
                                successCount: newSuccessCount,
                                failedCount: newFailedCount,
                                'trend.reliabilityScore': newReliabilityScore,
                                'trend.healthScore': newHealthScore
                            }
                        }
                    );

                    console.log(`[PartnerCouponInteraction] Real-time scores updated for resolved coupon ${interaction.couponId}. ` +
                        `Counts: success=${newSuccessCount}, failed=${newFailedCount}. ` +
                        `Reliability: ${oldReliabilityScore.toFixed(2)} -> ${newReliabilityScore.toFixed(2)}, ` +
                        `HealthScore: ${oldHealthScore.toFixed(2)} -> ${newHealthScore.toFixed(2)}`);
                } else {
                    console.warn(`[PartnerCouponInteraction] Coupon not found for resolution: ${interaction.couponId}`);
                }
            }
        } catch (dbError) {
            console.error('[PartnerCouponInteraction] Error updating coupon stats:', dbError.message);
            // Don't fail the request - the interaction is still marked as resolved
        }

        res.json({
            success: true,
            message: `Partner coupon interaction marked as ${outcome}`,
        });
    } catch (err) {
        console.error('[PartnerCouponInteraction] resolve interaction error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;