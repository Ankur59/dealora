/**
 * Normalizes a single Coupomated merchant object into the PartnerMerchant schema format.
 * @param {Object} merchant - Raw merchant object from Coupomated API
 * @returns {Object} Normalized merchant object matching the partnerMerchant schema
 */
const normalizeCoupomatedMerchant = (merchant) => {
    return {
        partner:        "coupomated",
        merchantId:     String(merchant.id),
        merchantName:   merchant.name,
        website:        merchant.website        ?? null,
        domain:         merchant.domain_name    ?? null,
        country:        merchant.country        ?? null,
        logo:           merchant.logo           ?? null,
        stars:          merchant.stars          ?? null,
        // Coupomated sends 0/1 as an integer — coerce to boolean
        featured:       Boolean(merchant.featured),
        affiliateLink:  merchant.affiliate_link ?? null,
        categoryIds:    (merchant.category_ids    ?? []).map(String),
        categoryNames:  merchant.category_names  ?? [],
    };
};

export default normalizeCoupomatedMerchant;
