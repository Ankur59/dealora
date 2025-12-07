/**
 * User Model
 * 
 * Mongoose schema for User collection.
 * 
 * Features:
 * - Unique Firebase UID, email, and phone
 * - Automatic timestamps
 * - Phone number normalization
 * - Custom instance and static methods
 * - Indexed fields for performance
 * - Email normalization (lowercase)
 * 
 * @module models/User
 */

const mongoose = require('mongoose');
const { isValidPhoneNumber, isValidEmail, normalizePhoneNumber } = require('../utils/validators');
const { USER_CONSTANTS } = require('../config/constants');

/**
 * User Schema Definition
 */
const userSchema = new mongoose.Schema(
    {
        // Firebase UID (primary identifier)
        uid: {
            type: String,
            required: [true, 'Firebase UID is required'],
            unique: true,
            immutable: true,
            index: true,
            trim: true,
        },

        // User's full name
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [USER_CONSTANTS.NAME_MIN_LENGTH, `Name must be at least ${USER_CONSTANTS.NAME_MIN_LENGTH} characters`],
            maxlength: [USER_CONSTANTS.NAME_MAX_LENGTH, `Name cannot exceed ${USER_CONSTANTS.NAME_MAX_LENGTH} characters`],
        },

        // Email address
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
            validate: {
                validator: isValidEmail,
                message: 'Invalid email format',
            },
        },

        // Phone number (Indian format)
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            unique: true,
            index: true,
            validate: {
                validator: isValidPhoneNumber,
                message: 'Invalid phone number format. Use 10 digits starting with 6-9 or +91 format',
            },
        },

        // Account status
        isActive: {
            type: Boolean,
            default: true,
        },

        // Profile picture URL
        profilePicture: {
            type: String,
            default: null,
        },

        // Last login timestamp
        lastLogin: {
            type: Date,
            default: null,
        },

        // Device tokens for push notifications
        deviceTokens: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt
        versionKey: false, // Removes __v field
    }
);

/**
 * Pre-save hook
 * Normalize phone number before saving
 */
userSchema.pre('save', function (next) {
    // Normalize phone number to standard format (without +91)
    if (this.phone) {
        this.phone = normalizePhoneNumber(this.phone);
    }

    // Ensure email is lowercase
    if (this.email) {
        this.email = this.email.toLowerCase().trim();
    }

    next();
});

/**
 * Instance method: Update last login timestamp
 * 
 * @returns {Promise<User>} Updated user document
 */
userSchema.methods.updateLastLogin = async function () {
    this.lastLogin = new Date();
    return await this.save();
};

/**
 * Instance method: Add device token for push notifications
 * 
 * @param {String} token - Device token
 * @returns {Promise<User>} Updated user document
 */
userSchema.methods.addDeviceToken = async function (token) {
    if (!this.deviceTokens.includes(token)) {
        this.deviceTokens.push(token);
        return await this.save();
    }
    return this;
};

/**
 * Instance method: Remove device token
 * 
 * @param {String} token - Device token to remove
 * @returns {Promise<User>} Updated user document
 */
userSchema.methods.removeDeviceToken = async function (token) {
    this.deviceTokens = this.deviceTokens.filter((t) => t !== token);
    return await this.save();
};

/**
 * Override toJSON method
 * Remove sensitive fields from response
 */
userSchema.methods.toJSON = function () {
    const user = this.toObject();

    // Remove fields that shouldn't be sent to client
    delete user.__v;

    return user;
};

/**
 * Static method: Find user by Firebase UID
 * 
 * @param {String} uid - Firebase UID
 * @returns {Promise<User|null>} User document or null
 */
userSchema.statics.findByUid = function (uid) {
    return this.findOne({ uid });
};

/**
 * Static method: Find user by email
 * 
 * @param {String} email - Email address
 * @returns {Promise<User|null>} User document or null
 */
userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase().trim() });
};

/**
 * Static method: Find user by phone
 * 
 * @param {String} phone - Phone number
 * @returns {Promise<User|null>} User document or null
 */
userSchema.statics.findByPhone = function (phone) {
    const normalizedPhone = normalizePhoneNumber(phone);
    return this.findOne({ phone: normalizedPhone });
};

/**
 * Compound index for common queries
 * Improves query performance
 */
userSchema.index({ uid: 1, isActive: 1 });
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ phone: 1, isActive: 1 });

/**
 * Create and export User model
 */
const User = mongoose.model('User', userSchema);

module.exports = User;
