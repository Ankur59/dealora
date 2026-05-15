import { computeDiscountWeight } from '../../../shared/discountWeight.js';

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

    return {
        partner: "coupomated",
        couponId: String(coupon.coupon_id),
        code: coupon.coupon_code ?? null,
        description,
        discount: coupon.discount ?? null,
        start: parseDate(coupon.start_date),
        end: parseDate(coupon.end_date),
        trackingLink: coupon.affiliate_link,
        couponVisitingLink: coupon.plain_link ?? null,
        brandName: coupon.merchant_name,
        merchantName: coupon.merchant_name ?? null,
        categories: coupon.category_names ?? [],
        categoriesId: (coupon.category_ids ?? []).map(String),
        couponType: resolveCouponType(coupon.discount),
        offerType: detectOfferType(coupon.affiliate_link),
        isInStore: detectIsInStore(description),
        isNewUser: detectIsNewUser(description),
        title: coupon.title ?? null,
        networkId: coupon.network_id ?? null,
        merchantId: coupon.merchant_id ?? null,
        metchantLogo: coupon.merchant_logo ?? null,
        discountWeight: computeDiscountWeight(coupon.discount),
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
