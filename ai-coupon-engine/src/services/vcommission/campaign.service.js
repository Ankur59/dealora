import campaign from "../../models/campaign.model.js"
import { getAllCampaigns } from "../../providers/trackier.js"

// Function to store all the campaign in category collection in db
export const syncCampaignVCom = async () => {
    const campaigns = await getAllCampaigns();

    const operations = campaigns.map((camp) => ({
        updateOne: {
            filter: {
                partner: "vcommission",
                campaignId: String(camp.id)
            },
            update: {
                $setOnInsert: {
                    partner: "vcommission",
                    campaignId: String(camp.id),
                    title: camp.title,
                    categories: camp.categories || [],
                    countries: camp.countries || [],
                    trackingLink: camp.tracking_link,

                    // move extra fields here
                    meta: {
                        currency: camp.currency,
                        model: camp.model
                    }
                }
            },
            upsert: true
        }
    }));

    try {
        const result = await campaign.bulkWrite(operations, { ordered: false });
        console.log(result);
    } catch (error) {
        console.log("Bulk error:", error);
    }
};