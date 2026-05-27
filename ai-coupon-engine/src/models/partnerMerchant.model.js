import { Schema, model } from "mongoose";

/**
 * PartnerMerchant
 *
 * Stores merchant records fetched from affiliate partner APIs (e.g. Coupomated).
 * This is intentionally kept separate from the internal `Merchant` model, which
 * holds browser-automation config, health scores, and verification state.
 *
 * Unique key: partner + merchantId  (partner's own ID for the merchant)
 */
const partnerMerchantSchema = new Schema(
    {
        /** Which affiliate partner provided this record (e.g. "coupomated") */
        partner: {
            type: String,
            required: true,
            index: true,
        },

        /** Partner's own unique ID for this merchant (e.g. "cpd_1010") */
        merchantId: {
            type: String,
            required: true,
        },

        /** Display name of the merchant */
        merchantName: {
            type: String,
            required: true,
            trim: true,
        },

        /** Merchant's main website URL */
        website: {
            type: String,
            default: null,
        },

        /** Bare domain name (e.g. "booking.com") */
        domain: {
            type: String,
            default: null,
            index: true,
        },

        /** Country associated with the merchant (may be null) */
        country: {
            type: String,
            default: null,
        },

        /** URL to the merchant's logo image */
        logo: {
            type: String,
            default: null,
        },

        /** Partner's quality / popularity rating for this merchant */
        stars: {
            type: Number,
            default: null,
        },

        /** Whether the partner has flagged this merchant as featured */
        featured: {
            type: Boolean,
            default: false,
        },

        /** Affiliate tracking link provided by the partner */
        affiliateLink: {
            type: String,
            default: null,
        },

        /** Category IDs the merchant belongs to (partner's taxonomy) */
        categoryIds: {
            type: [String],
            default: [],
        },

        /** Human-readable category names corresponding to categoryIds */
        categoryNames: {
            type: [String],
            default: [],
        },

        /** Soft-delete / visibility flag */
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },

        /** Saved browser session cookies */
        cookies: {
            type: Schema.Types.Mixed,
            default: null,
        },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

/** Primary dedup key: one record per merchant per partner */
partnerMerchantSchema.index(
    { partner: 1, merchantId: 1 },
    { unique: true }
);

const PartnerMerchant = model("partnermerchant", partnerMerchantSchema);
export default PartnerMerchant;
