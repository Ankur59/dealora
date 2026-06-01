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
const SavePrivateCoupon = require('../models/SavePrivateCoupon');
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
        offerType: doc.offerType ?? 'Coupon',
        isInStore: doc.isInStore ?? false,
        isNewUser: doc.isNewUser ?? false,
        isVerified: doc.isVerified ?? false,
        healthScore: typeof doc.trend?.healthScore === 'number'
            ? Math.round(doc.trend.healthScore * 100) / 100
            : null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

/** Build the MongoDB filter object for the list endpoint. */
function buildFilter({ tab, redeemedIds, category, brand, search, discountType, validity, offerType, verified }) {
    const now = new Date();
    const andConditions = [];  // Collect all AND conditions

    // ── 1. TAB FILTER (active/expired) ──
    if (offerType === 'Offer') {
        // Offers strictly require a future expiry date (not null/expired) and not already redeemed by user
        andConditions.push({ end: { $gt: now } });
        if (redeemedIds && redeemedIds.length > 0) {
            andConditions.push({ _id: { $nin: redeemedIds } });
        }
    } else if (tab === 'expired') {
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
        if (redeemedIds && redeemedIds.length > 0) {
            andConditions.push({ _id: { $nin: redeemedIds } });
        }
    }

    // ── 2. VERIFIED FILTER ──
    // Do not filter by isVerified for offers as they are not validated
    if (offerType !== 'Offer' && (verified === 'true' || verified === true)) {
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

/**
 * Build a MongoDB aggregation pipeline for the Offer mode sort.
 *
 * Sort priority:
 *   1. hasValidTrackingLink DESC  — offers that carry a real affiliate link come first
 *   2. discountWeight DESC        — higher-value offers within each group
 *   3. createdAt DESC             — tie-breaker
 *
 * The `hasValidTrackingLink` flag is computed at query time via $regexMatch so that
 * future affiliate patterns only need to be updated in the shared
 * trackingLinkValidator constants (no schema migration required).
 *
 * ── To add a new affiliate network's pattern ─────────────────────────────────
 * Edit TRACKING_LINK_MONGO_REGEX in ai-coupon-engine/src/shared/trackingLinkValidator.js.
 * This function will automatically pick up the change on the next deploy.
 * ─────────────────────────────────────────────────────────────────────────────
/**
 *
 * @param {Object} filter    - MongoDB match filter (built by buildFilter)
 * @param {string} sortBy    - sort parameter
 * @param {number} skip      - documents to skip (pagination)
 * @param {number} limit     - page size
 * @returns {Array}          - aggregation pipeline stages
 */
function buildOfferAggregation(filter, sortBy, skip, limit) {
    // Regex that identifies a valid affiliate tracking link.
    // Mirrors TRACKING_LINK_MONGO_REGEX in ai-coupon-engine/src/shared/trackingLinkValidator.js.
    // Keep these two values in sync when adding new affiliate partners.
    const TRACKING_REGEX = '(offer_id|offerid).{0,200}?(aff_id|affid)|(aff_id|affid).{0,200}?(offer_id|offerid)';
    const TRACKING_REGEX_OPTIONS = 'i';

    let sortSpec = {};
    if (!sortBy || sortBy === 'null' || sortBy === '') {
        sortSpec = { hasValidTrackingLink: -1, 'trend.healthScore': -1, createdAt: -1 };
    } else {
        const baseSort = buildSort(sortBy);
        sortSpec = { ...baseSort };
        if (sortSpec.hasValidTrackingLink === undefined) {
            sortSpec.hasValidTrackingLink = -1;
        }
    }

    return [
        // 1. Filter
        { $match: filter },

        // 2. Compute hasValidTrackingLink flag
        {
            $addFields: {
                hasValidTrackingLink: {
                    $cond: {
                        if: {
                            $and: [
                                { $ne: [{ $type: '$trackingLink' }, 'missing'] },
                                { $ne: ['$trackingLink', null] },
                                { $ne: ['$trackingLink', ''] },
                            ]
                        },
                        then: {
                            $cond: [
                                {
                                    $regexMatch: {
                                        input: '$trackingLink',
                                        regex: TRACKING_REGEX,
                                        options: TRACKING_REGEX_OPTIONS,
                                    }
                                },
                                1,   // valid tracking link
                                0    // link exists but not a tracking link
                            ]
                        },
                        else: 0  // no link at all
                    }
                }
            }
        },

        // 3. Sort: dynamically based on selected sort options
        { $sort: sortSpec },

        // 4. Pagination
        { $skip: skip },
        { $limit: limit },

        // 5. Drop the synthetic field so downstream shapeDoc is clean
        { $project: { hasValidTrackingLink: 0 } },
    ];
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
        const { q = '', page: pageStr = '1', limit: limitStr = '20', category, offerType = 'Coupon' } = req.query;

        const term = q.trim();
        if (!term) {
            return successResponse(res, STATUS_CODES.OK, 'Search results', {
                total: 0, page: 1, pages: 1, count: 0, limit: 20, coupons: [], categories: [],
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
                { end: { $gt: now } },          // not expired
                { offerType: offerType },
                { $or: [{ brandName: rx }, { categories: rx }] },
            ],
        };

        // Only enforce isVerified filter for Coupon mode, skip for Offer mode
        if (offerType === 'Coupon') {
            filter.$and.push({ isVerified: true });
        }

        // If a category filter is provided, append strict category matching
        if (category) {
            filter.$and.push({ categories: { $regex: new RegExp(`^${category.trim()}$`, 'i') } });
        }

        let docs = [];
        let total = 0;

        if (offerType === 'Offer') {
            // Use the aggregation pipeline to enforce custom trackingLink-based sorting
            const pipeline = buildOfferAggregation(filter, '', skip, limit);
            const countPipeline = [{ $match: filter }, { $count: 'n' }];

            const [aggDocs, countResult] = await Promise.all([
                col().aggregate(pipeline).toArray(),
                col().aggregate(countPipeline).toArray(),
            ]);

            docs = aggDocs;
            total = countResult[0]?.n ?? 0;
        } else {
            // Default Coupon mode sorting: trend.healthScore DESC
            const sort = { 'trend.healthScore': -1 };
            const [findDocs, findTotal] = await Promise.all([
                col().find(filter).sort(sort).skip(skip).limit(limit).toArray(),
                col().countDocuments(filter),
            ]);

            docs = findDocs;
            total = findTotal;
        }

        const coupons = docs.map(d => shapeDoc(d, false));
        const pages = Math.ceil(total / limit) || 1;

        // Fetch distinct categories selectively
        let categories = [];
        if (!category) {
            // Only search distinct categories if the query explicitly matches a brandName in DB
            const isBrandSearch = await col().findOne({
                ...(offerType === 'Coupon' ? { isVerified: true } : {}),
                end: { $gt: now },
                offerType: offerType,
                brandName: { $regex: new RegExp(`^${termLower}$`, 'i') }
            });

            if (isBrandSearch) {
                const categoryFilter = {
                    $and: [
                        ...(offerType === 'Coupon' ? [{ isVerified: true }] : []),
                        { end: { $gt: now } },
                        { offerType: offerType },
                        { brandName: { $regex: new RegExp(`^${termLower}$`, 'i') } },
                    ]
                };
                const distinctCategories = await col().distinct('categories', categoryFilter);
                categories = distinctCategories.filter(c => c && c.trim().length > 0);
            }
        }

        return successResponse(res, STATUS_CODES.OK, 'Search results', {
            total, page, pages, count: coupons.length, limit, coupons, categories,
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
            verified = 'true',
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
        const redemptions = await Redemption.find({ userId: userId.toString() }).select('couponId').lean();
        const redeemedIds = redemptions.map(r => r.couponId);   // already ObjectIds

        const filter = buildFilter({ tab, redeemedIds, category: categoryFilterVal, brand, search, discountType, validity, offerType, verified });

        // DEBUG LOGGING
        logger.info(`[PartnerCoupon] Search Query:`, {
            search, verified, tab, category, brand, offerType,
            filter: JSON.stringify(filter, null, 2),
        });

        let docs, total;

        if (offerType === 'Offer') {
            // ── Offer mode: aggregation pipeline sorts by hasValidTrackingLink → discountWeight ──
            const pipeline = buildOfferAggregation(filter, sortBy, skip, limit);
            const countPipeline = [{ $match: filter }, { $count: 'n' }];

            const [aggDocs, countResult] = await Promise.all([
                col().aggregate(pipeline).toArray(),
                col().aggregate(countPipeline).toArray(),
            ]);

            docs = aggDocs;
            total = countResult[0]?.n ?? 0;
        } else {
            // ── Coupon mode (default): simple find + sort — unchanged behaviour ──
            const sort = buildSort(sortBy);
            logger.info(`[PartnerCoupon] Sort:`, { sort: JSON.stringify(sort, null, 2) });

            const [findDocs, findTotal] = await Promise.all([
                col().find(filter).sort(sort).skip(skip).limit(limit).toArray(),
                col().countDocuments(filter),
            ]);

            docs = findDocs;
            total = findTotal;
        }

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
                        { brandName: rx }, { categories: rx }, { title: rx },
                        { couponTitle: rx }, { couponName: rx }, { description: rx },
                        { code: rx }, { discount: rx }
                    ]
                });
                logger.warn(`Coupons matching search "${search}" (any status): ${searchOnlyCount}`);
            }
        }

        logger.info(`[PartnerCoupon] Search Results:`, {
            search, total, found: docs.length, page,
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
        const offerType = req.query.offerType || 'Coupon';
        const { category, search } = req.query;

        const matchStage = { userId: userId.toString() };
        
        const andConditions = [
            { 'coupon.offerType': offerType }
        ];

        // category filter
        if (category) {
            let categoryFilterVal = category;
            if (typeof category === 'string') {
                if (category.includes(',')) {
                    categoryFilterVal = category.split(',').map(s => s.trim().toLowerCase());
                } else {
                    categoryFilterVal = [category.trim().toLowerCase()];
                }
            } else if (Array.isArray(category)) {
                categoryFilterVal = category.map(s => s.toString().trim().toLowerCase());
            }

            if (categoryFilterVal && categoryFilterVal.length > 0) {
                andConditions.push({ 'coupon.categories': { $in: categoryFilterVal } });
            }
        }

        // search filter
        if (search) {
            const searchTerm = search.trim();
            if (searchTerm !== '') {
                const rx = { $regex: searchTerm, $options: 'i' };
                andConditions.push({
                    $or: [
                        { 'coupon.brandName': rx },
                        { 'coupon.categories': rx },
                        { 'coupon.title': rx },
                        { 'coupon.description': rx },
                        { 'coupon.code': rx },
                        { 'coupon.discount': rx }
                    ]
                });
            }
        }

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'partnercoupons',
                    localField: 'couponId',
                    foreignField: '_id',
                    as: 'coupon'
                }
            },
            { $unwind: '$coupon' },
            { $match: { $and: andConditions } },
            { $sort: { redeemedAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        const countPipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'partnercoupons',
                    localField: 'couponId',
                    foreignField: '_id',
                    as: 'coupon'
                }
            },
            { $unwind: '$coupon' },
            { $match: { $and: andConditions } },
            { $count: 'total' }
        ];

        const [results, countResult] = await Promise.all([
            Redemption.aggregate(pipeline),
            Redemption.aggregate(countPipeline)
        ]);

        const total = countResult[0]?.total ?? 0;
        const coupons = results.map(r => {
            return { ...shapeDoc(r.coupon, true), redeemedAt: r.redeemedAt };
        });

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

        // Import calculation functions from cron
        const { calculateReliabilityScore, calculateFreshnessScore, calculateHealthScore } = require('../cron/healthScoreCron');

        const oldReliabilityScore = coupon.trend?.reliabilityScore ?? calculateReliabilityScore(oldSuccessCount, oldFailedCount);

        // 3. Compute new success/failed counts
        const newSuccessCount = oldSuccessCount + (outcome === 'success' ? 1 : 0);
        const newFailedCount = oldFailedCount + (outcome === 'failure' ? 1 : 0);

        // 4. Calculate new reliability score
        const newReliabilityScore = calculateReliabilityScore(newSuccessCount, newFailedCount);

        // 5. Recalculate health score via the central calculation engine
        const createdAt = coupon.createdAt || new Date();
        const trendScore = coupon.trend?.trendScore || 0;
        const freshnessScore = calculateFreshnessScore(createdAt);
        const newHealthScore = calculateHealthScore(newReliabilityScore, freshnessScore, trendScore);

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
            `HealthScore: ${(coupon.trend?.healthScore ?? 0).toFixed(2)} -> ${newHealthScore.toFixed(2)}`);


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

/**
 * @route   POST /api/partner-coupons/:id/save
 * @desc    Save a partner coupon (idempotent)
 * @access  Private
 */
exports.savePartnerCoupon = async (req, res) => {
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

        // Verify coupon exists in partner collection
        const coupon = await col().findOne({ _id: couponObjId });
        if (!coupon) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Coupon not found');
        }

        // Upsert save entry — idempotent
        const saved = await SavePrivateCoupon.findOneAndUpdate(
            { userId: userId.toString(), couponId: couponObjId },
            { $setOnInsert: { userId: userId.toString(), couponId: couponObjId, savedAt: new Date() } },
            { upsert: true, new: true }
        );

        return successResponse(res, STATUS_CODES.OK, 'Coupon saved successfully', {
            saved: {
                _id: saved._id,
                userId: saved.userId,
                couponId: saved.couponId,
                savedAt: saved.savedAt,
            },
            coupon: shapeDoc(coupon, false),
        });
    } catch (err) {
        logger.error(`[PartnerCoupon] savePartnerCoupon: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to save coupon');
    }
};

/**
 * @route   DELETE /api/partner-coupons/:id/save
 * @desc    Unsave a partner coupon
 * @access  Private
 */
exports.unsavePartnerCoupon = async (req, res) => {
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

        const result = await SavePrivateCoupon.findOneAndDelete({
            userId: userId.toString(),
            couponId: couponObjId
        });

        if (!result) {
            return errorResponse(res, STATUS_CODES.NOT_FOUND, 'Saved coupon entry not found');
        }

        return successResponse(res, STATUS_CODES.OK, 'Coupon unsaved successfully');
    } catch (err) {
        logger.error(`[PartnerCoupon] unsavePartnerCoupon: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to unsave coupon');
    }
};

/**
 * @route   GET /api/partner-coupons/saved
 * @desc    Saved coupons for this user, segregated by offerType and paginated.
 * @query   page, limit, offerType
 * @access  Private
 */
exports.getSavedPartnerCoupons = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const skip = (page - 1) * limit;
        const offerType = req.query.offerType || 'Coupon';
        const { category, search } = req.query;

        const matchStage = { userId: userId.toString() };
        
        const andConditions = [
            { 'coupon.offerType': offerType }
        ];

        // category filter
        if (category) {
            let categoryFilterVal = category;
            if (typeof category === 'string') {
                if (category.includes(',')) {
                    categoryFilterVal = category.split(',').map(s => s.trim().toLowerCase());
                } else {
                    categoryFilterVal = [category.trim().toLowerCase()];
                }
            } else if (Array.isArray(category)) {
                categoryFilterVal = category.map(s => s.toString().trim().toLowerCase());
            }

            if (categoryFilterVal && categoryFilterVal.length > 0) {
                andConditions.push({ 'coupon.categories': { $in: categoryFilterVal } });
            }
        }

        // search filter
        if (search) {
            const searchTerm = search.trim();
            if (searchTerm !== '') {
                const rx = { $regex: searchTerm, $options: 'i' };
                andConditions.push({
                    $or: [
                        { 'coupon.brandName': rx },
                        { 'coupon.categories': rx },
                        { 'coupon.title': rx },
                        { 'coupon.description': rx },
                        { 'coupon.code': rx },
                        { 'coupon.discount': rx }
                    ]
                });
            }
        }

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'partnercoupons',
                    localField: 'couponId',
                    foreignField: '_id',
                    as: 'coupon'
                }
            },
            { $unwind: '$coupon' },
            { $match: { $and: andConditions } },
            { $sort: { savedAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        const countPipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'partnercoupons',
                    localField: 'couponId',
                    foreignField: '_id',
                    as: 'coupon'
                }
            },
            { $unwind: '$coupon' },
            { $match: { $and: andConditions } },
            { $count: 'total' }
        ];

        const [results, countResult] = await Promise.all([
            SavePrivateCoupon.aggregate(pipeline),
            SavePrivateCoupon.aggregate(countPipeline)
        ]);

        const total = countResult[0]?.total ?? 0;
        const coupons = results.map(r => {
            return { ...shapeDoc(r.coupon, false), savedAt: r.savedAt };
        });

        const pages = Math.ceil(total / limit) || 1;
        
        return successResponse(res, STATUS_CODES.OK, 'Saved coupons fetched', {
            total, page, pages, count: coupons.length, limit, coupons,
        });
    } catch (err) {
        logger.error(`[PartnerCoupon] getSavedPartnerCoupons: ${err.message}`);
        return errorResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to fetch saved coupons');
    }
};
