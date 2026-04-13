import Partner from "../models/partners.model.js";
import { fetchAndNormalizePartnerData } from "../services/normalization.service.js";

// 1. Create a new Partner
export const createPartner = async (req, res) => {
    try {
        const { partnerName, status, partnerApis } = req.body;
        const newPartner = new Partner({ partnerName, status, partnerApis });
        await newPartner.save();
        res.status(201).json({ success: true, data: newPartner });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// 2. Get all Partners
export const getPartners = async (req, res) => {
    try {
        const partners = await Partner.find({});
        res.status(200).json({ success: true, data: partners });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Get a single Partner by ID
export const getPartnerById = async (req, res) => {
    try {
        const partner = await Partner.findById(req.params.id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });
        res.status(200).json({ success: true, data: partner });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Add or Update an API configuration (including apiDiff) for a Partner
export const upsertPartnerApi = async (req, res) => {
    try {
        const { id } = req.params;
        const { apiUrl, apiType, apiParams, apiDescription, targetSchema, apiResponseFields, responseItemPath, apiDiff } = req.body;

        const partner = await Partner.findById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });

        // Check if API already exists based on URL
        const existingApiIndex = partner.partnerApis.findIndex(api => api.apiUrl === apiUrl);

        const newApiData = { apiUrl, apiType, apiParams, apiDescription, targetSchema, apiResponseFields, responseItemPath, apiDiff };

        if (existingApiIndex >= 0) {
            // Update existing
            partner.partnerApis[existingApiIndex] = { ...partner.partnerApis[existingApiIndex].toObject(), ...newApiData };
        } else {
            // Add new
            partner.partnerApis.push(newApiData);
        }

        await partner.save();
        res.status(200).json({ success: true, data: partner });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// 5. Update apiDiff specifically for a Partner API
export const updateApiDiff = async (req, res) => {
    try {
        const { partnerId, apiId } = req.params;
        const { apiDiff } = req.body; // Array of { standardField, partnerField, defaultValue, castTo }

        const partner = await Partner.findById(partnerId);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });

        const api = partner.partnerApis.id(apiId);
        if (!api) return res.status(404).json({ success: false, message: "Partner API not found" });

        api.apiDiff = apiDiff;
        await partner.save();

        res.status(200).json({ success: true, data: partner });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// 6. Delete a Partner
export const deletePartner = async (req, res) => {
    try {
        const partner = await Partner.findByIdAndDelete(req.params.id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });
        res.status(200).json({ success: true, message: "Partner deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 7. Trigger Normalization for a Partner API
export const syncPartnerData = async (req, res) => {
    try {
        const { partnerName, targetSchema } = req.params;
        const normalizedData = await fetchAndNormalizePartnerData(partnerName, targetSchema);
        
        // At this point, normalizedData contains the transformed objects ready to be inserted
        // into campaign, coupon, or category models.
        
        res.status(200).json(normalizedData);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
