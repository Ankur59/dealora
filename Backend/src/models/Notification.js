const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        title: {
            type: String,
            required: [true, 'Notification title is required'],
            trim: true,
        },
        body: {
            type: String,
            required: [true, 'Notification body is required'],
            trim: true,
        },
        type: {
            type: String,
            enum: ['expiry_alert', 'new_coupon', 'general', 'promotional', 'reminder'],
            default: 'general',
            index: true,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        // Related coupon information
        couponId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'couponModel',
            default: null,
        },
        couponModel: {
            type: String,
            enum: ['Coupon', 'PrivateCoupon', 'ExclusiveCoupon'],
            default: null,
        },
        // Notification status
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        isSent: {
            type: Boolean,
            default: false,
        },
        sentAt: {
            type: Date,
            default: null,
        },
        readAt: {
            type: Date,
            default: null,
        },
        // Priority
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        // FCM specific
        fcmMessageId: {
            type: String,
            default: null,
        },
        // Action button
        actionUrl: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Indexes for efficient querying
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// Method to mark notification as read
notificationSchema.methods.markAsRead = async function () {
    this.isRead = true;
    this.readAt = new Date();
    return await this.save();
};

// Method to mark notification as sent
notificationSchema.methods.markAsSent = async function (messageId = null) {
    this.isSent = true;
    this.sentAt = new Date();
    if (messageId) {
        this.fcmMessageId = messageId;
    }
    return await this.save();
};

// Static method to mark multiple notifications as read
notificationSchema.statics.markAllAsRead = async function (userId) {
    return await this.updateMany(
        { userId: { $in: [userId] }, isRead: false },
        { isRead: true, readAt: new Date() }
    );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
    return await this.countDocuments({ userId: { $in: [userId] }, isRead: false });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
