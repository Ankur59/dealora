import mongoose, { model, Mongoose, Schema } from "mongoose";
import campaign from "./campaign.model";

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
        type: String
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
    { unique: true })

const coupon = model("partnercoupon", couponSchema)




export default coupon