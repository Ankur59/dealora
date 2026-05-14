import mongoose, { model, Mongoose, Schema } from "mongoose";


const couponSchema = new Schema({
    partner: {
        type: String,
        required: true
    },
    couponId: {
        type: String,
        required: true
    },
    code: {
        type: String,
    },
    description: {
        type: String
    },
    type: {
        type: String,
        enum: ["generic", "exclusive", "one_time"],
        default: "generic"
    },
    status: {
        type: String,
        enum: ["active", "pending", "expired"],
        default: "active",
        index: true
    },
    start: {
        type: Date
    },
    end: {
        type: Date
    },
    trackingLink: {
        type: String,
    },
    brandName: {
        type: String,
        required: true,
        index: true
    },
    verifiedOn: {
        type: Date
    },
    verifiedAt: {
        type: Date,
        index: true
    },
    isVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    campaignId: {
        type: String,
        index: true
    },
    meta: {
        type: Schema.Types.Mixed
    },
    countries: {
        type: [String],
        default: []
    },
    categories: {
        type: [String],
        default: []
    },
    categoriesId: {
        type: [String],
        default: []
    },
    couponVisitingLink: {
        type: String,
    },
    discount: {
        type: String,
    },
    merchantName: {
        type: String,
        index: true
    },
    couponType: {
        type: String,
        enum: ["FREE TRIAL", "Buy 1 Get 1 Free", "No cost EMI", "Other"],
    },
    isInStore: {
        type: Boolean,
        default: false,
    },
    isNewUser: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
    },
    networkId: {
        type: String
    },
    merchantId: {
        type: String,
        index: true
    },
    merchantLogo: {
        type: String
    },
    metchantLogo: {
        type: String
    },
    discountWeight: {
        type: Number,
        default: 0,
        index: true
    }
}, { timestamps: true });


couponSchema.index(
    { partner: 1, couponId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            couponId: { $exists: true }
        }
    }
);


couponSchema.index(
    { code: 1 },
    {
        unique: true,
        partialFilterExpression: {
            code: { $type: "string" }
        }
    }
);

couponSchema.index({ partner: 1, isVerified: 1, verifiedOn: -1 });
couponSchema.index({ verifiedOn: -1, updatedAt: -1 });
couponSchema.index({ discountWeight: -1 });   // sort high-value coupons first

const coupon = model("partnercoupon", couponSchema)


export default coupon