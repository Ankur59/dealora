const mongoose = require('mongoose');
const { isValidUrl } = require('../utils/validators');

const couponSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: [true, 'User ID is required'],
            index: true,
            trim: true,
        },

        couponName: {
            type: String,
            required: [true, 'Coupon name is required'],
            trim: true,
            minlength: [3, 'Coupon name must be at least 3 characters'],
            maxlength: [100, 'Coupon name cannot exceed 100 characters'],
        },

        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            minlength: [10, 'Description must be at least 10 characters'],
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },

        expireBy: {
            type: Date,
            required: [true, 'Expiry date is required'],
        },

        categoryLabel: {
            type: String,
            required: [true, 'Category is required'],
            enum: {
                values: ['Food', 'Fashion', 'Electronics', 'Travel', 'Health', 'Other'],
                message: 'Category must be one of: Food, Fashion, Electronics, Travel, Health, Other',
            },
        },

        useCouponVia: {
            type: String,
            required: [true, 'Use coupon via is required'],
            enum: {
                values: ['Coupon Code', 'Coupon Visiting Link', 'Both'],
                message: 'Use coupon via must be one of: Coupon Code, Coupon Visiting Link, Both',
            },
        },

        couponCode: {
            type: String,
            trim: true,
            uppercase: true,
            minlength: [4, 'Coupon code must be at least 4 characters'],
            maxlength: [20, 'Coupon code cannot exceed 20 characters'],
            default: null,
        },

        couponVisitingLink: {
            type: String,
            trim: true,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return isValidUrl(value);
                },
                message: 'Coupon visiting link must be a valid URL',
            },
            default: null,
        },

        couponDetails: {
            type: String,
            trim: true,
            maxlength: [1000, 'Coupon details cannot exceed 1000 characters'],
            default: null,
        },

        status: {
            type: String,
            enum: ['active', 'redeemed', 'expired'],
            default: 'active',
        },

        addedMethod: {
            type: String,
            enum: ['manual', 'auto-sync'],
            default: 'manual',
        },

        redeemedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

couponSchema.pre('save', function (next) {
    if (this.couponCode) {
        this.couponCode = this.couponCode.toUpperCase().trim();
    }

    if (this.expireBy && new Date(this.expireBy) < new Date()) {
        if (this.status === 'active') {
            this.status = 'expired';
        }
    }

    next();
});

couponSchema.pre('save', function (next) {
    const useCouponVia = this.useCouponVia;

    if (useCouponVia === 'Coupon Code' || useCouponVia === 'Both') {
        if (!this.couponCode || this.couponCode.trim() === '') {
            return next(new Error('Coupon code is required when useCouponVia is Coupon Code or Both'));
        }
    }

    if (useCouponVia === 'Coupon Visiting Link' || useCouponVia === 'Both') {
        if (!this.couponVisitingLink || this.couponVisitingLink.trim() === '') {
            return next(new Error('Coupon visiting link is required when useCouponVia is Coupon Visiting Link or Both'));
        }
    }

    next();
});

couponSchema.index({ userId: 1, status: 1 });
couponSchema.index({ expireBy: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;

