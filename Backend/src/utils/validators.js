/**
 * Custom Validators Utility
 * 
 * Provides reusable validation functions for common data types.
 * Used by validation middleware and models for consistent validation.
 * 
 * @module utils/validators
 */

/**
 * Validate Indian phone number format
 * Accepts: "9876543210" or "+919876543210"
 * 
 * @param {String} phone - Phone number to validate
 * @returns {Boolean} True if valid, false otherwise
 */
const isValidPhoneNumber = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return false;
    }

    // Remove all spaces and hyphens
    const cleanPhone = phone.replace(/[\s-]/g, '');

    // Pattern 1: 10 digits starting with 6-9
    const pattern1 = /^[6-9]\d{9}$/;

    // Pattern 2: +91 followed by 10 digits starting with 6-9
    const pattern2 = /^\+91[6-9]\d{9}$/;

    return pattern1.test(cleanPhone) || pattern2.test(cleanPhone);
};

/**
 * Normalize phone number to standard format
 * Converts "+919876543210" or "9876543210" to "9876543210"
 * 
 * @param {String} phone - Phone number to normalize
 * @returns {String} Normalized phone number
 */
const normalizePhoneNumber = (phone) => {
    if (!phone) return phone;

    // Remove all spaces and hyphens
    let cleanPhone = phone.replace(/[\s-]/g, '');

    // Remove +91 prefix if present
    if (cleanPhone.startsWith('+91')) {
        cleanPhone = cleanPhone.substring(3);
    }

    return cleanPhone;
};

/**
 * Validate email format using regex
 * 
 * @param {String} email - Email address to validate
 * @returns {Boolean} True if valid, false otherwise
 */
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return false;
    }

    // Standard email regex pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // More comprehensive email validation
    const comprehensivePattern =
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    return comprehensivePattern.test(email.trim());
};

/**
 * Sanitize input to prevent XSS attacks
 * Removes potentially harmful characters and scripts
 * 
 * @param {String} input - Input string to sanitize
 * @returns {String} Sanitized string
 */
const sanitizeInput = (input) => {
    if (!input || typeof input !== 'string') {
        return input;
    }

    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Remove script tags and their content
    sanitized = sanitized.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ''
    );

    // Remove event handlers (onclick, onerror, etc.)
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
};

/**
 * Validate URL format
 * 
 * @param {String} url - URL to validate
 * @returns {Boolean} True if valid, false otherwise
 */
const isValidUrl = (url) => {
    if (!url || typeof url !== 'string') {
        return false;
    }

    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (error) {
        return false;
    }
};

module.exports = {
    isValidPhoneNumber,
    normalizePhoneNumber,
    isValidEmail,
    sanitizeInput,
    isValidUrl,
};
