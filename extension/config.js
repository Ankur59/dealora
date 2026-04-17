// config.js
// This file acts as the environment variables for the Chrome Extension.
// Since extensions cannot directly read .env files, you should set your keys here.

export const CONFIG = {
    // Array of Google Gemini API Keys — the system will rotate through them
    // if one hits a rate limit or fails.
    GEMINI_API_KEYS: [
        "YOUR_GEMINI_API_KEY_HERE"
    ],

    // The Gemini Model to use
    MODEL_NAME: "gemini-3-flash-preview",

    // Your ai-coupon-engine backend URL (without trailing slash)
    BACKEND_URL: "http://localhost:8000/api/v1",

    // Optional: Secret key to authenticate requests from extension to backend
    EXTENSION_API_KEY: "YOUR_EXTENSION_SECRET_KEY"
};
