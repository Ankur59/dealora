const express = require('express');
const router = express.Router();
const {
    getNotifications,
    getNotificationById,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getUnreadCount,
    createNotification,
} = require('../controllers/notificationController');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for a user
 * @query   userId, type, isRead, limit, page, sortBy, sortOrder
 * @access  Public (add authentication later)
 */
router.get('/', getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count for a user
 * @query   userId
 * @access  Public
 */
router.get('/unread-count', getUnreadCount);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get single notification by ID
 * @access  Public
 */
router.get('/:id', getNotificationById);

/**
 * @route   POST /api/notifications
 * @desc    Create a notification manually (admin use)
 * @access  Public (add admin authentication later)
 */
router.post('/', createNotification);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Public
 */
router.patch('/:id/read', markAsRead);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read for a user
 * @body    userId
 * @access  Public
 */
router.patch('/read-all', markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Public
 */
router.delete('/:id', deleteNotification);

/**
 * @route   DELETE /api/notifications/clear-all
 * @desc    Clear all notifications for a user
 * @body    userId
 * @access  Public
 */
router.delete('/clear-all', clearAllNotifications);

module.exports = router;
