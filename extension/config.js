// config.js
// This file acts as the environment variables for the Chrome Extension.
// Since extensions cannot directly read .env files, you should set your keys here.

export const CONFIG = {
    // Your Google Gemini API Key
    GEMINI_API_KEY: "AIzaSyCRvbTz1zxfIh4xgOcRCriXxIeMNPh49ag",
    
    // The Gemini Model to use (must be gemini-3-flash-preview as per requirements)
    MODEL_NAME: "gemini-3-flash-preview",
    
    // Your ai-coupon-engine backend URL (without trailing slash)
    BACKEND_URL: "http://localhost:8000/api/v1",
    
    // Optional: Secret key to authenticate requests from extension to backend
    EXTENSION_API_KEY: "YOUR_EXTENSION_SECRET_KEY"
};
