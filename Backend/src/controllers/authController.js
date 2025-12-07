/**
 * Authentication Controller
 * 
 * Handles all authentication-related business logic:
 * - User signup (create new user or return existing)
 * - User login (verify UID and update last login)
 * - Get user profile
 * - Update user profile
 * 
 * @module controllers/authController
 */

const User = require('../models/User');
const { successResponse } = require('../utils/responseHandler');
const { STATUS_CODES, SUCCESS_MESSAGES, ERROR_MESSAGES } = require('../config/constants');
const { ConflictError, NotFoundError, ValidationError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Signup Controller
 * 
 * Creates a new user or returns existing user if UID already registered.
 * Handles duplicate email/phone errors gracefully.
 * 
 * @route POST /api/auth/signup
 * @access Public
 */
const signup = async (req, res, next) => {
    try {
        const { uid, name, email, phone } = req.body;

        logger.info(`Signup attempt for UID: ${uid}, Email: ${email}`);

        // Check if user already exists by UID
        const existingUser = await User.findByUid(uid);

        if (existingUser) {
            logger.info(`User already registered with UID: ${uid}`);
            return successResponse(
                res,
                STATUS_CODES.OK,
                SUCCESS_MESSAGES.USER_ALREADY_REGISTERED,
                { user: existingUser }
            );
        }

        // Check for duplicate email (separate check for better error messages)
        const emailExists = await User.findByEmail(email);
        if (emailExists) {
            logger.warn(`Signup failed: Email already exists - ${email}`);
            throw new ConflictError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
        }

        // Check for duplicate phone (separate check for better error messages)
        const phoneExists = await User.findByPhone(phone);
        if (phoneExists) {
            logger.warn(`Signup failed: Phone already exists - ${phone}`);
            throw new ConflictError(ERROR_MESSAGES.PHONE_ALREADY_EXISTS);
        }

        // Create new user
        const newUser = await User.create({
            uid,
            name,
            email,
            phone,
        });

        logger.info(`✅ New user created successfully: ${newUser.uid} - ${newUser.email}`);

        return successResponse(res, STATUS_CODES.CREATED, SUCCESS_MESSAGES.SIGNUP_SUCCESS, {
            user: newUser,
        });
    } catch (error) {
        logger.error('Signup error:', error);

        // Handle Mongoose duplicate key error (E11000)
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            let message = ERROR_MESSAGES.USER_ALREADY_EXISTS;

            if (field === 'email') {
                message = ERROR_MESSAGES.EMAIL_ALREADY_EXISTS;
            } else if (field === 'phone') {
                message = ERROR_MESSAGES.PHONE_ALREADY_EXISTS;
            }

            return next(new ConflictError(message));
        }

        // Pass error to global error handler
        next(error);
    }
};

/**
 * Login Controller
 * 
 * Verifies user exists by UID and updates last login timestamp.
 * 
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
    try {
        const { uid } = req.body;

        logger.info(`Login attempt for UID: ${uid}`);

        // Find user by UID
        const user = await User.findByUid(uid);

        if (!user) {
            logger.warn(`Login failed: User not found - ${uid}`);
            throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        // Check if user is active
        if (!user.isActive) {
            logger.warn(`Login failed: User account deactivated - ${uid}`);
            throw new ValidationError('User account is deactivated');
        }

        // Update last login timestamp
        await user.updateLastLogin();

        logger.info(`✅ User logged in successfully: ${user.uid} - ${user.email}`);

        return successResponse(res, STATUS_CODES.OK, SUCCESS_MESSAGES.LOGIN_SUCCESS, {
            user,
        });
    } catch (error) {
        logger.error('Login error:', error);
        next(error);
    }
};

/**
 * Get Profile Controller
 * 
 * Returns authenticated user's profile information.
 * 
 * @route GET /api/auth/profile
 * @access Protected (requires authentication)
 */
const getProfile = async (req, res, next) => {
    try {
        // User is already attached to req.user by authenticate middleware
        const user = req.user;

        if (!user) {
            throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        logger.info(`Profile fetched for user: ${user.uid}`);

        return successResponse(res, STATUS_CODES.OK, 'Profile fetched successfully', {
            user,
        });
    } catch (error) {
        logger.error('Get profile error:', error);
        next(error);
    }
};

/**
 * Update Profile Controller
 * 
 * Updates user's profile information (name, profilePicture).
 * Only updates fields that are provided.
 * 
 * @route PUT /api/auth/profile
 * @access Protected (requires authentication)
 */
const updateProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const { name, profilePicture } = req.body;

        logger.info(`Profile update attempt for user: ${user.uid}`);

        // Update only provided fields
        if (name) {
            user.name = name;
        }

        if (profilePicture !== undefined) {
            user.profilePicture = profilePicture;
        }

        // Save updated user
        await user.save();

        logger.info(`✅ Profile updated successfully for user: ${user.uid}`);

        return successResponse(res, STATUS_CODES.OK, SUCCESS_MESSAGES.PROFILE_UPDATED, {
            user,
        });
    } catch (error) {
        logger.error('Update profile error:', error);
        next(error);
    }
};

module.exports = {
    signup,
    login,
    getProfile,
    updateProfile,
};
