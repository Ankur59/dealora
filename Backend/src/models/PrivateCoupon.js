const mongoose = require('mongoose');

const privateCouponSchema = new mongoose.Schema(
    {
        brandName: {
            type: String,
            required: [true, 'Brand name is required'],
            trim: true,
            index: true,
        },
        couponTitle: {
            type: String,
            required: [true, 'Coupon title is required'],
            trim: true,
        },
        category: {
            type: String,
            trim: true,
        },
        expiryDate: {
            type: Date,
        },
        daysUntilExpiry: {
            type: Number,
        },
        description: {
            type: String,
            trim: true,
        },
        couponCode: {
            type: String,
            trim: true,
            uppercase: true,
        },
        redeemable: {
            type: Boolean,
            default: true,
        },
        minimumOrderValue: {
            type: String,
            trim: true,
        },
        couponLink: {
            type: String,
            trim: true,
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const PrivateCoupon = mongoose.model('PrivateCoupon', privateCouponSchema);

module.exports = PrivateCoupon;
