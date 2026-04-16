import Campaign from "../models/campaign.model.js";

// Get all campaigns (optionally filter by partner)
export const getCampaigns = async (req, res) => {
    try {
        const { partner } = req.query;
        const filter = partner ? { partner } : {};
        
        // Fetch campaigns. We want those that the admin has configured with a domain/loginUrl
        // or just all campaigns to let the admin configure them.
        const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).limit(100);
        res.status(200).json({ success: true, campaigns });
    } catch (error) {
        console.error("[Campaign Controller] Error getting campaigns:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Create a new manual campaign (if the admin wants to add a merchant manually without syncing)
export const createCampaign = async (req, res) => {
    try {
        const { partner, title, domain, loginUrl, trackingLink, campaignId } = req.body;

        if (!partner || !title) {
            return res.status(400).json({ success: false, message: "Partner and Title are required" });
        }

        const newCampaign = new Campaign({ 
            partner, 
            title, 
            domain, 
            loginUrl, 
            trackingLink, 
            campaignId: campaignId || Math.floor(Math.random() * 1000000) // Fallback for manual campaigns
        });
        await newCampaign.save();

        res.status(201).json({ success: true, campaign: newCampaign });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Campaign already exists for this partner" });
        }
        console.error("[Campaign Controller] Error creating campaign:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Update a campaign (used by admin to set domain and loginUrl)
export const updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updatedCampaign = await Campaign.findByIdAndUpdate(id, updates, { new: true });
        
        if (!updatedCampaign) {
            return res.status(404).json({ success: false, message: "Campaign not found" });
        }

        res.status(200).json({ success: true, campaign: updatedCampaign });
    } catch (error) {
        console.error("[Campaign Controller] Error updating campaign:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Delete a campaign
export const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCampaign = await Campaign.findByIdAndDelete(id);
        
        if (!deletedCampaign) {
            return res.status(404).json({ success: false, message: "Campaign not found" });
        }

        res.status(200).json({ success: true, message: "Campaign deleted successfully" });
    } catch (error) {
        console.error("[Campaign Controller] Error deleting campaign:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};