const mongoose = require('mongoose');

const exclusiveCouponSchema = new mongoose.Schema(
    {
        couponName: {
            type: String,
            required: [true, 'Coupon name is required'],
            trim: true,
        },
        brandName: {
            type: String,
            required: [true, 'Brand name is required'],
            trim: true,
            index: true,
        },
        description: {
            type: String,
            trim: true,
        },
        expiryDate: {
            type: Date,
        },
        category: {
            type: String,
            trim: true,
            index: true,
        },
        couponCode: {
            type: String,
            required: [true, 'Coupon code is required'],
            trim: true,
            uppercase: true,
            index: true,
        },
        couponLink: {
            type: String,
            trim: true,
        },
        details: {
            type: String,
            trim: true,
            maxlength: [5000, 'Details cannot exceed 5000 characters'],
        },
        terms: {
            type: String,
            trim: true,
            maxlength: [5000, 'Terms cannot exceed 5000 characters'],
        },
        stackable: {
            type: String,
            trim: true,
        },
        source: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Index for efficient querying
exclusiveCouponSchema.index({ expiryDate: 1 });
exclusiveCouponSchema.index({ brandName: 1, category: 1 });

// Compound unique index on brandName + couponName to prevent duplicate coupons
// This allows editing coupon codes while maintaining the same coupon identity
exclusiveCouponSchema.index({ brandName: 1, couponName: 1 }, { unique: true });

const ExclusiveCoupon = mongoose.model('ExclusiveCoupon', exclusiveCouponSchema);

module.exports = ExclusiveCoupon;
