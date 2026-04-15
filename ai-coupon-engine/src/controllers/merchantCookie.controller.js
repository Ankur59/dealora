import MerchantCookie from "../models/merchantCookie.model.js";

/**
 * POST /api/v1/merchant-cookies
 * Called by the Chrome extension when the employee clicks "Save to Server".
 *
 * Expected body:
 * {
 *   providerName : "Amazon India",
 *   merchantUrl  : "https://www.amazon.in/",
 *   cookiesCount : 42,
 *   cookies      : [ ...chrome cookie objects ],
 *   syncedAt     : "2026-04-15T16:30:00.000Z"
 * }
 */
export const saveMerchantCookies = async (req, res) => {
    try {
        const { providerName, merchantUrl, cookiesCount, cookies, syncedAt } = req.body;

        if (!providerName || typeof providerName !== "string" || !providerName.trim()) {
            return res.status(400).json({
                success: false,
                message: "providerName is required",
            });
        }

        if (!cookies || !Array.isArray(cookies)) {
            return res.status(400).json({
                success: false,
                message: "cookies must be an array",
            });
        }

        const record = await MerchantCookie.create({
            merchantName: providerName.trim(),
            merchantUrl: merchantUrl || "",
            cookiesCount: cookiesCount ?? cookies.length,
            cookies,
            syncedAt: syncedAt ? new Date(syncedAt) : new Date(),
        });

        return res.status(201).json({
            success: true,
            message: "Cookies saved successfully",
            data: {
                id:           record._id,
                merchantName: record.merchantName,
                merchantUrl:  record.merchantUrl,
                cookiesCount: record.cookiesCount,
                syncedAt:     record.syncedAt,
                createdAt:    record.createdAt,
                updatedAt:    record.updatedAt,
            },
        });
    } catch (error) {
        console.error("[MerchantCookie] saveMerchantCookies error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

/**
 * GET /api/v1/merchant-cookies
 * Returns all saved merchant cookie sessions, newest first.
 * Optional query: ?merchant=Amazon (case-insensitive filter)
 */
export const getMerchantCookies = async (req, res) => {
    try {
        const { merchant } = req.query;

        const filter = {};
        if (merchant) {
            filter.merchantName = { $regex: merchant, $options: "i" };
        }

        const records = await MerchantCookie.find(filter)
            .select("-cookies") // omit raw cookie payload from list view
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            count:   records.length,
            data:    records,
        });
    } catch (error) {
        console.error("[MerchantCookie] getMerchantCookies error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

/**
 * GET /api/v1/merchant-cookies/:id
 * Returns a single record including full cookies array.
 */
export const getMerchantCookieById = async (req, res) => {
    try {
        const record = await MerchantCookie.findById(req.params.id).lean();

        if (!record) {
            return res.status(404).json({
                success: false,
                message: "Record not found",
            });
        }

        return res.status(200).json({
            success: true,
            data:    record,
        });
    } catch (error) {
        console.error("[MerchantCookie] getMerchantCookieById error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
