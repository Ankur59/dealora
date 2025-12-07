/**
 * Firebase Configuration
 * 
 * Initializes Firebase Admin SDK for backend-side authentication.
 * Uses service account credentials from environment variables.
 * 
 * @module config/firebase
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

/**
 * Initialize Firebase Admin SDK
 * 
 * Only initializes if not already initialized.
 * Handles environment variables for credentials.
 * 
 * @returns {admin.app.App} Firebase Admin app instance
 */
const initializeFirebase = () => {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : undefined;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

        // In production, we strictly need credentials
        // In development, we can warn and skip if missing (auth middleware handles fallback)
        if (projectId && privateKey && clientEmail) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    privateKey,
                    clientEmail,
                }),
            });
            logger.info('🔥 Firebase Admin SDK initialized successfully');
        } else {
            logger.warn('⚠️  Missing Firebase credentials. Firebase features will not work correctly.');
        }

        return admin;
    } catch (error) {
        logger.error('❌ Firebase Admin SDK initialization failed:', error.message);
        // Don't crash the app, but log severe error
        return null;
    }
};

const firebaseAdmin = initializeFirebase();

module.exports = firebaseAdmin;
