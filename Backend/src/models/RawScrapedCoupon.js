const mongoose = require('mongoose');

/**
 * RawScrapedCoupon — stores the raw adapter output BEFORE Gemini normalization.
 *
 * Purpose: feed the AI validation engine with signal-rich data.
 * The three key signal fields for AI validation are:
 *   - usedBy     — crowd usage count (social proof)
 *   - verified   — platform-verified badge (authoritative flag)
 *   - trustscore — upvote/like count (sentiment metric)
 *
 * Collection: rawscrapedcoupons (same DB as main Coupon collection)
 * Deduplication: upsert on (sourceAdapter + brandName + couponTitle)
 */

const rawScrapedCouponSchema = new mongoose.Schema(
    {
        // ─── Source metadata ──────────────────────────────────────────
        sourceAdapter: {
            type: String,
            required: true,
            trim: true,
            index: true,
            // e.g. "GrabOn", "CouponDuniya", "Desidime"
        },

        scrapedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },

        // ─── Core coupon fields (raw, un-normalized) ──────────────────
        brandName: {
            type: String,
            trim: true,
            required: true,
            index: true,
        },

        couponTitle: {
            type: String,
            trim: true,
            required: true,
        },

        description: {
            type: String,
            trim: true,
            default: null,
        },

        couponCode: {
            type: String,
            trim: true,
            uppercase: true,
            default: null,
        },

        discountType: {
            type: String,
            enum: ['percentage', 'flat', 'cashback', 'freebie', 'unknown', null],
            default: 'unknown',
        },

        discountValue: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        category: {
            type: String,
            trim: true,
            default: null,
        },

        couponLink: {
            type: String,
            trim: true,
            default: null,
        },

        terms: {
            type: String,
            trim: true,
            maxlength: [3000, 'Terms cannot exceed 3000 characters'],
            default: null,
        },

        minimumOrder: {
            type: Number,
            default: null,
        },

        // ─── AI Signal fields ─────────────────────────────────────────
        /**
         * usedBy: Number of users who redeemed this coupon (from source listing).
         * null = source does not expose this metric.
         */
        usedBy: {
            type: Number,
            default: null,
            min: [0, 'usedBy cannot be negative'],
        },

        /**
         * verified: Whether the coupon was verified/authenticated by the source platform.
         * null = source does not expose a verified badge.
         * true = explicitly verified, false = explicitly marked as unverified.
         */
        verified: {
            type: Boolean,
            default: null,
        },

        /**
         * trustscore: Vote/like count or success-rate count (raw integer, not percentage).
         * For CouponDekho: computed from (ratingPercent/100) * totalVotes.
         * For CouponDuniya: parsed from success-percent span.
         * null = source does not expose this metric.
         */
        trustscore: {
            type: Number,
            default: null,
            min: [0, 'trustscore cannot be negative'],
        },

        // ─── AI Validation Engine fields ──────────────────────────────
        /**
         * aiValidationStatus: Current status in the AI validation pipeline.
         * pending    → not yet processed
         * processing → currently being validated
         * valid      → AI confirmed coupon is likely live
         * invalid    → AI flagged coupon as expired/incorrect
         * uncertain  → AI confidence too low to decide
         */
        aiValidationStatus: {
            type: String,
            enum: ['pending', 'processing', 'valid', 'invalid', 'uncertain'],
            default: 'pending',
            index: true,
        },

        /**
         * aiValidationScore: Confidence score from AI validation engine (0–100).
         * null = not yet scored.
         */
        aiValidationScore: {
            type: Number,
            default: null,
            min: [0, 'Score cannot be below 0'],
            max: [100, 'Score cannot exceed 100'],
        },

        /**
         * aiValidationNotes: Free-text notes from the AI engine explaining the decision.
         */
        aiValidationNotes: {
            type: String,
            trim: true,
            maxlength: [1000, 'AI validation notes cannot exceed 1000 characters'],
            default: null,
        },

        /**
         * processedAt: Timestamp when AI validation engine last processed this coupon.
         */
        processedAt: {
            type: Date,
            default: null,
        },

        /**
         * validatedCouponId: ObjectId reference to the main Coupon collection entry,
         * once the coupon has been promoted after validation.
         * null = not yet promoted.
         */
        validatedCouponId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Coupon',
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'rawscrapedcoupons',
    }
);

// ─── Compound indexes ──────────────────────────────────────────────────────

// Primary dedup key: same adapter + brand + title = same coupon, upsert
rawScrapedCouponSchema.index(
    { sourceAdapter: 1, brandName: 1, couponTitle: 1 },
    { unique: true }
);

// For AI engine to efficiently pick up pending items
rawScrapedCouponSchema.index({ aiValidationStatus: 1, scrapedAt: -1 });

// Quick brand-level queries
rawScrapedCouponSchema.index({ brandName: 1, aiValidationStatus: 1 });

// For querying by source
rawScrapedCouponSchema.index({ sourceAdapter: 1, scrapedAt: -1 });

const RawScrapedCoupon = mongoose.model('RawScrapedCoupon', rawScrapedCouponSchema);

module.exports = RawScrapedCoupon;
