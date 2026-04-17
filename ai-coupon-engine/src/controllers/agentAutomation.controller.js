import AutomationMap from "../models/automationMap.model.js";
import MerchantAccount from "../models/merchantAccount.model.js";

/**
 * Fetch automation map steps for a given domain and flowType
 */
export const getAutomationMap = async (req, res) => {
    try {
        const { domain, type } = req.params;
        const normDomain = domain.toLowerCase().trim();
        
        const map = await AutomationMap.findOne({ domain: normDomain, flowType: type, isActive: true });
        
        res.status(200).json({ success: true, map: map || null });
    } catch (error) {
        console.error("[Agent Controller] Error fetching automation map:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Upsert automation map steps for a domain/flowType
 */
export const upsertAutomationMap = async (req, res) => {
    try {
        const { domain, flowType, steps } = req.body;
        const normDomain = domain.toLowerCase().trim();
        
        const map = await AutomationMap.findOneAndUpdate(
            { domain: normDomain, flowType },
            { steps, isActive: true },
            { new: true, upsert: true }
        );
        
        res.status(200).json({ success: true, map });
    } catch (error) {
        console.error("[Agent Controller] Error upserting automation map:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Get credentials for injecting during automation
 */
export const getMerchantCredentials = async (req, res) => {
    try {
        const { domain } = req.params;
        const normDomain = domain.toLowerCase().trim();
        
        const account = await MerchantAccount.findOne({ domain: normDomain, status: 'active' });
        
        // Return username and password. In a real app we'd encrypt this in the DB, decrypt here.
        if (account) {
            res.status(200).json({ success: true, credentials: { username: account.username, password: account.password } });
        } else {
            res.status(404).json({ success: false, message: "No active credentials found" });
        }
    } catch (error) {
        console.error("[Agent Controller] Error fetching credentials:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
