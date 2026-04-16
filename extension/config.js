// config.js
// This file acts as the environment variables for the Chrome Extension.
// Since extensions cannot directly read .env files, you should set your keys here.

export const CONFIG = {
    // Array of Google Gemini API Keys — the system will rotate through them
    // if one hits a rate limit or fails.
    GEMINI_API_KEYS: [
        "AIzaSyBS5L8tGj0UeO2JGimW-NirLCIzbFfCznA",
        "AIzaSyCRvbTz1zxfIh4xgOcRCriXxIeMNPh49ag",
        "AIzaSyANl9VUDVNLGM7Jkbbs8xha_JBQP-u4rCU",
        "AIzaSyC9YRWGz2gMR-HMPIpimsV_jT6fq36gIpk",
        "AIzaSyB350gxebvn-axiI6dOzg29sWlaQj_bS_I",
        "AIzaSyBZS-DUuevUf7h07SV0hwX8LSQyBVptabc"
        // Add more keys here for fallback:
        // "AIzaSy...",
        // "AIzaSy...",
    ],

    // The Gemini Model to use
    MODEL_NAME: "gemini-3-flash-preview",

    // Your ai-coupon-engine backend URL (without trailing slash)
    BACKEND_URL: "http://localhost:8000/api/v1",

    // Optional: Secret key to authenticate requests from extension to backend
    EXTENSION_API_KEY: "YOUR_EXTENSION_SECRET_KEY"
};
