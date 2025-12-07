const admin = require('firebase-admin');
const logger = require('../utils/logger');

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

        if (projectId && privateKey && clientEmail) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    privateKey,
                    clientEmail,
                }),
            });
            logger.info('🔥 Firebase initialized');
        } else {
            logger.warn('⚠️  Missing Firebase credentials');
        }

        return admin;
    } catch (error) {
        logger.error('❌ Firebase initialization failed:', error.message);
        return null;
    }
};

const firebaseAdmin = initializeFirebase();

module.exports = firebaseAdmin;
