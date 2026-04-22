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

        // ─── AI Signal fields (scraped from source) ──────────────────
        /**
         * usedBy: Number of uses today reported by the source platform.
         * GrabOn: parsed from span[data-type="views"] data-uses attribute.
         * null = source does not expose this metric.
         */
        usedBy: {
            type: Number,
            default: null,
            min: [0, 'usedBy cannot be negative'],
        },

        /**
         * verified: Legacy verified flag (kept for backward compat with older adapters).
         * Prefer platformVerified for new adapters.
         */
        verified: {
            type: Boolean,
            default: null,
        },

        /**
         * platformVerified: Whether the coupon carries an explicit verified badge
         * from the source platform (e.g. GrabOn's green checkmark).
         * null = source does not expose a verified badge.
         */
        platformVerified: {
            type: Boolean,
            default: null,
        },

        /**
         * trustscore: Raw trust/vote count or normalised score (0–100).
         * GrabOn: (storeRating / 5) * 100  (page-level star rating).
         * CouponDekho: (ratingPercent/100) * totalVotes.
         * CouponDuniya: parsed from success-percent span.
         * null = source does not expose this metric.
         */
        trustscore: {
            type: Number,
            default: null,
            min: [0, 'trustscore cannot be negative'],
            max: [100, 'trustscore cannot exceed 100'],
        },

        /**
         * expiryDate: Coupon expiry date parsed from source (e.g. "Valid Till: Apr 30, 2026").
         * GrabOn: extracted from detail page via Puppeteer deep scraping.
         * null = source does not expose or we failed to parse expiry.
         */
        expiryDate: {
            type: Date,
            default: null,
        },

        /**
         * liveSuccessRate: Percentage of users who reported this coupon as working.
         * GrabOn: not available per-coupon on listing pages (null).
         * Range: 0–100.
         */
        liveSuccessRate: {
            type: Number,
            default: null,
            min: [0, 'liveSuccessRate cannot be negative'],
            max: [100, 'liveSuccessRate cannot exceed 100'],
        },

        // ─── Computed / derived signal fields ────────────────────────────
        /**
         * recencyScore: Freshness score 0–100 derived from scrapedAt.
         * 100 = scraped today, decays ~10 pts per day.
         * Computed by the AI validation engine from scrapedAt; stored for fast querying.
         */
        recencyScore: {
            type: Number,
            default: null,
            min: [0, 'recencyScore cannot be negative'],
            max: [100, 'recencyScore cannot exceed 100'],
        },

        /**
         * failureRate: Percentage of our users who reported this coupon as failed.
         * Populated by user feedback pipeline; starts null.
         * Range: 0–100.
         */
        failureRate: {
            type: Number,
            default: null,
            min: [0, 'failureRate cannot be negative'],
            max: [100, 'failureRate cannot exceed 100'],
        },

        /**
         * confidenceScore: Composite score (0–100) computed by AI engine.
         * Formula: f(trustscore, liveSuccessRate, failureRate, platformVerified, recencyScore).
         * null = not yet computed.
         */
        confidenceScore: {
            type: Number,
            default: null,
            min: [0, 'confidenceScore cannot be negative'],
            max: [100, 'confidenceScore cannot exceed 100'],
        },

        /**
         * sourceCredibilityScore: Static trust score assigned to the scraping source (0–100).
         * GrabOn = 75, CouponDuniya = 65, Desidime = 70, etc.
         * Set per-adapter at scrape time.
         */
        sourceCredibilityScore: {
            type: Number,
            default: null,
            min: [0, 'sourceCredibilityScore cannot be negative'],
            max: [100, 'sourceCredibilityScore cannot exceed 100'],
        },

        /**
         * trendVelocity: Rate of traction growth for this coupon.
         * Measures how quickly usedBy/likes are increasing across scrape runs.
         * null = not enough historical data yet; computed by monitoring pipeline.
         */
        trendVelocity: {
            type: Number,
            default: null,
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
