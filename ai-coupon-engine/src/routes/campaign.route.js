import express from "express";
import {
    createCampaign,
    getCampaigns,
    updateCampaign,
    deleteCampaign
} from "../controllers/campaign.controller.js";

const router = express.Router();

/**
 * @route   GET /api/v1/campaigns
 * @desc    Get campaigns (optionally filtered by ?partner=vcommission)
 * @access  Internal/Admin
 */
router.get("/", getCampaigns);

/**
 * @route   POST /api/v1/campaigns
 * @desc    Create a new manual campaign
 * @access  Internal/Admin
 */
router.post("/", createCampaign);

/**
 * @route   PUT /api/v1/campaigns/:id
 * @desc    Update a campaign (e.g. adding domain and loginUrl from extension)
 * @access  Internal/Admin
 */
router.put("/:id", updateCampaign);

/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete a campaign
 * @access  Internal/Admin
 */
router.delete("/:id", deleteCampaign);

export default router;
