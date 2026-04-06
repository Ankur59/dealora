import mongoose from "mongoose";

const { Schema } = mongoose;

const categorySchema = new Schema({
    apiId: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    apiCreatedAt: {
        type: Date,
    },
    apiUpdatedAt: {
        type: Date,
    }

}, {
    timestamps: true
});

export const Category = mongoose.model("Category", categorySchema);