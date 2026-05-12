/**
 * CouponInteraction — Fleet Engine
 *
 * Tracks every user action on an exclusive (scraped) coupon:
 *   - "copy"     : user copied the coupon code
 *   - "discover" : user clicked Discover (opened brand URL)
 *   - "redeem"   : user explicitly pressed the Redeem button
 *
 * outcome lifecycle:
 *   pending  → user has not yet told us whether it worked
 *   success  → user confirmed coupon worked (increments totalSuccess)
 *   failure  → user confirmed coupon failed  (increments totalFailure)
 *   skipped  → user dismissed the feedback popup without answering
 */

const mongoose = require('mongoose');

const couponInteractionSchema = new mongoose.Schema(
    {
        // The Firebase UID of the user performing the action
        userId: {
            type: String,
            required: true,
            index: true,
        },

        // Reference to the RawScrapedCoupon document
        couponId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'RawScrapedCoupon',
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
            enum: ['copy', 'discover', 'redeem'],
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
couponInteractionSchema.index({ userId: 1, outcome: 1, createdAt: -1 });

module.exports = mongoose.model('CouponInteraction', couponInteractionSchema);
