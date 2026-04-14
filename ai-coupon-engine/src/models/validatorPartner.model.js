import mongoose, { Schema, model } from "mongoose";

const validatorPartnerSchema = new Schema({
    partnerName: {
        type: String,
        required: true,
        unique: true
    },
    merchantLink: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const ValidatorPartner = model("validatorpartner", validatorPartnerSchema);

export default ValidatorPartner;
