const isValidPhoneNumber = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return false;
    }

    const cleanPhone = phone.replace(/[\s-]/g, '');
    const pattern1 = /^[6-9]\d{9}$/;
    const pattern2 = /^\+91[6-9]\d{9}$/;

    return pattern1.test(cleanPhone) || pattern2.test(cleanPhone);
};

const normalizePhoneNumber = (phone) => {
    if (!phone) return phone;

    let cleanPhone = phone.replace(/[\s-]/g, '');

    if (cleanPhone.startsWith('+91')) {
        cleanPhone = cleanPhone.substring(3);
    }

    return cleanPhone;
};

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return false;
    }

    const comprehensivePattern =
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    return comprehensivePattern.test(email.trim());
};

const sanitizeInput = (input) => {
    if (!input || typeof input !== 'string') {
        return input;
    }

    let sanitized = input.replace(/<[^>]*>/g, '');
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.trim();

    return sanitized;
};

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
