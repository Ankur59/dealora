const User = require('../models/User');
const TermsAcceptance = require('../models/TermsAcceptance');
const logger = require('../utils/logger');

/** The current active terms version. Bump this string to re-prompt all users. */
const CURRENT_TERMS_VERSION = '1.0';

/**
 * POST /api/terms/accept
 * Body: { userId: string (Firebase UID), termsVersion: string }
 *
 * Records that the user has accepted the given terms version.
 * Uses upsert so calling it twice is safe.
 */
exports.acceptTerms = async (req, res) => {
    const { userId, termsVersion } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
    }
    if (!termsVersion) {
        return res.status(400).json({ success: false, message: 'termsVersion is required' });
    }

    try {
        // Resolve Firebase UID → MongoDB ObjectId
        const user = await User.findOne({ uid: userId }).select('_id');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Upsert acceptance record
        const record = await TermsAcceptance.findOneAndUpdate(
            { userId: user._id, termsVersion },
            { $setOnInsert: { acceptedAt: new Date() } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        logger.info(`Terms v${termsVersion} accepted by userId: ${userId}`);

        return res.status(200).json({
            success: true,
            message: `Terms version ${termsVersion} accepted successfully`,
            acceptedAt: record.acceptedAt,
        });
    } catch (error) {
        logger.error('acceptTerms error:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to record terms acceptance' });
    }
};

module.exports.CURRENT_TERMS_VERSION = CURRENT_TERMS_VERSION;
