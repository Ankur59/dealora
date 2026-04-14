import mongoose, { Schema, model } from "mongoose";

const validatorCredentialSchema = new Schema({
    partnerName: {
        type: String,
        required: true,
        unique: true
    },
    loginUrl: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const ValidatorCredential = model("validatorcredential", validatorCredentialSchema);

export default ValidatorCredential;

