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

        brandName: {
            type: String,
            trim: true,
            index: true,
            default: 'General',
        },

        couponTitle: {
            type: String,
            trim: true,
            maxlength: [200, 'Coupon title cannot exceed 200 characters'],
        },

        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            minlength: [10, 'Description must be at least 10 characters'],
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },

        expireBy: {
            type: Date,
            required: [true, 'Expiry date is required'],
        },

        categoryLabel: {
            type: String,
            required: [true, 'Category is required'],
            enum: {
                values: ['Food', 'Fashion', 'Grocery', 'Wallet Rewards', 'Beauty', 'Travel', 'Entertainment', 'Other'],
                message: 'Category must be one of: Food, Fashion, Grocery, Wallet Rewards, Beauty, Travel, Entertainment, Other',
            },
        },

        useCouponVia: {
            type: String,
            required: [true, 'Use coupon via is required'],
            enum: {
                values: ['Coupon Code', 'Coupon Visiting Link', 'Both', 'None'],
                message: 'Use coupon via must be one of: Coupon Code, Coupon Visiting Link, Both, None',
            },
            default: 'Coupon Code',
        },

        discountType: {
            type: String,
            enum: ['percentage', 'flat', 'cashback', 'freebie', 'buy1get1', 'free_delivery', 'wallet_upi', 'prepaid_only', 'unknown'],
            default: 'unknown',
        },

        discountValue: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        minimumOrder: {
            type: Number,
            default: null,
            min: [0, 'Minimum order value cannot be negative'],
        },

        couponCode: {
            type: String,
            trim: true,
            uppercase: true,
            maxlength: [50, 'Coupon code cannot exceed 50 characters'],
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
            maxlength: [2000, 'Coupon details cannot exceed 2000 characters'],
            default: null,
        },

        sourceWebsite: {
            type: String,
            trim: true,
            default: 'manual',
        },

        terms: {
            type: String,
            trim: true,
            maxlength: [2000, 'Terms cannot exceed 2000 characters'],
            default: null,
        },

        status: {
            type: String,
            enum: ['active', 'redeemed', 'expired'],
            default: 'active',
        },

        addedMethod: {
            type: String,
            enum: ['manual', 'auto-sync', 'scraper'],
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

    if (this.expireBy) {
        const expireDate = new Date(this.expireBy);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expireDate.setHours(0, 0, 0, 0);

        if (expireDate < today && this.status === 'active') {
            this.status = 'expired';
        }
    }

    next();
});

couponSchema.index({ userId: 1, status: 1 });
couponSchema.index({ brandName: 1, status: 1 });
couponSchema.index({ expireBy: 1, status: 1 });
couponSchema.index({ brandName: 1, couponCode: 1 }, { sparse: true }); // For deduplication
couponSchema.index({ categoryLabel: 1, status: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;

