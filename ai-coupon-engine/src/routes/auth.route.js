import express from "express";
import { body } from "express-validator";
import { login, logout, me } from "../controllers/auth.controller.js";
import { loginRateLimiter } from "../middleware/loginRateLimiter.middleware.js";
import { requireDashboardAuth } from "../middleware/requireDashboardAuth.middleware.js";

const router = express.Router();

const loginValidators = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email")
    .normalizeEmail(),
  body("password")
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be 8–128 characters"),
];

router.post("/login", loginRateLimiter, ...loginValidators, login);
router.post("/logout", requireDashboardAuth, logout);
router.get("/me", requireDashboardAuth, me);

export default router;
