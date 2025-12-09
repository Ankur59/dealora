const addDisplayFields = (coupon) => {
    const couponObj = coupon.toObject ? coupon.toObject() : coupon;

    const expireByDate = new Date(couponObj.expireBy);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expireByDateOnly = new Date(expireByDate);
    expireByDateOnly.setHours(0, 0, 0, 0);

    const timeDiff = expireByDateOnly.getTime() - today.getTime();
    const daysUntilExpiry = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

    const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry < 7;

    const formattedExpiry = expireByDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    let expiryStatusColor = 'green';
    if (daysUntilExpiry === 0) {
        expiryStatusColor = 'red';
    } else if (daysUntilExpiry <= 7) {
        expiryStatusColor = 'yellow';
    }

    const initial = couponObj.couponName ? couponObj.couponName.charAt(0).toUpperCase() : '';

    const badgeLabels = ['Manually Added'];
    if (couponObj.categoryLabel) {
        badgeLabels.push(couponObj.categoryLabel);
    }

    let redemptionType = 'code-only';
    if (couponObj.useCouponVia === 'Coupon Visiting Link') {
        redemptionType = 'link-only';
    } else if (couponObj.useCouponVia === 'Both') {
        redemptionType = 'both';
    }

    couponObj.display = {
        initial,
        daysUntilExpiry,
        isExpiringSoon,
        formattedExpiry,
        expiryStatusColor,
        badgeLabels,
        redemptionType,
    };

    couponObj.actions = {
        canEdit: couponObj.status === 'active',
        canDelete: true,
        canRedeem: couponObj.status === 'active',
        canShare: true,
    };

    return couponObj;
};

const addDisplayFieldsToArray = (coupons) => {
    if (!Array.isArray(coupons)) {
        return [];
    }

    return coupons.map((coupon) => addDisplayFields(coupon));
};

module.exports = {
    addDisplayFields,
    addDisplayFieldsToArray,
};

