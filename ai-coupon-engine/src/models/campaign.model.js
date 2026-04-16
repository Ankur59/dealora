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
    domain: {
        type: String,
        trim: true,
        lowercase: true
    },
    loginUrl: {
        type: String,
        trim: true
    },
    countries: {
        type: [String],
    },
    score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
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
