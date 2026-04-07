import mongoose, { model, Mongoose, Schema } from "mongoose";


const couponSchema = new Schema({
    partner: {
        type: String,
        required: true
    },

    couponId: {
        type: String,
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
    verifiedOn: {
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
    }

}, { timestamps: true });


couponSchema.index(
    { partner: 1, couponId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            couponId: { $exists: true, $ne: null }
        }
    }
);


couponSchema.index(
    { code: 1 },
    {
        unique: true,
        partialFilterExpression: {
            code: { $exists: true, $ne: null }
        }
    }
);

const coupon = model("partnercoupon", couponSchema)


export default coupon