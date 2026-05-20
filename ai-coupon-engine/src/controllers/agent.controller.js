import Coupon from "../models/coupon.model.js";

export const getPendingTasks = async (req, res) => {
    try {
        const coupons = await Coupon.find({
            couponCode: { $exists: true, $nin: [null, ""] },
            couponVisitingLink: { $exists: true, $nin: [null, ""] },
            $or: [
                { verified: false },
                { verified: null },
                { verified: { $exists: false } },
                { isVerified: false },
                { isVerified: { $exists: false } }
            ]
        }).limit(20);

        const tasks = coupons.map(c => {
            const code = c.couponCode || c.code || "";
            return {
                id: c._id.toString(),
                url: c.couponVisitingLink,
                code,
                conditions: c.description || c.terms || `Verify coupon code ${code} works on checkout.`,
                brand: c.brandName
            };
        });

        res.status(200).json({ success: true, coupons: tasks });
    } catch (error) {
        console.error("[Agent Controller] Error fetching pending tasks:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const submitTaskResult = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, reason } = req.body;

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            taskId,
            {
                verified: true,
                isVerified: true,
                verifiedOn: new Date(),
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
