// config.example.js
// Template for Chrome Extension configuration.
// Copy this file to config.js and add your real keys/credentials.

export const CONFIG = {
    GEMINI_API_KEYS: [
        "YOUR_GEMINI_API_KEY_1",
        "YOUR_GEMINI_API_KEY_2",
        "YOUR_GEMINI_API_KEY_3"
    ],

    // Gemini models
    MODEL_NAME: "gemini-3.5-flash",
    FALLBACK_MODEL_NAME: "gemini-3-flash-preview",

    // ai-coupon-engine backend URL (without trailing slash)
    BACKEND_URL: "http://localhost:8000/api/v1",

    // Extension ↔ Backend shared secret
    EXTENSION_API_KEY: "dlr_ext_9f8e7d6c5b4a3210",

    // Default credentials — used when no merchant-specific creds exist
    DEFAULT_CREDENTIALS: {
        EMAIL: "YOUR_EMAIL",
        PASSWORD: "YOUR_PASSWORD",
        PHONE: "YOUR_PHONE"
    },

    // Anti-ban: rate limiting
    COUPONS_PER_MINUTE: 3,
    MIN_DELAY_BETWEEN_ACTIONS_MS: 800,
    MAX_DELAY_BETWEEN_ACTIONS_MS: 2500,
    MIN_DELAY_BETWEEN_COUPONS_MS: 2000,
    MAX_DELAY_BETWEEN_COUPONS_MS: 4000,

    // Max AI steps per coupon verification
    MAX_STEPS_PER_VERIFICATION: 20,
    MAX_STEPS_PER_AUTH: 25,

    // Block retry config
    MAX_BLOCK_RETRIES: 3,
    BLOCK_COOLDOWN_MS: 30000,

    // Gemini call config
    GEMINI_MAX_KEYS_PER_CALL: 6,
    GEMINI_STEP_RETRIES: 3,
    GEMINI_RETRY_DELAY_MS: 2000,
    KEEP_WINDOW_OPEN_ON_FAILURE: false
};
