/**
 * Central tracking link validation patterns.
 *
 * This is the SINGLE SOURCE OF TRUTH for how we identify a valid affiliate
 * tracking link (one that carries offer_id/aff_id parameters).
 *
 * ── How to add a new affiliate network ───────────────────────────────────────
 * Add its unique parameter pair(s) to the regex alternation below, then
 * re-test with the scratch/test_normalize.js script.
 * The updated pattern is automatically picked up by:
 *   • normalize.js      (detectOfferType)
 *   • MongoDB aggregation pipeline in partnerCouponController.js (Offer sort)
 */

/**
 * JavaScript regex — used for runtime link validation in normalize.js.
 *
 * Matches any URL whose query string contains BOTH:
 *   - an offer identifier param:  offer_id | offerid
 *   - an affiliate id param:      aff_id   | affid
 * in any order, with any characters between them.
 */
export const TRACKING_LINK_REGEX =
    /[?&](offer_id|offerid)=[^&]*(&[^&]*)*&(aff_id|affid)=|[?&](aff_id|affid)=[^&]*(&[^&]*)*&(offer_id|offerid)=/i;

/**
 * MongoDB PCRE regex string — used inside `$regexMatch` aggregation expressions.
 *
 * Equivalent semantic: the `trackingLink` field must contain BOTH
 * offer_id/offerid AND aff_id/affid in its query string.
 * Options: case-insensitive ("i").
 */
export const TRACKING_LINK_MONGO_REGEX =
    '(offer_id|offerid).*?(aff_id|affid)|(aff_id|affid).*?(offer_id|offerid)';

export const TRACKING_LINK_MONGO_OPTIONS = 'i';
