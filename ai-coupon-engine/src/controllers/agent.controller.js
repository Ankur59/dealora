import Coupon from "../models/coupon.model.js";

/**
 * Get a batch of coupons that need verification by the AI Agent.
 */
export const getPendingTasks = async (req, res) => {
    try {
        // Find up to 5 coupons that have a code but are not yet verified,
        // or haven't been verified in a long time.
        const coupons = await Coupon.find({
            code: { $exists: true, $ne: "" },
            $or: [
                { isVerified: false },
                { verifiedOn: { $exists: false } },
                // You can add logic here to re-verify older coupons:
                // { verifiedOn: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } 
            ],
            // We only want to verify coupons that have a link to visit
            $or: [
                { couponVisitingLink: { $exists: true, $ne: "" } },
                { trackingLink: { $exists: true, $ne: "" } }
            ]
        }).limit(5);

        // Format for the Chrome Extension
        const tasks = coupons.map(c => ({
            id: c._id.toString(),
            url: c.couponVisitingLink || c.trackingLink,
            code: c.code,
            conditions: c.description || `Verify if the coupon code ${c.code} works on checkout.`,
            brand: c.brandName
        }));

        res.status(200).json({ success: true, coupons: tasks });
    } catch (error) {
        console.error("[Agent Controller] Error fetching pending tasks:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Receive verification result from the AI Agent and update the database.
 */
export const submitTaskResult = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, reason } = req.body; // status: "valid" | "invalid" | "expired"

        // Find and update the coupon
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            taskId,
            {
                isVerified: true,
                verifiedOn: new Date(),
                // If it's valid, map to 'active'. Otherwise map 'invalid'/'expired'.
                status: status === "valid" ? "active" : status,
                verificationReason: reason || "Verified by AI Agent"
            },
            { returnDocument: 'after' }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        console.log(`[Agent Controller] Updated coupon ${taskId} to status: ${updatedCoupon.status}`);
        res.status(200).json({ success: true, coupon: updatedCoupon });
    } catch (error) {
        console.error(`[Agent Controller] Error submitting task result for ${req.params.taskId}:`, error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
