import mongoose, { model, Schema } from 'mongoose';

const automationMapSchema = new Schema({
    domain: {
        type: String,
        required: true,
        index: true,
        trim: true,
        lowercase: true
    },
    flowType: {
        type: String,
        required: true,
        enum: ['login', 'signup', 'general']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    steps: [{
        step: { type: Number },
        action: { type: String, required: true }, // 'click', 'type', 'navigate', 'request_otp', 'evaluate'
        selector: { type: String },
        value: { type: String },  // Could be literal or variable `<USERNAME>`, `<PASSWORD>`
        url: { type: String },    // Used for 'navigate' context or just reference context
        ms: { type: Number }      // for 'wait'
    }]
}, { timestamps: true });

// Ensure unique mapping per domain per flow type
automationMapSchema.index({ domain: 1, flowType: 1 }, { unique: true });

const AutomationMap = new model('automationMap', automationMapSchema);
export default AutomationMap;
