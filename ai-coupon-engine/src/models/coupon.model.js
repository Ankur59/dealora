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
        enum: ["generic", "exclusive", "one_time"]
    },
    status: {
        type: String,
        enum: ["active", "pending", "expired"]
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
        required: true
    },
    verifiedOn: {
        type: Date
    },
    verifiedAt: {
        type: Date
    },
    isVerified: {
        type: Boolean,
        default: false
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
    // AI Coupon Scoring Parameters
    liveSuccessRate: { type: Number, default: 0 },
    recencyScore: { type: Number, default: 0 },
    failureRate: { type: Number, default: 0 },
    trustScore: { type: Number, default: 0 },
    usedByCount: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    contextMatchScore: { type: Number, default: 0 },
    sourceCredibilityScore: { type: Number, default: 0 },
    trendVelocity: { type: Number, default: 0 },
    finalScore: { type: Number, default: 0 },

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

const coupon = model("partnercoupon", couponSchema)


export default coupon