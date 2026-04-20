import Coupon from "../models/coupon.model.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseLimit = (raw) => {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 20;
  return Math.min(Math.max(n, 1), 50);
};

const parsePage = (raw) => {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

export const listCouponPartners = async (req, res) => {
  try {
    const partners = await Coupon.distinct("partner", {
      partner: { $nin: [null, ""] },
    });
    partners.sort((a, b) => String(a).localeCompare(String(b)));
    res.status(200).json({ success: true, data: { partners } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listCoupons = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const page = parsePage(req.query.page);

    const filter = {};

    const partnerQ =
      typeof req.query.partner === "string" ? req.query.partner.trim() : "";
    if (partnerQ) {
      filter.partner = new RegExp(escapeRegex(partnerQ), "i");
    }

    const ver = req.query.isVerified;
    if (ver === "true") filter.isVerified = true;
    else if (ver === "false") filter.isVerified = false;

    const fromRaw =
      typeof req.query.verifiedFrom === "string"
        ? req.query.verifiedFrom.trim()
        : "";
    const toRaw =
      typeof req.query.verifiedTo === "string"
        ? req.query.verifiedTo.trim()
        : "";

    if (fromRaw || toRaw) {
      filter.verifiedOn = {};
      if (fromRaw) {
        const d = new Date(fromRaw);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid verifiedFrom date",
          });
        }
        filter.verifiedOn.$gte = d;
      }
      if (toRaw) {
        const d = new Date(toRaw);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid verifiedTo date",
          });
        }
        d.setHours(23, 59, 59, 999);
        filter.verifiedOn.$lte = d;
      }
    }

    const skip = page * limit;

    const [items, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ verifiedOn: -1, updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(filter),
    ]);

    const rows = items.map((doc) => ({
      id: doc._id.toString(),
      partner: doc.partner,
      couponId: doc.couponId,
      code: doc.code ?? null,
      description: doc.description ?? null,
      brandName: doc.brandName,
      status: doc.status ?? null,
      type: doc.type ?? null,
      isVerified: Boolean(doc.isVerified),
      verifiedOn: doc.verifiedOn ?? null,
      verifiedAt: doc.verifiedAt ?? null,
      countries: Array.isArray(doc.countries) ? doc.countries : [],
      trackingLink: doc.trackingLink ?? null,
      updatedAt: doc.updatedAt ?? null,
    }));

    res.status(200).json({
      success: true,
      data: {
        items: rows,
        page,
        limit,
        total,
        hasMore: skip + rows.length < total,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCouponOverviewCounts = async (req, res) => {
  try {
    const filter = {};
    const partnerQ =
      typeof req.query.partner === "string" ? req.query.partner.trim() : "";
    if (partnerQ) {
      filter.partner = new RegExp(escapeRegex(partnerQ), "i");
    }

    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const [total, verified] = await Promise.all([
      Coupon.countDocuments(filter),
      Coupon.countDocuments({
        ...filter,
        verifiedAt: { $gte: twelveHoursAgo, $lte: now },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        verified,
        pending: Math.max(total - verified, 0),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCouponProvider = async (req, res) => {
  try {
    const id = req.params.id;
    const partner =
      typeof req.body?.partner === "string" ? req.body.partner.trim() : "";

    if (!id) {
      return res.status(400).json({ success: false, message: "Missing coupon id" });
    }
    if (!partner) {
      return res
        .status(400)
        .json({ success: false, message: "partner is required" });
    }

    const updated = await Coupon.findByIdAndUpdate(
      id,
      { $set: { partner } },
      { new: true, runValidators: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        id: updated._id.toString(),
        partner: updated.partner,
      },
    });
  } catch (error) {
    // Likely duplicate key if partner+couponId uniqueness is violated
    const message =
      error?.code === 11000
        ? "Provider change would create a duplicate (partner + couponId)"
        : error.message;
    res.status(500).json({ success: false, message });
  }
};
