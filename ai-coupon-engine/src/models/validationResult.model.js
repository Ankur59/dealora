import mongoose, { Schema, model } from "mongoose";

const validationResultSchema = new Schema({
    offerId: {
        type: Schema.Types.ObjectId,
        ref: "validatoroffer",
        required: true
    },
    partnerName: {
        type: String,
        required: true,
        index: true
    },
    merchantLink: {
        type: String
    },
    offerCode: {
        type: String
    },
    offerTermsAndConditions: {
        type: String
    },
    status: {
        type: String,
        enum: ['VALID', 'INVALID', 'ERROR'],
        required: true
    },
    aiResponse: {
        type: String,
        default: ""
    },
    errorMessage: {
        type: String,
        default: ""
    },
    stepsTaken: {
        type: Number,
        default: 0
    },
    testedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const ValidationResult = model("validationresult", validationResultSchema);

export default ValidationResult;
