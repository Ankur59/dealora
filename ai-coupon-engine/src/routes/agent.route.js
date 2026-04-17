import express from "express";
import { getPendingTasks, submitTaskResult } from "../controllers/agent.controller.js";
import { getAutomationMap, upsertAutomationMap, getMerchantCredentials } from "../controllers/agentAutomation.controller.js";

const router = express.Router();

/**
 * @route   GET /api/v1/agent/pending-tasks
 * @desc    Fetch pending coupons that need verification by the AI Agent extension
 * @access  Internal (called by extension)
 */
router.get("/pending-tasks", getPendingTasks);

/**
 * @route   POST /api/v1/agent/tasks/:taskId/result
 * @desc    Submit the verification result back from the AI Agent extension
 * @access  Internal (called by extension)
 */
router.post("/tasks/:taskId/result", submitTaskResult);

/**
 * @route   GET /api/v1/agent/automation-map/:domain/:type
 * @desc    Fetch deterministic automation steps for a site
 */
router.get("/automation-map/:domain/:type", getAutomationMap);

/**
 * @route   POST /api/v1/agent/automation-map
 * @desc    Save step map for a site to be reused
 */
router.post("/automation-map", upsertAutomationMap);

/**
 * @route   GET /api/v1/agent/credentials/:domain
 * @desc    Fetch site credentials (for injecting tags)
 */
router.get("/credentials/:domain", getMerchantCredentials);

export default router;
