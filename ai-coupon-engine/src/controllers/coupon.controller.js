import Coupon from "../models/coupon.model.js";

/**
 * GET /api/v1/coupons
 * List all coupons. Optional query filters: ?brand=Amazon&status=active&verified=true
 */
export const getCoupons = async (req, res) => {
    try {
        const { brand, status, verified } = req.query;
        const filter = {};
        if (brand) filter.brandName = { $regex: brand, $options: "i" };
        if (status) filter.status = status;
        if (verified === 'true') filter.isVerified = true;
        if (verified === 'false') filter.isVerified = false;

        const coupons = await Coupon.find(filter).sort({ createdAt: -1 }).limit(200).lean();
        res.status(200).json({ success: true, data: coupons });
    } catch (error) {
        console.error("[Coupon Controller] getCoupons error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/coupons/:id
 */
export const getCouponById = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id).lean();
        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });
        res.status(200).json({ success: true, data: coupon });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/coupons
 * Create a new coupon (manual entry from extension).
 */
export const createCoupon = async (req, res) => {
    try {
        const {
            partner, couponId, code, description, type, status,
            start, end, trackingLink, brandName, campaignId, meta,
            countries, categories, couponVisitingLink, discount
        } = req.body;

        if (!brandName || !code) {
            return res.status(400).json({ success: false, message: "brandName and code are required" });
        }

        const newCoupon = new Coupon({
            partner: partner || 'manual',
            couponId: couponId || `manual_${Date.now()}`,
            code,
            description,
            type: type || 'generic',
            status: status || 'pending',
            start: start ? new Date(start) : undefined,
            end: end ? new Date(end) : undefined,
            trackingLink,
            brandName,
            campaignId,
            meta,
            countries: countries || [],
            categories: categories || [],
            couponVisitingLink,
            discount
        });

        await newCoupon.save();
        res.status(201).json({ success: true, data: newCoupon });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Coupon with this code already exists" });
        }
        console.error("[Coupon Controller] createCoupon error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/v1/coupons/:id
 * Update a coupon (e.g., reset verification status for re-verification).
 */
export const updateCoupon = async (req, res) => {
    try {
        const updated = await Coupon.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        if (!updated) return res.status(404).json({ success: false, message: "Coupon not found" });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error("[Coupon Controller] updateCoupon error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /api/v1/coupons/:id
 */
export const deleteCoupon = async (req, res) => {
    try {
        const deleted = await Coupon.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: "Coupon not found" });
        res.status(200).json({ success: true, message: "Coupon deleted" });
    } catch (error) {
        console.error("[Coupon Controller] deleteCoupon error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
