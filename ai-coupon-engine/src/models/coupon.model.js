import mongoose, { model, Schema } from "mongoose";

const couponSchema = new Schema({
    partner: { type: String },
    couponId: { type: String },
    code: { type: String },
    couponCode: { type: String },
    description: { type: String },
    type: { type: String, enum: ["generic", "exclusive", "one_time"] },
    status: { type: String, enum: ["active", "pending", "expired", "invalid", "valid"] },
    start: { type: Date },
    end: { type: Date },
    trackingLink: { type: String },
    brandName: { type: String, required: true },
    verifiedOn: { type: Date },
    isVerified: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    verificationReason: { type: String },
    campaignId: { type: String, index: true },
    meta: { type: Schema.Types.Mixed },
    countries: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    categoriesId: { type: [String], default: [] },
    couponVisitingLink: { type: String },
    discount: { type: String },
    couponName: { type: String },
    couponTitle: { type: String },
    discountType: { type: String },
    discountValue: { type: String },
    minimumOrder: { type: String },
    sourceWebsite: { type: String },
    terms: { type: String },
    expireBy: { type: Date },
    categoryLabel: { type: String },
    trustscore: { type: Number },
    addedMethod: { type: String },
    useCouponVia: { type: String },
    userId: { type: String },
    redeemedAt: { type: Date },
    usedBy: { type: [String] }
}, { timestamps: true, strict: false });

couponSchema.index({ partner: 1, couponId: 1 });
couponSchema.index({ couponCode: 1 });
couponSchema.index({ brandName: 1 });
couponSchema.index({ verified: 1 });

const coupon = model("partnercoupon", couponSchema, "coupons");

export default coupon;
