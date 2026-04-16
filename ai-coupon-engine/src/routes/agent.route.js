import express from "express";
import { getPendingTasks, submitTaskResult } from "../controllers/agent.controller.js";

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

export default router;
