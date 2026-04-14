// API calls for v-commission
import limitedGet from "../config/axios.js"
import campaign from "../models/campaign.model.js"
import pLimit from "p-limit"
import fetchCouponsByCampaign from "./helpers/fetchCoupons.js"

export const getAllCategory = async () => {
    console.log(process.env.V_COMMISSION_API_KEY)
    const response = await limitedGet("https://api.trackier.com/v2/publishers/categories", {
        params: {
            apikey: process.env.V_COMMISSION_API_KEY
        }
    })
    // console.log(response.data.categories)
    return response.data
}

export const getAllCampaigns = async (categories = [], limit) => {
    let page = 1;
    let allCampaigns = [];

    while (true) {
        const response = await limitedGet(
            "https://api.trackier.com/v2/publisher/campaigns",
            {
                params: {
                    apiKey: process.env.V_COMMISSION_API_KEY,
                    page,
                    categories,
                    limit,
                },
            }
        );
        const campaigns = response?.data?.data.campaigns;

        if (!campaigns || campaigns.length === 0) {
            break;
        }

        allCampaigns.push(...campaigns);

        if (limit && allCampaigns.length >= limit) {
            return allCampaigns.slice(0, limit);
        }

        page++;
    }
    return allCampaigns;
};


// Note: We just need to call this function and coupons will be sent to db using batch write 
export const getAllCouponsVcom = async (campaignId) => {
    if (campaignId) {
        return await fetchCouponsByCampaign(campaignId)
    }
    else {
        try {
            const campaigns = await campaign.find({ partner: "vcommission" }).lean()

            const limit = pLimit(5); // control concurrency

            const results = await Promise.all(
                campaigns.map(camp =>
                    limit(() => fetchCouponsByCampaign(camp.campaignId, camp.countries || [], camp.categories || []))
                )
            );

            return results.flat();
        } catch (error) {
            console.log(error)
        }

    }
}