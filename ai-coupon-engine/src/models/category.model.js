import mongoose from "mongoose";

const { Schema } = mongoose;
const categorySchema = new Schema({
    partner: {
        type: String,
        required: true,
    },
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
        required: function () {
            return this.partner === "vcommission";
        }
    },
    apiUpdatedAt: {
        type: Date,
        required: function () {
            return this.partner === "vcommission";
        }
    },
    parentId: {
        type: String,
        required: function () {
            return this.partner === "coupomated";
        }
    }

}, {
    timestamps: true
});

export const Category = mongoose.model("Category", categorySchema);