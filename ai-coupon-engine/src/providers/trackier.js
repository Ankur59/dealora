import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

export const getAllCategory = async () => {
    console.log(process.env.V_COMMISSION_API_KEY)
    const response = await axios.get("https://api.trackier.com/v2/publishers/categories", {
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
        const response = await axios.get(
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
    // console.log(allCampaigns.length, "aslkdjasd")
    return allCampaigns;
};

