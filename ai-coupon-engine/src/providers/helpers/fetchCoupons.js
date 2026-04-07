import { syncCouponsVCom } from "../../services/vcommission/coupon.service.js";

const BATCH_SIZE = 100;

async function fetchCouponsByCampaign(campaignId) {
    let buffer = [];
    let pageToken = "";
    let prevPageToken = null;

    while (true) {
        const params = {
            campaignId,
            apikey: process.env.V_COMMISSION_API_KEY,
            ...(pageToken && { pageToken }),
        };

        const response = await limitedGet(url, { params });

        const coupons = response.data?.coupons || [];

        if (coupons.length === 0) break;

        buffer.push(...coupons);

        if (buffer.length >= BATCH_SIZE) {
            await syncCouponsVCom(buffer);
            buffer = []; // clear
        }

        prevPageToken = pageToken;
        pageToken = response.data?.pageToken || "";

        if (!pageToken || pageToken === prevPageToken) break;
    }

    if (buffer.length > 0) {
        await syncCouponsVCom(buffer);
    }
}


export default fetchCouponsByCampaign

