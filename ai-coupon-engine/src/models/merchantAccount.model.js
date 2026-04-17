import mongoose, { model, Schema } from 'mongoose';

// Simple vault to hold automated user accounts for platforms
const merchantAccountSchema = new Schema({
    domain: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    username: {
        type: String,
        default: ''
    },
    password: {
        type: String,
        default: ''
    },
    lastLogin: {
        type: Date
    },
    status: {
        type: String,
        enum: ['active', 'locked', 'needs_otp', 'pending'],
        default: 'active'
    }
}, { timestamps: true });

const MerchantAccount = new model('merchantAccount', merchantAccountSchema);
export default MerchantAccount;
