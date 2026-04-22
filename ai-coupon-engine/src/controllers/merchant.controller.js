import Merchant from "../models/merchant.model.js";
import mongoose from "mongoose";

const resolveStatus = (doc) => {
  if (doc?.status === "active" || doc?.status === "inactive") return doc.status;
  if (doc?.isActive === false) return "inactive";
  return "active";
};

export const createMerchant = async (req, res) => {
  try {
    const merchantName =
      typeof req.body?.merchantName === "string"
        ? req.body.merchantName.trim()
        : "";
    if (!merchantName) {
      return res
        .status(400)
        .json({ success: false, message: "merchantName is required" });
    }
    const status = req.body?.status === "inactive" ? "inactive" : "active";
    const created = await Merchant.create({
      merchantName,
      status,
      isActive: status === "active",
      description:
        typeof req.body?.description === "string" ? req.body.description.trim() : "",
      website: typeof req.body?.website === "string" ? req.body.website.trim() : "",
      notes: typeof req.body?.notes === "string" ? req.body.notes.trim() : "",
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMerchants = async (_req, res) => {
  try {
    const merchants = await Merchant.find({}).sort({ updatedAt: -1, _id: -1 }).lean();
    const merchantNames = merchants
      .map((m) => (typeof m.merchantName === "string" ? m.merchantName.trim() : ""))
      .filter(Boolean);

    const cookieSyncByMerchantName = new Map();
    if (merchantNames.length > 0 && mongoose.connection?.db) {
      const rows = await mongoose.connection.db
        .collection("merchant_cookie")
        .aggregate([
          { $match: { merchantName: { $in: merchantNames } } },
          {
            $group: {
              _id: "$merchantName",
              lastSyncedCookieAt: { $max: "$lastSyncedCookieAt" },
              syncedAt: { $max: "$syncedAt" },
              updatedAt: { $max: "$updatedAt" },
              createdAt: { $max: "$createdAt" },
            },
          },
        ])
        .toArray();

      for (const row of rows) {
        const best =
          row.lastSyncedCookieAt ?? row.syncedAt ?? row.updatedAt ?? row.createdAt ?? null;
        cookieSyncByMerchantName.set(String(row._id), best);
      }
    }

    const enriched = merchants.map((m) => ({
      ...m,
      status: resolveStatus(m),
      isActive: resolveStatus(m) === "active",
      lastSyncedCookieAt:
        cookieSyncByMerchantName.get(String(m.merchantName ?? "")) ?? null,
    }));

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMerchantById = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.params.id);
    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });
    }
    res.status(200).json({ success: true, data: merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMerchant = async (req, res) => {
  try {
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "merchantName")) {
      const name =
        typeof req.body.merchantName === "string" ? req.body.merchantName.trim() : "";
      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "merchantName cannot be empty" });
      }
      updates.merchantName = name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "status")) {
      updates.status = req.body.status === "inactive" ? "inactive" : "active";
      updates.isActive = updates.status === "active";
    } else if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "isActive")) {
      updates.isActive = Boolean(req.body.isActive);
      updates.status = updates.isActive ? "active" : "inactive";
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "description")) {
      updates.description =
        typeof req.body.description === "string" ? req.body.description.trim() : "";
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "website")) {
      updates.website =
        typeof req.body.website === "string" ? req.body.website.trim() : "";
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "notes")) {
      updates.notes =
        typeof req.body.notes === "string" ? req.body.notes.trim() : "";
    }

    const merchant = await Merchant.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });
    }
    res.status(200).json({ success: true, data: merchant });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deactivateMerchant = async (req, res) => {
  try {
    const merchant = await Merchant.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "inactive", isActive: false } },
      { new: true, runValidators: true },
    );
    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Merchant marked inactive", data: merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateMerchant = async (req, res) => {
  try {
    const merchant = await Merchant.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "active", isActive: true } },
      { new: true, runValidators: true },
    );
    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Merchant marked active", data: merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
