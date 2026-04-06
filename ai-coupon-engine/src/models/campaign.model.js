import { model, Schema } from "mongoose";

const campaignSchema = new Schema({
    campaignId: {
        type: Number,
        require: true,
        index: true
    },
    title: {
        type: String,
        require: true,
    },

    currency: {
        type: String,
    },
    model: {
        type: String
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
    }

}, { timestamps: true })

const campaign = new model("campaign", campaignSchema)

export default campaign
