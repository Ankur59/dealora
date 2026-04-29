/**
 * Fleet Engine Routes  —  /api/fleet
 *
 * Tracks user interactions with exclusive (scraped) coupons and drives
 * the "did it work?" feedback popup shown on next page load.
 *
 * Endpoints:
 *   POST   /api/fleet/interactions              — record copy / discover / redeem
 *   GET    /api/fleet/interactions/pending      — get pending interactions for user
 *   PATCH  /api/fleet/interactions/:id/resolve  — resolve with success/failure/skipped
 *   POST   /api/fleet/coupons/:couponId/redeem  — explicit Redeem button press
 */

const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');

const CouponInteraction = require('../models/CouponInteraction');
const RawScrapedCoupon  = require('../models/RawScrapedCoupon');

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
 * POST /api/fleet/interactions
 * Body: { userId, couponId, brandName, couponCode?, couponLink?, action }
 * action: "copy" | "discover" | "redeem"
 *
 * - For "redeem": immediately increments totalUsage + totalFailure on the coupon
 *   (explicit redeem press = assumed failure unless user says otherwise)
 *   and creates a PENDING interaction so user can correct it later.
 * - For "copy" / "discover": creates a PENDING interaction for feedback.
 */
router.post('/interactions', async (req, res) => {
    try {
        const { userId, couponId, brandName, couponCode, couponLink, action } = req.body;

        if (!userId)   return badRequest(res, 'userId is required');
        if (!couponId) return badRequest(res, 'couponId is required');
        if (!brandName) return badRequest(res, 'brandName is required');
        if (!['copy', 'discover', 'redeem'].includes(action))
            return badRequest(res, 'action must be copy | discover | redeem');
        if (!mongoose.Types.ObjectId.isValid(couponId))
            return badRequest(res, 'couponId is not a valid ObjectId');

        // Create the interaction record
        const interaction = await CouponInteraction.create({
            userId,
            couponId: new mongoose.Types.ObjectId(couponId),
            brandName,
            couponCode: couponCode || null,
            couponLink: couponLink || null,
            action,
            outcome: action === 'redeem' ? 'pending' : 'pending',
        });

        // For explicit Redeem presses: immediately bump totalUsage + totalFailure.
        // (User pressed Redeem → they used it → we assume failure until corrected.)
        if (action === 'redeem') {
            await RawScrapedCoupon.findByIdAndUpdate(couponId, {
                $inc: { totalUsage: 1, totalFailure: 1 },
            });
        }

        res.status(201).json({
            success: true,
            message: 'Interaction recorded',
            data: { interactionId: interaction._id },
        });
    } catch (err) {
        console.error('[Fleet] record interaction error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── 2. Get pending interactions for a user ────────────────────────────────────
/**
 * GET /api/fleet/interactions/pending?userId=UID
 *
 * Returns all interactions with outcome = "pending" for the given user,
 * sorted newest first.  The frontend shows these as a feedback popup.
 */
router.get('/interactions/pending', async (req, res) => {
    try {
        const userId = req.query.userId || getUserId(req);
        if (!userId) return badRequest(res, 'userId is required');

        const pending = await CouponInteraction.find({
            userId,
            outcome: 'pending',
        })
            .sort({ createdAt: -1 })
            .limit(20)   // cap: show at most 20 feedback prompts at once
            .lean();

        res.json({
            success: true,
            data: { count: pending.length, interactions: pending },
        });
    } catch (err) {
        console.error('[Fleet] get pending error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── 3. Resolve an interaction ────────────────────────────────────────────────
/**
 * PATCH /api/fleet/interactions/:id/resolve
 * Body: { outcome }  — "success" | "failure" | "skipped"
 *
 * - success  → totalUsage++ + totalSuccess++ on the coupon
 * - failure  → totalUsage++ + totalFailure++ on the coupon
 *              (but if action was "redeem", totalUsage/Failure were already bumped,
 *              so for "redeem" resolving as failure we do NOT double-count)
 * - skipped  → marks the interaction resolved, no coupon stats change
 */
router.patch('/interactions/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { outcome } = req.body;

        if (!['success', 'failure', 'skipped'].includes(outcome))
            return badRequest(res, 'outcome must be success | failure | skipped');
        if (!mongoose.Types.ObjectId.isValid(id))
            return badRequest(res, 'Invalid interaction id');

        const interaction = await CouponInteraction.findById(id);
        if (!interaction)
            return res.status(404).json({ success: false, message: 'Interaction not found' });
        if (interaction.outcome !== 'pending')
            return res.status(409).json({ success: false, message: 'Interaction already resolved' });

        // Update the interaction record
        interaction.outcome    = outcome;
        interaction.resolvedAt = new Date();
        await interaction.save();

        // Update coupon stats (avoid double-counting for explicit "redeem" actions)
        if (outcome !== 'skipped') {
            const isRedeemAction = interaction.action === 'redeem';
            // For "redeem" actions we already bumped totalUsage + totalFailure at record time.
            // If user now says "success", flip the failure to success (net: no change to Usage,
            // +1 Success, -1 Failure).
            if (isRedeemAction) {
                if (outcome === 'success') {
                    await RawScrapedCoupon.findByIdAndUpdate(interaction.couponId, {
                        $inc: { totalSuccess: 1, totalFailure: -1 },
                    });
                }
                // outcome === 'failure' → already counted at record time, no change needed
            } else {
                // copy / discover — stats not yet incremented
                const statsInc = outcome === 'success'
                    ? { totalUsage: 1, totalSuccess: 1 }
                    : { totalUsage: 1, totalFailure: 1 };
                await RawScrapedCoupon.findByIdAndUpdate(interaction.couponId, {
                    $inc: statsInc,
                });
            }
        }

        res.json({
            success: true,
            message: `Interaction marked as ${outcome}`,
        });
    } catch (err) {
        console.error('[Fleet] resolve interaction error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── 4. Explicit Redeem endpoint (standalone — no interaction record) ──────────
/**
 * POST /api/fleet/coupons/:couponId/redeem
 * Body: { userId }
 *
 * Used if the caller wants to bump stats without creating a follow-up
 * feedback interaction.  Not used by current mobile flow but kept for
 * completeness / future admin dashboard.
 */
router.post('/coupons/:couponId/redeem', async (req, res) => {
    try {
        const { couponId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(couponId))
            return badRequest(res, 'Invalid couponId');

        const coupon = await RawScrapedCoupon.findByIdAndUpdate(
            couponId,
            { $inc: { totalUsage: 1, totalFailure: 1 } },
            { new: true, select: 'totalUsage totalSuccess totalFailure' }
        );
        if (!coupon)
            return res.status(404).json({ success: false, message: 'Coupon not found' });

        res.json({ success: true, data: { stats: coupon } });
    } catch (err) {
        console.error('[Fleet] redeem coupon error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
