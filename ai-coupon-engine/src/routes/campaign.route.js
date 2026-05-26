import express from "express";
import Campaign from "../models/campaign.model.js";
import { requireDashboardAuth } from "../middleware/requireDashboardAuth.middleware.js";

const router = express.Router();

// GET all campaigns
router.get("/", requireDashboardAuth, async (req, res) => {
  try {
    const campaigns = await Campaign.find({});
    res.status(200).json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST a new campaign
router.post("/", requireDashboardAuth, async (req, res) => {
  try {
    const { partner, title, domain, loginUrl, trackingLink } = req.body;
    if (!partner || !title) {
      return res.status(400).json({ success: false, message: "partner and title are required" });
    }

    const newCampaign = new Campaign({
      partner,
      title,
      campaignId: Date.now(),
      domain: domain || "",
      loginUrl: loginUrl || "",
      trackingLink: trackingLink || loginUrl || "",
    });

    await newCampaign.save();
    res.status(201).json({ success: true, campaign: newCampaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE a campaign
router.delete("/:id", requireDashboardAuth, async (req, res) => {
  try {
    const deleted = await Campaign.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }
    res.status(200).json({ success: true, message: "Campaign deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
