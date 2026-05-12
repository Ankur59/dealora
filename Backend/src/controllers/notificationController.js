const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Helper to resolve userId/uid to MongoDB ObjectId
 */
const resolveUserObjectId = async (userIdOrUid) => {
    if (!userIdOrUid) return null;

    // Check if it's already a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(userIdOrUid)) {
        return userIdOrUid;
    }

    // Otherwise, treat as Firebase uid and find the user
    const user = await User.findOne({ uid: userIdOrUid }).select('_id').lean();
    return user ? user._id : null;
};

/**
 * GET /notifications - Get all notifications for a user
 */
const getNotifications = async (req, res, next) => {
    try {
        const { userId: rawUserId } = req.query;

        // Build query
        const query = {};

        if (rawUserId) {
            const resolvedId = await resolveUserObjectId(rawUserId);
            if (resolvedId) {
                query.userId = { $in: [resolvedId] };
            } else {
                // If userId/uid provided but not found, return empty list
                return successResponse(
                    res,
                    STATUS_CODES.OK,
                    'Notifications retrieved successfully',
                    { notifications: [] }
                );
            }
        }

        // Execute query - only get title, body and createdAt
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .select('title body createdAt')
            .lean();

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Notifications retrieved successfully',
            {
                notifications,
            }
        );
    } catch (error) {
        logger.error('Get notifications error:', error);
        return next(error);
    }
};

/**
 * GET /notifications/:id - Get single notification by ID
 */
const getNotificationById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findById(id)
            .select('_id title body type isRead createdAt data')
            .lean();

        if (!notification) {
            return errorResponse(
                res,
                STATUS_CODES.NOT_FOUND,
                'Notification not found'
            );
        }

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Notification retrieved successfully',
            notification
        );
    } catch (error) {
        logger.error('Get notification by ID error:', error);
        return next(error);
    }
};

/**
 * PATCH /notifications/:id/read - Mark notification as read
 */
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findById(id);

        if (!notification) {
            return errorResponse(
                res,
                STATUS_CODES.NOT_FOUND,
                'Notification not found'
            );
        }

        await notification.markAsRead();

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Notification marked as read',
            notification
        );
    } catch (error) {
        logger.error('Mark as read error:', error);
        return next(error);
    }
};

/**
 * PATCH /notifications/read-all - Mark all notifications as read for a user
 */
const markAllAsRead = async (req, res, next) => {
    try {
        const { userId: rawUserId } = req.body;

        if (!rawUserId) {
            return errorResponse(
                res,
                STATUS_CODES.BAD_REQUEST,
                'User ID is required'
            );
        }

        const resolvedId = await resolveUserObjectId(rawUserId);
        if (!resolvedId) {
            return errorResponse(
                res,
                STATUS_CODES.NOT_FOUND,
                'User not found'
            );
        }

        const result = await Notification.markAllAsRead(resolvedId);

        return successResponse(
            res,
            STATUS_CODES.OK,
            'All notifications marked as read',
            {
                modifiedCount: result.modifiedCount,
            }
        );
    } catch (error) {
        logger.error('Mark all as read error:', error);
        return next(error);
    }
};

/**
 * DELETE /notifications/:id - Delete a notification
 */
const deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findByIdAndDelete(id);

        if (!notification) {
            return errorResponse(
                res,
                STATUS_CODES.NOT_FOUND,
                'Notification not found'
            );
        }

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Notification deleted successfully'
        );
    } catch (error) {
        logger.error('Delete notification error:', error);
        return next(error);
    }
};

/**
 * DELETE /notifications/clear-all - Clear all notifications for a user
 */
const clearAllNotifications = async (req, res, next) => {
    try {
        const { userId: rawUserId } = req.body;

        if (!rawUserId) {
            return errorResponse(
                res,
                STATUS_CODES.BAD_REQUEST,
                'User ID is required'
            );
        }

        const resolvedId = await resolveUserObjectId(rawUserId);
        if (!resolvedId) {
            return errorResponse(
                res,
                STATUS_CODES.NOT_FOUND,
                'User not found'
            );
        }

        const result = await Notification.deleteMany({ userId: { $in: [resolvedId] } });

        return successResponse(
            res,
            STATUS_CODES.OK,
            'All notifications cleared',
            {
                deletedCount: result.deletedCount,
            }
        );
    } catch (error) {
        logger.error('Clear all notifications error:', error);
        return next(error);
    }
};

/**
 * GET /notifications/unread-count - Get unread notification count
 */
const getUnreadCount = async (req, res, next) => {
    try {
        const { userId: rawUserId } = req.query;

        if (!rawUserId) {
            return errorResponse(
                res,
                STATUS_CODES.BAD_REQUEST,
                'User ID is required'
            );
        }

        const resolvedId = await resolveUserObjectId(rawUserId);
        if (!resolvedId) {
            return successResponse(
                res,
                STATUS_CODES.OK,
                'Unread count retrieved successfully',
                { unreadCount: 0 }
            );
        }

        const count = await Notification.getUnreadCount(resolvedId);

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Unread count retrieved successfully',
            { unreadCount: count }
        );
    } catch (error) {
        logger.error('Get unread count error:', error);
        return next(error);
    }
};

/**
 * POST /notifications - Create a notification manually (admin use)
 */
const createNotification = async (req, res, next) => {
    try {
        const {
            userId,
            title,
            body,
            type,
            data,
            couponId,
            couponModel,
            priority,
            actionUrl,
        } = req.body;

        if (!title || !body) {
            return errorResponse(
                res,
                STATUS_CODES.BAD_REQUEST,
                'Title and body are required'
            );
        }

        const resolvedId = await resolveUserObjectId(userId);

        const notification = await Notification.create({
            userId: resolvedId ? [resolvedId] : [],
            title,
            body,
            type: type || 'general',
            data: data || {},
            couponId: couponId || null,
            couponModel: couponModel || null,
            priority: priority || 'medium',
            actionUrl: actionUrl || null,
        });

        return successResponse(
            res,
            STATUS_CODES.CREATED,
            'Notification created successfully',
            notification
        );
    } catch (error) {
        logger.error('Create notification error:', error);
        return next(error);
    }
};

module.exports = {
    getNotifications,
    getNotificationById,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getUnreadCount,
    createNotification,
};
