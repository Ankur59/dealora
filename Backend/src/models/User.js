const mongoose = require('mongoose');
const { isValidPhoneNumber, isValidEmail, normalizePhoneNumber } = require('../utils/validators');
const { USER_CONSTANTS } = require('../config/constants');

const userSchema = new mongoose.Schema(
    {
        uid: {
            type: String,
            required: [true, 'Firebase UID is required'],
            unique: true,
            immutable: true,
            index: true,
            trim: true,
        },

        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [USER_CONSTANTS.NAME_MIN_LENGTH, `Name must be at least ${USER_CONSTANTS.NAME_MIN_LENGTH} characters`],
            maxlength: [USER_CONSTANTS.NAME_MAX_LENGTH, `Name cannot exceed ${USER_CONSTANTS.NAME_MAX_LENGTH} characters`],
        },

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

        isActive: {
            type: Boolean,
            default: true,
        },

        profilePicture: {
            type: String,
            default: null,
        },

        lastLogin: {
            type: Date,
            default: null,
        },

        deviceTokens: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

userSchema.pre('save', function (next) {
    if (this.phone) {
        this.phone = normalizePhoneNumber(this.phone);
    }

    if (this.email) {
        this.email = this.email.toLowerCase().trim();
    }

    next();
});

userSchema.methods.updateLastLogin = async function () {
    this.lastLogin = new Date();
    return await this.save();
};

userSchema.methods.addDeviceToken = async function (token) {
    if (!this.deviceTokens.includes(token)) {
        this.deviceTokens.push(token);
        return await this.save();
    }
    return this;
};

userSchema.methods.removeDeviceToken = async function (token) {
    this.deviceTokens = this.deviceTokens.filter((t) => t !== token);
    return await this.save();
};

userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.__v;

    return user;
};

userSchema.statics.findByUid = function (uid) {
    return this.findOne({ uid });
};

userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.findByPhone = function (phone) {
    const normalizedPhone = normalizePhoneNumber(phone);
    return this.findOne({ phone: normalizedPhone });
};

userSchema.index({ uid: 1, isActive: 1 });
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ phone: 1, isActive: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
