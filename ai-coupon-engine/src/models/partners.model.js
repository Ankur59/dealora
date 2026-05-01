import mongoose, { Schema, model } from "mongoose";

const apiDiffSchema = new Schema({
    // Our standard schema field name (e.g., 'campaignId', 'title', 'trackingLink')
    standardField: {
        type: String,
        required: true
    },
    // The partner's API response field name (e.g., 'id', 'name', 'url')
    partnerField: {
        type: String,
        required: true
    },
    // Optional: a default value if the partner field is missing
    defaultValue: {
        type: Schema.Types.Mixed
    },
    // Optional: type casting (e.g., 'String', 'Number', 'Date', 'Boolean')
    castTo: {
        type: String,
        enum: ['String', 'Number', 'Date', 'Boolean', 'Array'],
        default: 'String'
    }
}, { _id: false });

const partnerApiSchema = new Schema({
    apiUrl: {
        type: String,
        required: true
    },
    apiType: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'GET',
        required: true
    },
    apiParams: {
        type: Schema.Types.Mixed, // e.g. { "apikey": "123", "format": "json" }
        default: {}
    },
    apiDescription: {
        type: String
    },
    // Target schema that this API will normalize into
    targetSchema: {
        type: String,
        enum: ['campaign', 'coupon', 'category'],
        required: true
    },
    // A list of fields the partner API responds with, for reference
    apiResponseFields: {
        type: [String],
        default: []
    },
    // The field containing the array of items in the API response (e.g., 'data.coupons')
    responseItemPath: {
        type: String,
        default: ''
    },
    // The mapping rules connecting our standard schema to the partner's API fields
    apiDiff: {
        type: [apiDiffSchema],
        default: []
    }
});

const partnerSchema = new Schema({
    partnerName: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    /** Shown in the internal dashboard and stored for ops context */
    description: {
        type: String,
        maxlength: 4000,
        default: '',
    },
    website: {
        type: String,
        maxlength: 500,
        default: '',
    },
    notes: {
        type: String,
        maxlength: 4000,
        default: '',
    },
    partnerApis: {
        type: [partnerApiSchema],
        default: []
    }
}, { timestamps: true });

const Partner = model("partner", partnerSchema);

export default Partner;
