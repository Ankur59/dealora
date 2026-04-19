import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import DashboardUser from "../models/dashboardUser.model.js";
import AuthEvent from "../models/authEvent.model.js";
import {
  DASHBOARD_ACCESS_COOKIE,
} from "../middleware/requireDashboardAuth.middleware.js";

const getJwtSecret = () => {
  const secret = process.env.DASHBOARD_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("DASHBOARD_JWT_SECRET must be set and at least 32 characters");
  }
  return secret;
};

const accessTokenTtlSeconds = () => {
  const raw = process.env.DASHBOARD_ACCESS_TTL_SECONDS;
  const n = raw ? Number.parseInt(raw, 10) : 60 * 60 * 8;
  if (!Number.isFinite(n) || n < 300 || n > 60 * 60 * 24 * 7) {
    return 60 * 60 * 8;
  }
  return n;
};

const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "")
    .toString()
    .split(",")[0]
    .trim() ||
  req.socket?.remoteAddress ||
  "";

const signAccessToken = (user) =>
  jwt.sign(
    {
      typ: "dashboard_access",
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: accessTokenTtlSeconds() },
  );

const setAccessCookie = (res, token) => {
  const maxAgeMs = accessTokenTtlSeconds() * 1000;
  const secure = process.env.NODE_ENV === "production";
  res.cookie(DASHBOARD_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  });
};

const clearAccessCookie = (res) => {
  const secure = process.env.NODE_ENV === "production";
  res.clearCookie(DASHBOARD_ACCESS_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
};

export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        errors: errors.array({ onlyFirstError: true }),
      });
    }

    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const ip = clientIp(req);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 512);

    const user = await DashboardUser.findOne({ email }).select("+passwordHash");
    const valid =
      user &&
      user.isActive &&
      (await bcrypt.compare(password, user.passwordHash));

    if (!valid) {
      await AuthEvent.create({
        email,
        type: "login_failure",
        ip,
        userAgent,
        userId: user?._id,
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    await AuthEvent.create({
      userId: user._id,
      email: user.email,
      type: "login_success",
      ip,
      userAgent,
    });

    const token = signAccessToken(user);
    setAccessCookie(res, token);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
        expiresInSeconds: accessTokenTtlSeconds(),
      },
    });
  } catch (err) {
    console.error("login error:", err.message);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const logout = async (req, res) => {
  try {
    const ip = clientIp(req);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 512);
    if (req.dashboardUser?.id) {
      await AuthEvent.create({
        userId: req.dashboardUser.id,
        email: req.dashboardUser.email,
        type: "logout",
        ip,
        userAgent,
      });
    }
    clearAccessCookie(res);
    return res.status(200).json({ success: true, data: { ok: true } });
  } catch (err) {
    console.error("logout error:", err.message);
    clearAccessCookie(res);
    return res.status(200).json({ success: true, data: { ok: true } });
  }
};

export const me = async (req, res) => {
  try {
    const user = await DashboardUser.findById(req.dashboardUser.id).lean();
    if (!user || !user.isActive) {
      clearAccessCookie(res);
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          lastLoginAt: user.lastLoginAt,
        },
      },
    });
  } catch (err) {
    console.error("me error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load user" });
  }
};
