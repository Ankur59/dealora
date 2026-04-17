import Merchant from "../models/merchant.model.js";

/**
 * GET /api/v1/merchants
 * Returns all merchants, newest first.
 */
export const getMerchants = async (req, res) => {
    try {
        const { search } = req.query;
        const filter = {};
        if (search) {
            filter.merchantName = { $regex: search, $options: "i" };
        }

        const merchants = await Merchant.find(filter).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: merchants.length,
            data: merchants,
        });
    } catch (error) {
        console.error("[Merchant Controller] getMerchants error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

/**
 * POST /api/v1/merchants
 * Manual creation or update (upsert) of a merchant.
 */
export const upsertMerchant = async (req, res) => {
    try {
        const { merchantName, merchantUrl, domain, score, logoUrl, description } = req.body;

        if (!merchantName) {
            return res.status(400).json({
                success: false,
                message: "merchantName is required",
            });
        }

        const updates = {
            merchantName: merchantName.trim(),
            ...(merchantUrl !== undefined && { merchantUrl }),
            ...(domain !== undefined && { domain: domain.toLowerCase() }),
            ...(score !== undefined && { score }),
            ...(logoUrl !== undefined && { logoUrl }),
            ...(description !== undefined && { description }),
        };

        const merchant = await Merchant.findOneAndUpdate(
            { merchantName:Updates.merchantName },
            updates,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return res.status(201).json({
            success: true,
            message: "Merchant saved successfully",
            data: merchant,
        });
    } catch (error) {
        console.error("[Merchant Controller] upsertMerchant error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

/**
 * PUT /api/v1/merchants/:id
 * Update an existing merchant by ID.
 */
export const updateMerchant = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.domain) updates.domain = updates.domain.toLowerCase();

        const merchant = await Merchant.findByIdAndUpdate(id, updates, { new: true });

        if (!merchant) {
            return res.status(404).json({
                success: false,
                message: "Merchant not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Merchant updated successfully",
            data: merchant,
        });
    } catch (error) {
        console.error("[Merchant Controller] updateMerchant error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

/**
 * DELETE /api/v1/merchants/:id
 */
export const deleteMerchant = async (req, res) => {
    try {
        const { id } = req.params;
        const merchant = await Merchant.findByIdAndDelete(id);

        if (!merchant) {
            return res.status(404).json({
                success: false,
                message: "Merchant not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Merchant deleted successfully",
        });
    } catch (error) {
        console.error("[Merchant Controller] deleteMerchant error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
