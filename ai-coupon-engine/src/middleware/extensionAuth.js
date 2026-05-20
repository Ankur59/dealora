// extensionAuth.js
// Middleware to authenticate requests from the Chrome extension.

export const requireExtensionAuth = (req, res, next) => {
    const extensionKey = req.headers['x-extension-key'];
    const expectedKey = process.env.EXTENSION_API_KEY || "dlr_ext_9f8e7d6c5b4a3210";

    if (!extensionKey || extensionKey !== expectedKey) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid or missing X-Extension-Key"
        });
    }
    next();
};
