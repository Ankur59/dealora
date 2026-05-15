/**
 * PartnerCouponInteraction — Tracks user interactions with partner coupons
 *
 * Tracks every user action on a partner coupon (from ai-coupon-engine):
 *   - "discover" : user clicked Discover (opened brand URL)
 *   - "redeem"   : user explicitly pressed the Redeem button
 *
 * outcome lifecycle:
 *   pending  → user has not yet told us whether it worked
 *   success  → user confirmed coupon worked (increments successCount on partner coupon)
 *   failure  → user confirmed coupon failed (increments failedCount on partner coupon)
 *   skipped  → user dismissed the feedback popup without answering
 */

const mongoose = require('mongoose');

const partnerCouponInteractionSchema = new mongoose.Schema(
    {
        // The Firebase UID of the user performing the action
        userId: {
            type: String,
            required: true,
            index: true,
        },

        // Reference to the partner coupon (stored as string since it's in different DB)
        couponId: {
            type: String,
            required: true,
            index: true,
        },

        // Denormalised for fast display in the feedback popup
        brandName: { type: String, required: true },
        couponCode: { type: String, default: null },
        couponLink: { type: String, default: null },

        // What the user did
        action: {
            type: String,
            enum: ['discover', 'redeem'],
            required: true,
        },

        // Outcome of the interaction (set via resolve endpoint)
        outcome: {
            type: String,
            enum: ['pending', 'success', 'failure', 'skipped'],
            default: 'pending',
            index: true,
        },

        // When the user resolved the feedback (success / failure / skipped)
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Compound index for the "get pending interactions for user" query
partnerCouponInteractionSchema.index({ userId: 1, outcome: 1, createdAt: -1 });

// Index for getting interactions by couponId
partnerCouponInteractionSchema.index({ couponId: 1, createdAt: -1 });

module.exports = mongoose.model('PartnerCouponInteraction', partnerCouponInteractionSchema);