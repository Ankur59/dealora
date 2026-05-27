// Vcommission normalization function
const normalizeCoupon = (c) => {
    const {
        id,
        code,
        description,
        status,
        type,
        campaign_id,
        start,
        end,
        campaign_name,
        tracking_link,
        discount,
        coupon_type,
        merchant_logo,
        ...rest
    } = c;

    const brandName = campaign_name ? campaign_name.split(" ")[0] : "Unknown";
    const endDate = end ? new Date(end) : null;
    const now = new Date();

    const resolvedStatus = endDate && endDate < now
        ? "expired"
        : (status === "active" ? "active" : "active");

    const obj = {
        partner: "vcommission",
        description: description || null,
        type: type || "generic",
        status: resolvedStatus,
        brandName,
        start: start ? new Date(start) : null,
        end: endDate,
        campaignId: campaign_id ? String(campaign_id) : null,
        trackingLink: tracking_link || null,
        couponVisitingLink: tracking_link || null,
        discount: discount || null,
        merchantName: campaign_name || brandName,
        couponType: coupon_type || null,
        isInStore: false,
        isNewUser: false,
        isVerified: false,
        title: description ? description.slice(0, 100) : null,
        merchantLogo: merchant_logo || null,
        discountWeight: 0,
        meta: {
            ...rest,
            campaign_name,
            tracking_link,
            discount,
            coupon_type,
            merchant_logo,
        }
    };
    if (id) obj.couponId = String(id);

    if (code && code.trim() !== "") {
        obj.code = code.trim().toUpperCase();
    }

    return obj;
};


export default normalizeCoupon