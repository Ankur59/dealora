const mongoose = require('mongoose');

const RedemptionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    redeemedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound unique index to prevent duplicate redemptions for the same user and coupon
RedemptionSchema.index({ userId: 1, couponId: 1 }, { unique: true });

module.exports = mongoose.model('Redemption', RedemptionSchema);
