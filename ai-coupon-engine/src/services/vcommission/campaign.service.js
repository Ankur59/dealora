import campaign from "../../models/campaign.model.js"
import { getAllCampaigns } from "../../providers/trackier.js"

// Function to store all the campaign in category collection in db
export const syncCampaignVCom = async () => {
    const campaigns = await getAllCampaigns();

    const operations = campaigns.map(camp => ({
        updateOne: {
            filter: { campaignId: camp.id },
            update: {
                $setOnInsert: {
                    title: camp.title,
                    currency: camp.currency,
                    model: camp.model,
                    categories: camp.categories,
                    trackingLink: camp.tracking_link,
                    countries: camp.countries
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