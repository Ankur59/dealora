const { UnauthorizedError, NotFoundError } = require('./errorHandler');
const { ERROR_MESSAGES } = require('../config/constants');
const logger = require('../utils/logger');
const User = require('../models/User');
const firebaseAdmin = require('../config/firebase');

const firebaseInitialized = !!firebaseAdmin && firebaseAdmin.apps.length > 0;

const authenticate = async (req, res, next) => {
    try {
        if (!firebaseInitialized && process.env.NODE_ENV === 'development') {
            logger.warn('Development mode: Skipping Firebase token verification');
            const testUid = req.query.uid || req.body.uid;

            if (!testUid) {
                throw new UnauthorizedError('In development mode without Firebase, provide uid in query parameter or body');
            }

            const user = await User.findByUid(testUid);
            if (!user) {
                throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            req.user = user;
            req.uid = testUid;
            return next();
        }

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided. Please include Bearer token in Authorization header.');
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            throw new UnauthorizedError('Invalid token format');
        }

        if (!firebaseInitialized) {
            throw new UnauthorizedError('Authentication service unavailable');
        }

        const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        const user = await User.findByUid(uid);

        if (!user) {
            throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        if (!user.isActive) {
            throw new UnauthorizedError('User account is deactivated');
        }

        req.user = user;
        req.uid = uid;

        next();
    } catch (error) {
        logger.error('Authentication error:', error.message);

        if (error.code === 'auth/id-token-expired') {
            return next(new UnauthorizedError(ERROR_MESSAGES.TOKEN_EXPIRED));
        }

        if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
            return next(new UnauthorizedError(ERROR_MESSAGES.INVALID_TOKEN));
        }

        next(error);
    }
};

module.exports = authenticate;
