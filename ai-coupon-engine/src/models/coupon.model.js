import mongoose, { model, Mongoose, Schema } from "mongoose";
import campaign from "./campaign.model";

const couponSchema = new Schema({
    id: {
        type: String,
        required: true,
        unique: [true, "coupon id should be unique"]
    },
    code: {
        type: String,
    },
    description: {
        type: String
    },
    status: {
        type: String,
        enum: ["active", "pending", "expired"]
    },
    type: {
        type: String,
        enum: ["generic", "exclusive", "expired"]
    },
    campaignName: {
        type: String
    },
    campaignId: {
        type: Number,
        required: true,
        index: true
    },
    start: {
        type: Date
    },
    end: {
        type: Date
    },
    created: {
        type: Date
    }
}, { timestamps: true })



const coupon = model("partnercoupon", couponSchema)


export default coupon