// config.js
// Environment variables for the Chrome Extension.
// Extensions cannot read .env files — set keys here.

export const CONFIG = {
    // Gemini API Keys — rotates through them on rate-limit/failure
    GEMINI_API_KEYS: [
        "AIzaSyBoXUeucwDpBKkWf_RL7c1UR1o0sSAjITc",

    // Gemini model
    MODEL_NAME: "gemini-3-flash-preview",

    // ai-coupon-engine backend URL (without trailing slash)
    BACKEND_URL: "http://localhost:8000/api/v1",

    // Extension ↔ Backend shared secret
    EXTENSION_API_KEY: "dlr_ext_9f8e7d6c5b4a3210",

    // Default credentials — used when no merchant-specific creds exist
    DEFAULT_CREDENTIALS: {
        EMAIL: "Nobentadeal@gmail.com",
        PASSWORD: "Mumbai@123",
        PHONE: "7425817074"
    },

    // Anti-ban: rate limiting
    COUPONS_PER_MINUTE: 3,
    MIN_DELAY_BETWEEN_ACTIONS_MS: 800,
    MAX_DELAY_BETWEEN_ACTIONS_MS: 2500,
    MIN_DELAY_BETWEEN_COUPONS_MS: 15000,
    MAX_DELAY_BETWEEN_COUPONS_MS: 25000,

    // Max AI steps per coupon verification
    MAX_STEPS_PER_VERIFICATION: 20,
    MAX_STEPS_PER_AUTH: 25,

    // Block retry config
    MAX_BLOCK_RETRIES: 3,
    BLOCK_COOLDOWN_MS: 30000,
};
