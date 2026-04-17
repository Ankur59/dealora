import mongoose, { Schema, model } from "mongoose";

const merchantSchema = new Schema(
    {
        merchantName: {
            type: String,
            required: [true, "Merchant name is required"],
            unique: true,
            trim: true,
        },
        merchantUrl: {
            type: String,
            trim: true,
            default: "",
        },
        domain: {
            type: String,
            trim: true,
            lowercase: true,
            default: "",
        },
        partnerName: {
            type: String,
            trim: true,
            default: "",
        },
        score: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        logoUrl: {
            type: String,
            trim: true,
            default: "",
        },
        description: {
            type: String,
            trim: true,
            default: "",
        },
        meta: {
            type: Schema.Types.Mixed,
        },
    },
    {
        timestamps: true,
        collection: "merchants",
    }
);

// Indexes
merchantSchema.index({ domain: 1 });

const Merchant = model("Merchant", merchantSchema);

export default Merchant;
