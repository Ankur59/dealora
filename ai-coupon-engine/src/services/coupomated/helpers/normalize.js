import { computeDiscountWeight } from '../../../shared/discountWeight.js';
import {
    calculateReliabilityScore,
    calculateFreshnessScore,
    calculateTrendScore,
    calculateHealthScore,
} from '../../../shared/healthScore.js';

/**
 * Detects whether a link is an affiliate tracking link (Coupon) or a generic offer link (Offer).
 * Tracking links contain parameters like offer_id and aff_id.
 * @param {string|null|undefined} link - The affiliate_link from the API
 * @returns {string} Either "Coupon" or "Offer"
 */
const detectOfferType = (link) => {
    if (!link) return "Offer";

    try {
        const url = new URL(link);
        const params = url.searchParams;

        // Check for tracking parameters: if both offer_id and aff_id exist, it's a Coupon
        const hasOfferIdParam = params.has('offer_id') || params.has('offerid');
        const hasAffIdParam = params.has('aff_id') || params.has('affid');

        // If it has tracking parameters, it's a Coupon, otherwise it's an Offer
        if (hasOfferIdParam && hasAffIdParam) {
            return "Coupon";
        }

        return "Offer";
    } catch (e) {
        // If URL parsing fails, default to "Offer"
        return "Offer";
    }
};

/** Known couponType values accepted by the schema. */
const KNOWN_COUPON_TYPES = ["FREE TRIAL", "Buy 1 Get 1 Free", "No cost EMI"];

/**
 * Maps the raw `discount` string from the Coupomated API to a schema-valid
 * couponType enum value. Falls back to "Other" for unrecognised values.
 * @param {string|null|undefined} discount - Raw discount field from the API
 * @returns {string|undefined} Schema enum value, or undefined when discount is absent
 */
const resolveCouponType = (discount) => {
    if (!discount) return undefined;
    const normalised = discount.trim();
    return KNOWN_COUPON_TYPES.includes(normalised) ? normalised : "Other";
};

/**
 * Returns true when the description indicates an in-store-only offer.
 * @param {string|null|undefined} description
 * @returns {boolean}
 */
const detectIsInStore = (description) => {
    if (!description) return false;
    return /\bin[-\s]?store\b/i.test(description);
};

/**
 * Returns true when the description indicates the offer is exclusively for new users.
 * @param {string|null|undefined} description
 * @returns {boolean}
 */
const detectIsNewUser = (description) => {
    if (!description) return false;
    return /\bnew\s+user(?:s)?\b/i.test(description);
};

/**
 * Normalizes a single Coupomated coupon object into the internal coupon schema format.
 * @param {Object} coupon - Raw coupon object from Coupomated API
 * @returns {Object} Normalized coupon object matching the coupon schema
 */
const normalizeCoupomatedCoupon = (coupon) => {
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            const [day, month, year] = parts;
            const parsed = new Date(`${year}-${month}-${day}`);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const description = coupon.description ?? null;
    const parsedEnd = parseDate(coupon.end_date);
    const now = new Date();
    // If no end_date is provided by the aggregator, default to 15 days from today
    // so the coupon is discoverable through the search endpoint (end > now filter).
    const fallbackEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const endDate = parsedEnd ?? fallbackEnd;

    // ── Compute initial health score at insert time ──────────────────────────
    // createdAt will be set to `now` by Mongoose timestamps on first insert.
    // We mirror that here so freshness = 100 for a brand-new coupon.
    const discountWeight   = computeDiscountWeight(coupon.discount);
    const reliabilityScore = calculateReliabilityScore(0, 0);    // 70  — Laplace-smoothed baseline for new coupon
    const freshnessScore   = calculateFreshnessScore(now, now);  // 100 — just created
    const trendScore       = calculateTrendScore(0, null, now);  // 0   — no discovers yet
    const healthScore      = calculateHealthScore(reliabilityScore, freshnessScore, trendScore);

    return {
        partner: "coupomated",
        couponId: String(coupon.coupon_id),
        code: coupon.coupon_code ?? null,
        description,
        // type: "generic",
        status: endDate && endDate < now ? "expired" : "active",
        discount: coupon.discount ?? null,
        start: parseDate(coupon.start_date),
        end: endDate,
        trackingLink: coupon.affiliate_link,
        couponVisitingLink: coupon.plain_link ?? null,
        brandName: (coupon.merchant_name ?? '').toLowerCase(),
        merchantName: coupon.merchant_name ? coupon.merchant_name.toLowerCase() : null,
        categories: (coupon.category_names ?? []).map(c => String(c).toLowerCase()),
        categoriesId: (coupon.category_ids ?? []).map(String),
        couponType: resolveCouponType(coupon.discount),
        offerType: detectOfferType(coupon.affiliate_link),
        isInStore: detectIsInStore(description),
        isNewUser: detectIsNewUser(description),
        isVerified: false,
        title: coupon.title ?? null,
        networkId: coupon.network_id ?? null,
        merchantId: coupon.merchant_id ?? null,
        merchantLogo: coupon.merchant_logo ?? null,
        discountWeight,
        // Seed trend sub-document so healthScore is never null on first insert.
        // The 5-hour cron will continue to update these as real data accumulates.
        trend: {
            discoverCount:    0,
            lastDiscoverAt:   null,
            reliabilityScore,   // 70  (Laplace-smoothed, zero votes default)
            trendScore,         // 0   (no discover activity)
            healthScore,        // reliability×0.55 + freshness×0.30 + trend×0.15
        },
        meta: {
            title: coupon.title ?? null,
            exclusive: coupon.exclusive ?? null,
            network_id: coupon.network_id ?? null,
            merchant_id: coupon.merchant_id ?? null,
            merchant_logo: coupon.merchant_logo ?? null,
            category_names_list: coupon.category_names_list ?? null,
            created_at: coupon.created_at ?? null,
            updated_at: coupon.updated_at ?? null,
        }
    };
};

export default normalizeCoupomatedCoupon;
