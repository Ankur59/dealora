// TODO i have to add credentials to backend env

const axios = require('axios');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 *
 * Expected body: { serverAuthCode: string, userId: string }
 */
// For connecting a new gmail
const handleConnect = async (req, res) => {
    const { serverAuthCode, userId } = req.body;
    console.log("this is the serverAuthCode", serverAuthCode, userId)
    // --- Validation ---
    if (!serverAuthCode) {
        return res.status(400).json({ success: false, message: 'serverAuthCode is required' });
    }
    if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
    }

    try {
        // --- Step 1: Fetch user and enforce 3-email limit BEFORE calling Google ---
        const user = await User.findOne({ uid: userId });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.connectedEmails.length >= 3) {
            return res.status(400).json({
                success: false,
                message: 'You can only link up to 3 Gmail accounts. Please remove one before adding another.',
            });
        }

        // --- Step 2: Exchange serverAuthCode with Google's token endpoint ---
        // Google needs: your client credentials + the one-time code from the user's device
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code: serverAuthCode,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: '',                 // Must be empty string for Android requestServerAuthCode() flow
            grant_type: 'authorization_code', // Tells Google this is a code exchange
        });

        const { refresh_token, id_token } = tokenResponse.data;

        if (!refresh_token) {
            // This happens if the user already consented before and Google doesn't re-issue the refresh_token.
            // In production you'd handle this by prompting re-consent with prompt=consent.
            logger.warn(`No refresh_token returned for userId: ${userId}. User may have already consented.`);
            return res.status(400).json({
                success: false,
                message: 'No refresh token returned. User may need to re-grant consent.',
            });
        }

        // --- Step 3: Decode the id_token (JWT) to extract the user's Gmail address ---
        // The id_token is a JWT: header.payload.signature — all base64url encoded.
        // We only need the payload (middle part). No library needed for reading — just decode it.
        const payloadBase64 = id_token.split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
        const gmailAddress = payload.email; // e.g. "rahul@gmail.com"

        if (!gmailAddress) {
            return res.status(500).json({ success: false, message: 'Could not extract email from Google response' });
        }

        logger.info(`Linking Gmail: ${gmailAddress} for userId: ${userId}`);

        // --- Step 4: Store the refresh_token in the User document ---
        // If this Gmail is already connected, update its refresh_token (in case it changed).
        // user is already fetched above — no need to query again.

        // Check if this Gmail is already in the connectedEmails array
        const existingIndex = user.connectedEmails.findIndex(e => e.email === gmailAddress);

        if (existingIndex !== -1) {
            // Already connected — update the refresh token
            user.connectedEmails[existingIndex].refreshToken = refresh_token;
            user.connectedEmails[existingIndex].linkedAt = new Date();
        } else {
            // New Gmail — push a new entry
            user.connectedEmails.push({
                email: gmailAddress,
                refreshToken: refresh_token,
                linkedAt: new Date(),
            });
        }

        await user.save();

        logger.info(`Successfully linked ${gmailAddress} to userId: ${userId}`);

        return res.status(200).json({
            success: true,
            message: `Gmail account ${gmailAddress} linked successfully`,
            email: gmailAddress,
        });

    } catch (error) {
        // Google token exchange errors come back as HTTP 400 with a JSON body
        const googleError = error.response?.data;
        logger.error('Gmail connect error:', googleError || error.message);

        return res.status(500).json({
            success: false,
            message: 'Failed to link Gmail account',
            error: googleError?.error_description || error.message,
        });
    }
};

// Handle all the linked emails to the user
const handleAllEmails = async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
    }

    try {
        const user = await User.findOne({ uid: userId }).select('connectedEmails');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Return email + linkedAt only — never expose the refresh token to the client
        const linkedEmails = user.connectedEmails.map(entry => ({
            email: entry.email,
            linkedAt: entry.linkedAt,
        }));

        return res.status(200).json({
            success: true,
            count: linkedEmails.length,
            data: linkedEmails,
        });

    } catch (error) {
        logger.error('handleAllEmails error:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch linked emails' });
    }
};

module.exports = { handleConnect, handleAllEmails };