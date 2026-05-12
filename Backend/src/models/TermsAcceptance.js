const mongoose = require('mongoose');
const User = require('./User');

/**
 * Stores a record of each user accepting a specific version of the Terms & Conditions.
 * One document per (userId, termsVersion) pair.
 * To re-prompt all users, bump CURRENT_TERMS_VERSION in termsController.js.
 */
const TermsAcceptanceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'userId is required'],
        },
        termsVersion: {
            type: String,
            required: [true, 'termsVersion is required'],
            trim: true,
        },
        acceptedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// One record per user per terms version
TermsAcceptanceSchema.index({ userId: 1, termsVersion: 1 }, { unique: true });

const TermsAcceptance = mongoose.model('TermsAcceptance', TermsAcceptanceSchema);

module.exports = TermsAcceptance;
