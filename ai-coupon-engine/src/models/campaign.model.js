import mongoose, { model, Schema } from "mongoose";

const campaignSchema = new Schema({
    partner: {
        type: String,
        required: true,
    },
    campaignId: {
        type: Number,
        require: true,
        index: true
    },
    title: {
        type: String,
        require: true,
    },
    categories: {
        type: [String],
        default: [],
    },
    trackingLink: {
        type: String
    },
    countries: {
        type: [String],
    },
    meta: {
        type: mongoose.Schema.Types.Mixed
    }

}, { timestamps: true })


campaignSchema.index(
    { partner: 1, campaignId: 1 },
    { unique: true }
);

const campaign = new model("campaign", campaignSchema)

export default campaign
