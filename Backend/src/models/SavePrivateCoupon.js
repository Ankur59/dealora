const mongoose = require('mongoose');

const SavePrivateCouponSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    savedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound unique index to prevent duplicate saves for the same user and coupon
SavePrivateCouponSchema.index({ userId: 1, couponId: 1 }, { unique: true });

module.exports = mongoose.model('SavePrivateCoupon', SavePrivateCouponSchema);
