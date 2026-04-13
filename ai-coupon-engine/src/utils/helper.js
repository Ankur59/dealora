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
        ...rest
    } = c;

    const obj = {
        partner: "vcommission",

        description: description || null,
        type: type || null,
        status: status,

        start: start ? new Date(start) : null,
        end: end ? new Date(end) : null,

        campaignId: campaign_id ? String(campaign_id) : null,

        meta: rest
    };

    if (id) obj.couponId = String(id);

    if (code && code.trim() !== "") {
        obj.code = code.trim().toUpperCase();
    }

    return obj;
};


export default normalizeCoupon