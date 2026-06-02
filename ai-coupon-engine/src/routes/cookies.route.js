import express from "express";
import mongoose from "mongoose";
import Merchant from "../models/merchant.model.js";
import PartnerMerchant from "../models/partnerMerchant.model.js";
import { requireDashboardAuth } from "../middleware/requireDashboardAuth.middleware.js";
import browserService from "../services/browser.service.js";

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET all merchant cookies statuses
router.get("/", requireDashboardAuth, async (req, res) => {
  try {
    const merchants = await Merchant.find({});
    const data = merchants.map((m) => {
      const url = m.merchantUrl || (m.domain ? `https://${m.domain}/` : "");
      let cookiesCount = 0;
      if (m.cookies) {
        cookiesCount = Array.isArray(m.cookies) ? m.cookies.length : 1;
      }
      return {
        providerName: m.merchantName,
        merchantUrl: url,
        cookiesCount,
        syncedAt: m.updatedAt || new Date(),
      };
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST cookie sync from extension
router.post("/", requireDashboardAuth, async (req, res) => {
  try {
    const { providerName, merchantUrl, cookies } = req.body;
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ success: false, message: "cookies array is required" });
    }

    let domain = "";
    try {
      if (merchantUrl) {
        domain = new URL(merchantUrl).hostname.replace(/^www\./, "");
      }
    } catch (e) {}

    if (!domain && providerName) {
      domain = providerName.toLowerCase().replace(/^www\./, "");
    }

    if (!domain) {
      return res.status(400).json({ success: false, message: "Could not determine domain" });
    }

    const merchant = await Merchant.findOne({
      $or: [
        { domain: new RegExp(escapeRegex(domain), "i") },
        { merchantName: new RegExp(escapeRegex(providerName || ""), "i") },
      ],
    });

    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found for domain: " + domain });
    }

    merchant.cookies = cookies;
    merchant.lastLoginAttempt = {
      status: "success",
      message: "Cookies synced from extension",
      lastAttempted: new Date(),
    };
    await merchant.save();

    // Also sync to PartnerMerchant if exists
    const pm = await PartnerMerchant.findOne({
      merchantName: new RegExp(escapeRegex(merchant.merchantName), "i"),
    });
    if (pm) {
      pm.cookies = cookies;
      await pm.save();
    }

    res.status(200).json({ success: true, data: { message: "Cookies synced successfully", cookiesCount: cookies.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE cookies for a specific merchant by ID
router.delete("/:id", requireDashboardAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid merchant id" });
    }
    const merchant = await Merchant.findById(id);
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    // Close any active browser session
    try {
      await browserService.closeSession(id);
    } catch (e) {
      console.error("[clearCookies] Failed to close session (non-fatal):", e.message);
    }

    merchant.cookies = [];
    merchant.lastLoginAttempt = {
      status: "idle",
      message: "Cookies cleared by user",
      lastAttempted: new Date(),
    };
    await merchant.save();

    // Also clear PartnerMerchant cookies
    const pm = await PartnerMerchant.findOne({
      merchantName: new RegExp(escapeRegex(merchant.merchantName), "i"),
    });
    if (pm) {
      pm.cookies = null;
      await pm.save();
    }

    res.status(200).json({ success: true, data: { message: "Cookies cleared successfully" } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
