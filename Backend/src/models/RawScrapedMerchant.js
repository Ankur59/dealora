const mongoose = require('mongoose');

/**
 * RawScrapedMerchant — stores distinct brand information extracted from rawScrapedCoupons.
 * 
 * Purpose: Provide a clean list of all brands discovered by the scrapers.
 * Fields follow the Merchant schema used in the app.
 */

const rawScrapedMerchantSchema = new mongoose.Schema(
    {
        merchantName: {
            type: String,
            trim: true,
            required: true,
            unique: true,
            index: true,
        },

        category: {
            type: String,
            trim: true,
            default: 'Other',
        },

        domain: {
            type: String,
            trim: true,
            default: null,
        },

        merchantUrl: {
            type: String,
            trim: true,
            default: null,
        },

        score: {
            type: Number,
            default: 0,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        sourceAdapters: [{
            type: String,
            trim: true,
        }],

        lastScrapedAt: {
            type: Date,
            default: Date.now,
        },

        couponCount: {
            type: Number,
            default: 0,
        },

        logoUrl: {
            type: String,
            trim: true,
            default: null,
        }
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'rawscrapedmerchants',
    }
);

// Index for category-based filtering
rawScrapedMerchantSchema.index({ category: 1 });

const RawScrapedMerchant = mongoose.model('RawScrapedMerchant', rawScrapedMerchantSchema);

module.exports = RawScrapedMerchant;
