const User = require('../models/User');
const { successResponse } = require('../utils/responseHandler');
const { STATUS_CODES, SUCCESS_MESSAGES, ERROR_MESSAGES } = require('../config/constants');
const { ConflictError, NotFoundError, ValidationError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

const signup = async (req, res, next) => {
    try {
        const { uid, name, email, phone } = req.body;

        logger.info(`Signup attempt for UID: ${uid}, Email: ${email}`);

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

        const emailExists = await User.findByEmail(email);
        if (emailExists) {
            logger.warn(`Signup failed: Email already exists - ${email}`);
            throw new ConflictError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
        }

        const phoneExists = await User.findByPhone(phone);
        if (phoneExists) {
            logger.warn(`Signup failed: Phone already exists - ${phone}`);
            throw new ConflictError(ERROR_MESSAGES.PHONE_ALREADY_EXISTS);
        }

        const newUser = await User.create({
            uid,
            name,
            email,
            phone,
        });

        logger.info(`New user created: ${newUser.uid} - ${newUser.email}`);

        return successResponse(res, STATUS_CODES.CREATED, SUCCESS_MESSAGES.SIGNUP_SUCCESS, {
            user: newUser,
        });
    } catch (error) {
        logger.error('Signup error:', error);

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

        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { uid } = req.body;

        logger.info(`Login attempt for UID: ${uid}`);

        const user = await User.findByUid(uid);

        if (!user) {
            logger.warn(`Login failed: User not found - ${uid}`);
            throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        if (!user.isActive) {
            logger.warn(`Login failed: User account deactivated - ${uid}`);
            throw new ValidationError('User account is deactivated');
        }

        await user.updateLastLogin();

        logger.info(`User logged in: ${user.uid} - ${user.email}`);

        return successResponse(res, STATUS_CODES.OK, SUCCESS_MESSAGES.LOGIN_SUCCESS, {
            user,
        });
    } catch (error) {
        logger.error('Login error:', error);
        next(error);
    }
};

const getProfile = async (req, res, next) => {
    try {
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

const updateProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const { name, email, phone, profilePicture } = req.body;

        logger.info(`Profile update attempt for user: ${user.uid}`);

        if (name) {
            user.name = name;
        }

        if (email) {
            // Check if email is already taken by another user
            const emailExists = await User.findByEmail(email);
            if (emailExists && emailExists.uid !== user.uid) {
                logger.warn(`Profile update failed: Email already exists - ${email}`);
                throw new ConflictError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
            }
            user.email = email;
        }

        if (phone) {
            // Check if phone is already taken by another user
            const phoneExists = await User.findByPhone(phone);
            if (phoneExists && phoneExists.uid !== user.uid) {
                logger.warn(`Profile update failed: Phone already exists - ${phone}`);
                throw new ConflictError(ERROR_MESSAGES.PHONE_ALREADY_EXISTS);
            }
            user.phone = phone;
        }

        if (profilePicture !== undefined) {
            user.profilePicture = profilePicture;
        }

        await user.save();

        logger.info(`Profile updated for user: ${user.uid}`);

        return successResponse(res, STATUS_CODES.OK, SUCCESS_MESSAGES.PROFILE_UPDATED, {
            user,
        });
    } catch (error) {
        logger.error('Update profile error:', error);
        
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

        next(error);
    }
};

module.exports = {
    signup,
    login,
    getProfile,
    updateProfile,
};
