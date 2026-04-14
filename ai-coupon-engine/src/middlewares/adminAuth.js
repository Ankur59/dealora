import dotenv from 'dotenv';
dotenv.config();

export const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const authType = authHeader.split(' ')[0];
    const credentials = authHeader.split(' ')[1];

    if (authType !== 'Basic' || !credentials) {
        return res.status(401).json({ success: false, message: 'Invalid authentication format.' });
    }

    const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');

    const envUsername = process.env.ADMIN_USERNAME;
    const envPassword = process.env.ADMIN_PASSWORD;

    if (!envUsername || !envPassword) {
        return res.status(500).json({ success: false, message: 'Admin credentials not configured on server.' });
    }

    if (username === envUsername && password === envPassword) {
        next();
    } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
};
