import campaign from "../../models/campaign.model.js"
import Merchant from "../../models/merchant.model.js";
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
                    score: camp.score || 0,

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

    // 2. Prepare merchant operations
    // We'll take the first word of the title as the brand name for auto-sync
    const merchantOps = campaigns.map(camp => {
        const merchantName = camp.title.split(" ")[0];
        return {
            updateOne: {
                filter: { merchantName },
                update: {
                    $setOnInsert: {
                        merchantName,
                        score: camp.score || 0,
                        isActive: true,
                        merchantUrl: camp.preview_url,
                        domain: camp.preview_url
                    }
                },
                upsert: true
            }
        };
    });

    try {
        const result = await campaign.bulkWrite(operations, { ordered: false });
        if (merchantOps.length > 0) {
            await Merchant.bulkWrite(merchantOps, { ordered: false });
        }
        console.log("Campaign sync result:", result);
    } catch (error) {
        console.log("Bulk error:", error);
    }
};