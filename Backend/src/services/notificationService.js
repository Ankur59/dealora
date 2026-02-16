const firebaseAdmin = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Service to handle Firebase Cloud Messaging notifications
 */
const notificationService = {
    /**
     * Send a notification to a single device
     * @param {string} token FCM device token
     * @param {string} title Notification title
     * @param {string} body Notification body text
     * @param {Object} data Optional data payload
     */
    sendNotification: async (token, title, body, data = {}) => {
        if (!firebaseAdmin) {
            logger.error('Notification failed: Firebase not initialized');
            return null;
        }

        const message = {
            notification: {
                title,
                body,
            },
            data: {
                ...data,
                click_action: 'ANDROID_NOTIFICATION_CLICK', // Common for mobile apps
            },
            token: token,
        };

        try {
            const response = await firebaseAdmin.messaging().send(message);
            logger.info('Successfully sent message:', response);
            return response;
        } catch (error) {
            logger.error('Error sending message:', error);
            throw error;
        }
    },

    /**
     * Send the same notification to multiple tokens
     * @param {string[]} tokens Array of FCM device tokens
     * @param {string} title Notification title
     * @param {string} body Notification body text
     * @param {Object} data Optional data payload
     */
    sendMulticastNotification: async (tokens, title, body, data = {}) => {
        if (!firebaseAdmin) {
            logger.error('Multicast notification failed: Firebase not initialized');
            return null;
        }

        if (!tokens || tokens.length === 0) {
            logger.info('No tokens provided for multicast notification');
            return null;
        }

        // sendEachForMulticast expects an array of message objects
        const messages = tokens.map(token => ({
            notification: {
                title,
                body,
            },
            data: {
                ...data,
                click_action: 'ANDROID_NOTIFICATION_CLICK',
            },
            token: token,
        }));

        try {
            const response = await firebaseAdmin.messaging().sendEach(messages);
            logger.info(`${response.successCount} messages were sent successfully`);

            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(tokens[idx]);
                        logger.error(`Token ${tokens[idx]} failed: ${resp.error.message}`);
                    }
                });
            }

            return response;
        } catch (error) {
            logger.error('Error sending multicast message:', error);
            throw error;
        }
    }
};

module.exports = notificationService;
