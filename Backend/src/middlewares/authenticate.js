/**
 * Authentication Middleware
 * 
 * Verifies Firebase ID tokens from Authorization header.
 * Protects routes that require authentication.
 * 
 * Can be extended to use JWT instead of Firebase Admin SDK.
 * 
 * @module middlewares/authenticate
 */

const admin = require('firebase-admin');
const { UnauthorizedError, NotFoundError } = require('./errorHandler');
const { ERROR_MESSAGES } = require('../config/constants');
const logger = require('../utils/logger');
const User = require('../models/User');

/**
 * Initialize Firebase Admin SDK
 * 
 * Reads credentials from environment variables.
 * Only initializes if Firebase credentials are provided.
 */
let firebaseInitialized = false;

const initializeFirebase = () => {
    if (firebaseInitialized) return;

    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

        if (projectId && privateKey && clientEmail) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    privateKey,
                    clientEmail,
                }),
            });
            firebaseInitialized = true;
            logger.info('🔥 Firebase Admin SDK initialized successfully');
        } else {
            logger.warn('⚠️  Firebase credentials not found. Token verification will be skipped in development.');
        }
    } catch (error) {
        logger.error('❌ Firebase Admin SDK initialization failed:', error.message);
    }
};

// Initialize Firebase on module load
initializeFirebase();

/**
 * Authentication Middleware
 * 
 * Extracts and verifies Firebase ID token from Authorization header.
 * Attaches authenticated user to req.user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @throws {UnauthorizedError} If token is missing, invalid, or expired
 * @throws {NotFoundError} If user not found in database
 */
const authenticate = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided. Please include Bearer token in Authorization header.');
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            throw new UnauthorizedError('Invalid token format');
        }

        // Development mode: Skip Firebase verification if not initialized
        if (!firebaseInitialized && process.env.NODE_ENV === 'development') {
            logger.warn('⚠️  Development mode: Skipping Firebase token verification');

            // In development, you can extract UID from token payload (if using custom JWT)
            // or use a mock UID for testing
            // For now, we'll require a uid query parameter for testing
            const testUid = req.query.uid || req.body.uid;

            if (!testUid) {
                throw new UnauthorizedError('In development mode without Firebase, provide uid in request');
            }

            const user = await User.findByUid(testUid);
            if (!user) {
                throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            req.user = user;
            return next();
        }

        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        logger.info(`🔐 Token verified for UID: ${uid}`);

        // Fetch user from database
        const user = await User.findByUid(uid);

        if (!user) {
            throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        if (!user.isActive) {
            throw new UnauthorizedError('User account is deactivated');
        }

        // Attach user to request object
        req.user = user;
        req.uid = uid;

        next();
    } catch (error) {
        logger.error('Authentication error:', error.message);

        // Handle Firebase specific errors
        if (error.code === 'auth/id-token-expired') {
            return next(new UnauthorizedError(ERROR_MESSAGES.TOKEN_EXPIRED));
        }

        if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
            return next(new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN));
        }

        // Pass error to global error handler
        next(error);
    }
};

module.exports = authenticate;
