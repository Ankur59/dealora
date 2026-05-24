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
        healthScore: doc.trend?.healthScore ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

/** Build the MongoDB filter object for the list endpoint. */
function buildFilter({ tab, redeemedIds, category, brand, search, discountType, validity, offerType, verified }) {
    const now = new Date();
    const andConditions = [];  // Collect all AND conditions

    // ── 1. TAB FILTER (active/expired) ──
    if (tab === 'expired') {
        andConditions.push({ end: { $lt: now } });
    } else {
        // active: not expired (or no expiry set), and not already redeemed by user
        andConditions.push({
            $or: [
                { end: { $gte: now } },
                { end: null },
                { end: { $exists: false } },
            ]
        });
        if (redeemedIds.length > 0) {
            andConditions.push({ _id: { $nin: redeemedIds } });
        }
    }

    // ── 2. VERIFIED FILTER ──
    if (verified === 'true' || verified === true) {
        andConditions.push({ isVerified: true });
    }

    // ── 3. CATEGORY FILTER ──
    if (category) {
        if (Array.isArray(category)) {
            andConditions.push({ categories: { $in: category } });
        } else {
            andConditions.push({ categories: category });
        }
    }

    // ── 4. BRAND FILTER ──
    if (brand) {
        andConditions.push({ brandName: { $regex: brand, $options: 'i' } });
    }

    // ── 5. OFFER TYPE FILTER ──
    if (offerType) {
        andConditions.push({ offerType: offerType });
    }

    // ── 6. DISCOUNT TYPE FILTER ──
    if (discountType) {
        andConditions.push({
            $or: [
                { couponType: { $regex: discountType, $options: 'i' } },
                { discount: { $regex: discountType, $options: 'i' } }
            ]
        });
    }

    // ── 7. VALIDITY FILTER ──
    if (validity) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (validity === 'valid_today') {
            const tonight = new Date(today);
            tonight.setHours(23, 59, 59, 999);
            andConditions.push({ end: { $gte: today, $lte: tonight } });
        } else if (validity === 'valid_this_week') {
            const endOfWeek = new Date(today);
            endOfWeek.setDate(today.getDate() + 7);
            andConditions.push({ end: { $gte: today, $lte: endOfWeek } });
        } else if (validity === 'valid_this_month') {
            const endOfMonth = new Date(today);
            endOfMonth.setMonth(today.getMonth() + 1);
            endOfMonth.setDate(0);
            andConditions.push({ end: { $gte: today, $lte: endOfMonth } });
        }
    }

    // ── 8. SEARCH FILTER (most important - searches across 8 fields) ──
    if (search) {
        const searchTerm = search.trim();
        if (searchTerm !== '') {
            const rx = { $regex: searchTerm, $options: 'i' }; // case-insensitive regex

            andConditions.push({
                $or: [
                    { brandName: rx },          // PRIMARY: Brand name
                    { categories: rx },         // PRIMARY: Category
                    { title: rx },              // SECONDARY: Coupon title
                    { couponTitle: rx },        // Alternative title
                    { couponName: rx },         // Alternative name
                    { description: rx },        // SECONDARY: Description
                    { code: rx },               // SECONDARY: Coupon code
                    { discount: rx }            // SECONDARY: Discount text
                ]
            });
        }
    }

    // ── BUILD FINAL FILTER ──
    // If we have conditions, use $and. Otherwise, return empty filter (matches all)
    const filter = andConditions.length > 0
        ? { $and: andConditions }
        : {};

    return filter;
}

/** 
 * Map the sortBy query string to a MongoDB sort spec. 
 * ALWAYS includes healthScore as primary or secondary sort for result relevance.
 */
function buildSort(sortBy) {
    // Handle null, undefined, or empty string -> default to healthScore
    if (!sortBy || sortBy === 'null' || sortBy === '') {
        return { 'trend.healthScore': -1, createdAt: -1 };
    }

    switch (sortBy) {
        case 'newest':
        case 'newest_first':
            return { createdAt: -1, 'trend.healthScore': -1 };
        case 'oldest':
        case 'oldest_first':
            return { createdAt: 1, 'trend.healthScore': -1 };
        case 'expiring_soon':
            return { end: 1, 'trend.healthScore': -1 };
        case 'a_z':
            return { brandName: 1, 'trend.healthScore': -1 };
        case 'z_a':
            return { brandName: -1, 'trend.healthScore': -1 };
        case 'highest_discount':
        case 'discountWeight':
            return { discountWeight: -1, createdAt: -1 };
        // DEFAULT: Health score descending (most relevant first)
        // This ensures search results are always ranked by system accuracy
        default:
            return { 'trend.healthScore': -1, createdAt: -1 };
    }
}

// ── GET /api/partner-coupons/search ─────────────────────────────────────────

/**
 * @route   GET /api/partner-coupons/search
 * @desc    Simple search across brandName and categories for coupons that
 *          are not yet expired (end > now) and isVerified === true.
 *          Results are sorted by trend.healthScore DESC.
 * @query   q     – search term (min 3 chars enforced by frontend)
 *          page  – page number (default 1)
 *          limit – page size   (default 20, max 100)
 * @access  Private
 */
exports.searchPartnerCoupons = async (req, res) => {
    try {
        const { q = '', page: pageStr = '1', limit: limitStr = '20' } = req.query;

        const term = q.trim();
        if (!term) {
            return successResponse(res, STATUS_CODES.OK, 'Search results', {
                total: 0, page: 1, pages: 1, count: 0, limit: 20, coupons: [],
            });
        }

        const page = Math.max(Number(pageStr) || 1, 1);
        const limit = Math.min(Math.max(Number(limitStr) || 20, 1), 100);
        const skip = (page - 1) * limit;
        const now = new Date();

        // Lowercase the term to match stored data: brandName is stored lowercase
        // (Mongoose schema) and categories are now also stored lowercase by all adapters.
        const termLower = term.toLowerCase();
        const rx = { $regex: termLower, $options: 'i' };  // $options:'i' kept as safety net for any legacy docs

        const filter = {
            $and: [
                { isVerified: true },
                { end: { $gt: now } },          // not expired
                { offerType: 'Coupon' },
                { $or: [{ brandName: rx }, { categories: rx }] },
            ],
        };

        const sort = { 'trend.healthScore': -1 };

        const [docs, total] = await Promise.all([
            col().find(filter).sort(sort).skip(skip).limit(limit).toArray(),
            col().countDocuments(filter),
        ]);

        const coupons = docs.map(d => shapeDoc(d, false));
        const pages = Math.ceil(total / limit) || 1;

        return successResponse(res, STATUS_CODES.OK, 'Search results', {
            total, page, pages, count: coupons.length, limit, coupons,
        });
    } catch (err) {
        logger.error(`[PartnerCoupon] searchPartnerCoupons: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Search failed');
    }
};

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
            sortBy,
            page: pageStr = '1',
            limit: limitStr = '20',
            tab = 'active',
            discountType,
            validity,
            offerType,
            verified,
        } = req.query;

        // Parse category filter: could be single string, array, or comma-separated string
        let categoryFilterVal = category;
        if (category) {
            if (typeof category === 'string') {
                if (category.includes(',')) {
                    categoryFilterVal = category.split(',').map(s => s.trim().toLowerCase());
                } else {
                    categoryFilterVal = [category.trim().toLowerCase()];
                }
            } else if (Array.isArray(category)) {
                categoryFilterVal = category.map(s => s.toString().trim().toLowerCase());
            }
        }

        const userId = req.user._id;
        const page = Math.max(Number(pageStr) || 1, 1);
        const limit = Math.min(Math.max(Number(limitStr) || 20, 1), 100);
        const skip = (page - 1) * limit;

        // Coupon IDs this user has already redeemed (as ObjectIds)
        const redemptions = await Redemption.find({ userId }).select('couponId').lean();
        const redeemedIds = redemptions.map(r => r.couponId);   // already ObjectIds

        const filter = buildFilter({ tab, redeemedIds, category: categoryFilterVal, brand, search, discountType, validity, offerType, verified });
        const sort = buildSort(sortBy);

        // DEBUG LOGGING
        logger.info(`[PartnerCoupon] Search Query:`, {
            search,
            verified,
            tab,
            category,
            brand,
            filter: JSON.stringify(filter, null, 2),
            sort: JSON.stringify(sort, null, 2)
        });

        const [docs, total] = await Promise.all([
            col().find(filter).sort(sort).skip(skip).limit(limit).toArray(),
            col().countDocuments(filter),
        ]);

        // DETAILED DEBUG: Log sample coupon data for verification
        if (docs.length > 0) {
            logger.info(`[PartnerCoupon] First result sample:`, {
                id: docs[0]._id,
                brandName: docs[0].brandName,
                isVerified: docs[0].isVerified,
                end: docs[0].end,
                title: docs[0].title,
                healthScore: docs[0].trend?.healthScore
            });
        } else {
            logger.warn(`[PartnerCoupon] NO RESULTS - Checking database state...`);

            // Check how many total coupons exist (unfiltered)
            const totalCoupons = await col().countDocuments({});
            logger.warn(`Total coupons in collection: ${totalCoupons}`);

            // Check how many verified coupons exist
            const verifiedCount = await col().countDocuments({ isVerified: true });
            logger.warn(`Verified coupons: ${verifiedCount}`);

            // Check how many active (non-expired) coupons exist
            const now = new Date();
            const activeCount = await col().countDocuments({
                $or: [
                    { end: { $gte: now } },
                    { end: null },
                    { end: { $exists: false } }
                ]
            });
            logger.warn(`Active (non-expired) coupons: ${activeCount}`);

            // If search was used, check how many match just the search (ignoring verified/active)
            if (search) {
                const rx = { $regex: search, $options: 'i' };
                const searchOnlyCount = await col().countDocuments({
                    $or: [
                        { brandName: rx },
                        { categories: rx },
                        { title: rx },
                        { couponTitle: rx },
                        { couponName: rx },
                        { description: rx },
                        { code: rx },
                        { discount: rx }
                    ]
                });
                logger.warn(`Coupons matching search "${search}" (any status): ${searchOnlyCount}`);
            }
        }

        logger.info(`[PartnerCoupon] Search Results:`, {
            search,
            total,
            found: docs.length,
            page,
            pages: Math.ceil(total / limit) || 1
        });

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

        // 1. Fetch current coupon document
        const coupon = await col().findOne({ _id: couponObjId });
        if (!coupon) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Coupon not found in partner collection');
        }

        // 2. Extract current values with defaults
        const oldSuccessCount = coupon.successCount || 0;
        const oldFailedCount = coupon.failedCount || 0;
        
        // Import calculation function from cron
        const { calculateReliabilityScore } = require('../cron/healthScoreCron');
        
        const oldReliabilityScore = coupon.trend?.reliabilityScore ?? calculateReliabilityScore(oldSuccessCount, oldFailedCount);
        const oldHealthScore = coupon.trend?.healthScore || 0;

        // 3. Compute new success/failed counts
        const newSuccessCount = oldSuccessCount + (outcome === 'success' ? 1 : 0);
        const newFailedCount = oldFailedCount + (outcome === 'failure' ? 1 : 0);

        // 4. Calculate new reliability score
        const newReliabilityScore = calculateReliabilityScore(newSuccessCount, newFailedCount);

        // 5. Atomic removal of old reliability score component and adding the new one with weight 0.4
        // Formula: newHealthScore = oldHealthScore - (oldReliabilityScore * 0.4) + (newReliabilityScore * 0.4)
        const baseHealthScore = oldHealthScore - (oldReliabilityScore * 0.4);
        const newHealthScore = baseHealthScore + (newReliabilityScore * 0.4);

        // 6. Update database atomically
        const result = await col().updateOne(
            { _id: couponObjId },
            {
                $set: {
                    successCount: newSuccessCount,
                    failedCount: newFailedCount,
                    'trend.reliabilityScore': newReliabilityScore,
                    'trend.healthScore': newHealthScore
                }
            }
        );

        if (result.matchedCount === 0) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Coupon not found in partner collection');
        }

        logger.info(`[PartnerCoupon] Vote recorded: ${outcome} for coupon ${couponId}. ` +
            `Reliability: ${oldReliabilityScore.toFixed(2)} -> ${newReliabilityScore.toFixed(2)}, ` +
            `HealthScore: ${oldHealthScore.toFixed(2)} -> ${newHealthScore.toFixed(2)}`);

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
