/**
 * Normalizes a single raw Admitad coupon into the internal coupon schema format.
 *
 * Admitad field → internal field:
 *   id             → couponId
 *   name           → (stored in meta.title; brandName comes from campaign.name)
 *   description    → description
 *   discount       → discount
 *   date_start     → start
 *   date_end       → end
 *   campaign.id    → campaignId
 *   campaign.name  → brandName
 *   species        → type  (promocode → generic | action → generic/deal)
 *   promocode      → code  (only present when species === 'promocode')
 *   goto_link      → trackingLink + couponVisitingLink
 *
 * @param {Object} item - Raw coupon object from Admitad API
 * @returns {Object} Normalized coupon matching the internal coupon schema
 */
const normalizeAdmitadCoupon = (item) => {
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    // Admitad species values: "promocode" (has a code) or "action" (deal, no code)
    const hasCode = item.species === 'promocode' && !!item.promocode;

    return {
        partner:            'admitad',
        couponId:           String(item.id),
        code:               hasCode ? String(item.promocode) : null,
        description:        item.description ?? null,
        discount:           item.discount     ?? null,
        start:              parseDate(item.date_start),
        end:                parseDate(item.date_end),
        trackingLink:       item.goto_link    ?? null,
        couponVisitingLink: item.goto_link    ?? null,
        brandName:          item.campaign?.name ?? item.campaign_name ?? 'Unknown',
        campaignId:         item.campaign?.id   != null ? String(item.campaign.id) : null,
        isVerified:         false,
        verifiedOn:         null,
        status:             'pending',
        // species → type mapping
        // Admitad doesn't directly map to exclusive/one_time; default to 'generic'
        type:               'generic',
        categories:         (item.categories ?? []).map(c => c.name ?? c),
        categoriesId:       (item.categories ?? []).map(c => String(c.id ?? c)),
        countries:          item.regions ? item.regions.map(r => r.region ?? r) : [],
        meta: {
            admitad_id:    item.id,
            species:       item.species      ?? null,
            name:          item.name         ?? null,
            rating:        item.rating       ?? null,
            exclusive:     item.exclusive    ?? null,
            campaign_id:   item.campaign?.id ?? null,
            modified:      item.date_modified ?? null,
        },
    };
};

export default normalizeAdmitadCoupon;
