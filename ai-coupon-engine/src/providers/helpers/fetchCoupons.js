import limitedGet from "../../config/axios.js";
import { syncCouponsVCom } from "../../services/vcommission/coupon.service.js";

const BATCH_SIZE = 100;

async function fetchCouponsByCampaign(campaignId, countries = [], catogries = []) {
    let buffer = [];
    let pageToken = "";
    let prevPageToken = null;
    let count = 0
    while (true) {
        console.log("fetching for campaign", campaignId)
        const params = {
            campaignId,
            apikey: process.env.V_COMMISSION_API_KEY,
            ...(pageToken && { pageToken }),
        };

        const response = await limitedGet("https://api.trackier.com/v2/publishers/coupons", { params });

        const coupons = response.data?.coupons || [];

        if (coupons.length === 0) break;

        buffer.push(...coupons);
        console.log("Coupons for campaign id", campaignId, coupons)
        if (buffer.length >= BATCH_SIZE) {
            await syncCouponsVCom(buffer, countries, catogries);

            buffer = []; // clear
        }

        prevPageToken = pageToken;
        pageToken = response.data?.pageToken || "";
        count++
        if (!pageToken || pageToken === prevPageToken) break;
    }

    if (buffer.length > 0) {
        await syncCouponsVCom(buffer, countries, catogries);
    }
}


export default fetchCouponsByCampaign

