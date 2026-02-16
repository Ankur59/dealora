const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * GET /notifications - Get all notifications for a user
 */
const getNotifications = async (req, res, next) => {
    try {
        const { userId } = req.query;
        const {
            type,
            isRead,
            limit = 20,
            page = 1,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = req.query;

        // Build query
        const query = {};
        
        if (userId) {
            query.userId = { $in: [userId] }; // Check if userId is in the array
        }

        if (type) {
            query.type = type;
        }

        if (isRead !== undefined) {
            query.isRead = isRead === 'true';
        }

        // Pagination
        const limitNum = Math.min(parseInt(limit), 100);
        const skip = (parseInt(page) - 1) * limitNum;

        // Sorting
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query
        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort(sort)
                .limit(limitNum)
                .skip(skip)
                .select('_id title body type isRead createdAt data')
                .lean(),
            Notification.countDocuments(query),
            userId ? Notification.getUnreadCount(userId) : 0,
        ]);

        return successResponse(
            res,
            STATUS_CODES.OK,
            'Notifications retrieved successfully',
            {
                count: notifications.length,
                total,
                unreadCount,
                page: parseInt(page),
                pages: Math.ceil(total / limitNum),
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
        const { userId } = req.body;

        if (!userId) {
            return errorResponse(
                res,
                STATUS_CODES.BAD_REQUEST,
                'User ID is required'
            );
        }

        const result = await Notification.markAllAsRead(userId);

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
        const { userId } = req.body;

        if (!userId) {
            return errorResponse(
                res,
                STATUS_CODES.BAD_REQUEST,
                'User ID is required'
            );
        }

        const result = await Notification.deleteMany({ userId });

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
        const { userId } = req.query;

        if (!userId) {
            return errorResponse(
                res,
                STATUS_CODES.BAD_REQUEST,
                'User ID is required'
            );
        }

        const count = await Notification.getUnreadCount(userId);

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

        const notification = await Notification.create({
            userId: userId || null,
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
