const { default: mongoose, Mongoose, Types } = require("mongoose")
const User = require("./User");
const { isValidUrl } = require("../utils/validators");



const ImportedSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: User,
        required: [true, "user ID is required"]
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
    fetchedEmail: {
        type: String,
        required: function () {
            this.source === "email-parsing"
        },
        trim: true,
        lowercase: true
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
        required: function () {
            return this.useCouponVia === 'Coupon Code' || this.useCouponVia === 'Both';
        },
        maxlength: [50, 'Coupon code cannot exceed 50 characters'],
        default: null,
    },
    couponVisitingLink: {
        type: String,
        trim: true,
        required: function () {
            this.useCouponVia === 'Coupon Visiting Link' || this.useCouponVia === 'Both'
        },
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
    source: {
        type: String,
        trim: true,
        required: [true, "source is required"],
        enum: ["email-parsing", "OCR", "manual"]
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
        required: [true, "Fetched Method in required"],
        enum: ["system-cron", "manual"],
        default: "manual"
    },
    redeemedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true })


ImportedSchema.pre('save', function (next) {
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
})



ImportedSchema.index({ userId: 1, status: 1 });
ImportedSchema.index({ brandName: 1, status: 1 });
ImportedSchema.index({ expireBy: 1, status: 1 });
ImportedSchema.index({ brandName: 1, couponCode: 1 }, { sparse: true });
ImportedSchema.index({ categoryLabel: 1, status: 1 });
ImportedSchema.index({ userId: 1, couponCode: 1, brandName: 1 }, { unique: true })


const ImportedCoupons = mongoose.model("ImportedCoupon", ImportedSchema);


module.exports = ImportedCoupons;