import mongoose, { Schema, model } from "mongoose";

const validatorOfferSchema = new Schema({
    partnerName: {
        type: String,
        required: true,
        index: true
    },
    offerCode: {
        type: String,
        required: true
    },
    offerUrl: {
        type: String,
        required: true
    },
    offerTermsAndConditions: {
        type: String,
        default: ""
    },
    offerType: {
        type: String,
        default: "discount"
    },
    offerValue: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastValidated: {
        type: Date,
        default: null
    },
    lastStatus: {
        type: String,
        enum: ['VALID', 'INVALID', 'ERROR', 'PENDING'],
        default: 'PENDING'
    }
}, { timestamps: true });

const ValidatorOffer = model("validatoroffer", validatorOfferSchema);

export default ValidatorOffer;
