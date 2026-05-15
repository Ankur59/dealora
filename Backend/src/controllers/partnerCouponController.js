/**
 * Partner Coupon Controller
 *
 * Reads from the `partnercoupons` collection that is OWNED and populated
 * exclusively by ai-coupon-engine. The Backend does NOT redeclare the schema
 * — it uses the raw MongoDB driver so there is zero schema duplication.
 *
 * Endpoints (all require Firebase auth):
 *   GET  /api/partner-coupons            → paginated list sorted by discountWeight ↓
 *   GET  /api/partner-coupons/redeemed   → coupons this user has redeemed
 *   POST /api/partner-coupons/:id/redeem → create a Redemption entry
 */

const mongoose = require('mongoose');
const Redemption = require('../models/Redemption');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { STATUS_CODES } = require('../config/constants');

/** Raw MongoDB collection — no schema duplication in the Backend. */
const col = () => mongoose.connection.db.collection('partnercoupons');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shape a raw MongoDB document into the API response the mobile app expects. */
function shapeDoc(doc, isRedeemed = false) {
    const now = new Date();
    const end = doc.end ? new Date(doc.end) : null;
    const daysUntilExpiry = end
        ? Math.ceil((end - now) / (1000 * 60 * 60 * 24))
        : null;

    return {
        _id: doc._id,
        couponId: doc.couponId ?? null,
        partner: doc.partner ?? null,
        brandName: doc.brandName ?? '',
        couponTitle: doc.title ?? doc.discount ?? doc.description?.slice(0, 80) ?? 'Partner Offer',
        description: doc.description ?? null,
        couponCode: doc.code ?? null,
        discount: doc.discount ?? null,
        discountWeight: doc.discountWeight ?? 0,
        category: doc.categories?.[0] ?? null,
        categories: doc.categories ?? [],
        couponLink: doc.trackingLink ?? doc.couponVisitingLink ?? null,
        expiryDate: doc.end ?? null,
        daysUntilExpiry,
        isExpired: end ? end < now : false,
        isRedeemed,
        redeemedAt: doc.redeemedAt ?? null,
        merchantName: doc.merchantName ?? doc.brandName ?? null,
        merchantLogo: doc.merchantLogo ?? doc.metchantLogo ?? null,
        couponType: doc.couponType ?? null,
        isInStore: doc.isInStore ?? false,
        isNewUser: doc.isNewUser ?? false,
        isVerified: doc.isVerified ?? false,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

/** Build the MongoDB filter object for the list endpoint. */
function buildFilter({ tab, redeemedIds, category, brand, search, discountType, validity, offerType }) {
    const now = new Date();
    const filter = {};

    if (tab === 'expired') {
        filter.end = { $lt: now };
    } else {
        // active: not expired (or no expiry set), and not already redeemed by user
        filter.$or = [
            { end: { $gte: now } },
            { end: null },
            { end: { $exists: false } },
        ];
        if (redeemedIds.length > 0) {
            filter._id = { $nin: redeemedIds };
        }
    }

    if (category) filter.categories = category;
    if (brand) filter.brandName = { $regex: brand, $options: 'i' };
    if (offerType) filter.offerType = offerType;

    // New filters for PartnerCoupon
    if (discountType) {
        const discountOr = [
            { couponType: { $regex: discountType, $options: 'i' } },
            { discount: { $regex: discountType, $options: 'i' } }
        ];
        filter.$and = filter.$and ? [...filter.$and, { $or: discountOr }] : [{ $or: discountOr }];
    }


    if (validity) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (validity === 'valid_today') {
            const tonight = new Date(today);
            tonight.setHours(23, 59, 59, 999);
            filter.end = { $gte: today, $lte: tonight };
        } else if (validity === 'valid_this_week') {
            const endOfWeek = new Date(today);
            endOfWeek.setDate(today.getDate() + 7);
            filter.end = { $gte: today, $lte: endOfWeek };
        } else if (validity === 'valid_this_month') {
            const endOfMonth = new Date(today);
            endOfMonth.setMonth(today.getMonth() + 1);
            filter.end = { $gte: today, $lte: endOfMonth };
        }
    }

    if (search) {
        const rx = { $regex: search, $options: 'i' };
        const searchOr = [
            { brandName: rx },
            { title: rx },
            { description: rx },
            { code: rx },
            { discount: rx },
        ];
        filter.$and = filter.$and ? [...filter.$and, { $or: searchOr }] : [{ $or: searchOr }];
    }

    return filter;
}

/** Map the sortBy query string to a MongoDB sort spec. Always secondary sort by discountWeight ↓. */
function buildSort(sortBy) {
    switch (sortBy) {
        case 'newest':
        case 'newest_first': return { createdAt: -1, 'trend.healthScore': -1 };
        case 'oldest':
        case 'oldest_first': return { createdAt: 1, 'trend.healthScore': -1 };
        case 'expiring_soon': return { end: 1, 'trend.healthScore': -1 };
        case 'a_z': return { brandName: 1, 'trend.healthScore': -1 };
        case 'z_a': return { brandName: -1, 'trend.healthScore': -1 };
        case 'highest_discount':
        case 'discountWeight': return { discountWeight: -1, createdAt: -1 }; // explicit discount-only sort
        default: return { 'trend.healthScore': -1, createdAt: -1 }; // best health score first (default)
    }
}

// ── GET /api/partner-coupons ──────────────────────────────────────────────────

/**
 * @route   GET /api/partner-coupons
 * @desc    Paginated partner coupons for the exclusive toggle.
 *          Sorted by discountWeight DESC by default (high-value first).
 *          active tab: non-expired + not yet redeemed by this user
 *          expired tab: end < now
 * @query   category, brand, search, sortBy, page, limit, tab (active|expired)
 * @access  Private
 */
exports.getPartnerCoupons = async (req, res) => {
    try {
        const {
            category,
            brand,
            search,
            sortBy = 'discountWeight',
            page: pageStr = '1',
            limit: limitStr = '20',
            tab = 'active',
            discountType,
            validity,
            offerType,
        } = req.query;

        const userId = req.user._id;
        const page = Math.max(Number(pageStr) || 1, 1);
        const limit = Math.min(Math.max(Number(limitStr) || 20, 1), 100);
        const skip = (page - 1) * limit;

        // Coupon IDs this user has already redeemed (as ObjectIds)
        const redemptions = await Redemption.find({ userId }).select('couponId').lean();
        const redeemedIds = redemptions.map(r => r.couponId);   // already ObjectIds

        const filter = buildFilter({ tab, redeemedIds, category, brand, search, discountType, validity, offerType });
        const sort = buildSort(sortBy);

        const [docs, total] = await Promise.all([
            col().find(filter).sort(sort).skip(skip).limit(limit).toArray(),
            col().countDocuments(filter),
        ]);

        const coupons = docs.map(d => shapeDoc(d, false));
        const pages = Math.ceil(total / limit) || 1;

        return successResponse(res, STATUS_CODES.OK, 'Partner coupons fetched', {
            total, page, pages, count: coupons.length, limit, coupons,
        });
    } catch (err) {
        logger.error(`[PartnerCoupon] getPartnerCoupons: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to fetch partner coupons');
    }
};

// ── GET /api/partner-coupons/redeemed ─────────────────────────────────────────

/**
 * @route   GET /api/partner-coupons/redeemed
 * @desc    Coupons this user has redeemed, sorted by redeemedAt DESC.
 * @query   page, limit
 * @access  Private
 */
exports.getRedeemedPartnerCoupons = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const skip = (page - 1) * limit;

        const [redemptions, total] = await Promise.all([
            Redemption.find({ userId }).sort({ redeemedAt: -1 }).skip(skip).limit(limit).lean(),
            Redemption.countDocuments({ userId }),
        ]);

        const couponIds = redemptions.map(r => r.couponId);

        // Fetch coupon documents and sort them by discountWeight within the redeemed set
        const couponDocs = await col()
            .find({ _id: { $in: couponIds } })
            .sort({ discountWeight: -1 })
            .toArray();

        const couponMap = Object.fromEntries(couponDocs.map(c => [c._id.toString(), c]));

        // Maintain redeemedAt order from Redemption, enrich with coupon doc
        const coupons = redemptions.map(r => {
            const doc = couponMap[r.couponId.toString()];
            if (!doc) return null;
            return { ...shapeDoc(doc, true), redeemedAt: r.redeemedAt };
        }).filter(Boolean);

        const pages = Math.ceil(total / limit) || 1;

        return successResponse(res, STATUS_CODES.OK, 'Redeemed coupons fetched', {
            total, page, pages, count: coupons.length, limit, coupons,
        });
    } catch (err) {
        logger.error(`[PartnerCoupon] getRedeemedPartnerCoupons: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to fetch redeemed coupons');
    }
};

// ── POST /api/partner-coupons/:id/redeem ──────────────────────────────────────

/**
 * @route   POST /api/partner-coupons/:id/redeem
 * @desc    Mark a partner coupon as redeemed. Idempotent — safe to call twice.
 * @access  Private
 */
exports.redeemPartnerCoupon = async (req, res) => {
    try {
        const userId = req.user._id;
        const { Types } = require('mongoose');
        const { ObjectId } = Types;

        let couponObjId;
        try {
            couponObjId = new ObjectId(req.params.id);
        } catch {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Invalid coupon ID');
        }

        // Verify coupon exists in ai-coupon-engine's collection
        const coupon = await col().findOne({ _id: couponObjId });
        if (!coupon) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Coupon not found');
        }

        // Upsert redemption — idempotent
        const redemption = await Redemption.findOneAndUpdate(
            { userId, couponId: couponObjId },
            { $setOnInsert: { userId, couponId: couponObjId, redeemedAt: new Date() } },
            { upsert: true, new: true }
        );

        return successResponse(res, STATUS_CODES.OK, 'Coupon redeemed successfully', {
            redemption: {
                _id: redemption._id,
                userId: redemption.userId,
                couponId: redemption.couponId,
                redeemedAt: redemption.redeemedAt,
            },
            coupon: shapeDoc(coupon, true),
        });
    } catch (err) {
        logger.error(`[PartnerCoupon] redeemPartnerCoupon: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to redeem coupon');
    }
};

/**
 * @route   POST /api/partner-coupons/:id/vote
 * @desc    Directly increment successCount or failedCount for a coupon.
 *          Used for immediate feedback when a user marks a coupon as redeemed.
 * @access  Private
 */
exports.votePartnerCoupon = async (req, res) => {
    try {
        const { outcome } = req.body;
        const couponId = req.params.id;

        if (!['success', 'failure'].includes(outcome)) {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Outcome must be success | failure');
        }

        const updateField = outcome === 'success' ? 'successCount' : 'failedCount';

        const { Types } = require('mongoose');
        const { ObjectId } = Types;
        let couponObjId;
        try {
            couponObjId = new ObjectId(couponId);
        } catch {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Invalid coupon ID');
        }

        const result = await col().updateOne(
            { _id: couponObjId },
            { $inc: { [updateField]: 1 } }
        );

        if (result.matchedCount === 0) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Coupon not found in partner collection');
        }

        return successResponse(res, STATUS_CODES.OK, `Vote recorded: ${outcome}`);
    } catch (err) {
        logger.error(`[PartnerCoupon] votePartnerCoupon: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to record vote');
    }
};

/**
 * @route   POST /api/partner-coupons/:id/discover
 * @desc    Atomically increment discoverCount on every click.
 *          Updates lastDiscoverAt only if 5+ minutes have passed since last update (debounce).
 *          Called every time a user taps the Discover button for a partner coupon.
 * @access  Private
 */
exports.trackDiscover = async (req, res) => {
    try {
        const { Types } = require('mongoose');
        const { ObjectId } = Types;
        const couponId = req.params.id;

        let couponObjId;
        try {
            couponObjId = new ObjectId(couponId);
        } catch {
            return errorResponse(res, STATUS_CODES.BAD_REQUEST, 'Invalid coupon ID');
        }

        const FIVE_MINUTES_MS = 5 * 60 * 1000;
        const now = new Date();

        // Fetch current document to check if we should update lastDiscoverAt
        const coupon = await col().findOne({ _id: couponObjId });

        if (!coupon) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Coupon not found');
        }

        // Determine if we should update lastDiscoverAt
        const lastDiscover = coupon.trend?.lastDiscoverAt;
        const shouldUpdateTimestamp = !lastDiscover || (now - new Date(lastDiscover)) >= FIVE_MINUTES_MS;

        // Build update object
        const updateObj = {
            $inc: {
                'trend.discoverCount': 1
            }
        };

        // Only set lastDiscoverAt if conditions are met
        if (shouldUpdateTimestamp) {
            updateObj.$set = {
                'trend.lastDiscoverAt': now
            };
        }

        const result = await col().updateOne(
            { _id: couponObjId },
            updateObj
        );

        if (result.matchedCount === 0) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Coupon not found');
        }

        return successResponse(res, STATUS_CODES.OK, 'Discover tracked');
    } catch (err) {
        logger.error(`[PartnerCoupon] trackDiscover: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to track discover');
    }
};
