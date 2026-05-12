import jwt from "jsonwebtoken";

export const DASHBOARD_ACCESS_COOKIE = "dealora_dashboard_access";

const getJwtSecret = () => {
  const secret = process.env.DASHBOARD_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("DASHBOARD_JWT_SECRET must be set and at least 32 characters");
  }
  return secret;
};

export const requireDashboardAuth = (req, res, next) => {
  try {
    let token = req.cookies?.[DASHBOARD_ACCESS_COOKIE];
    const authHeader = req.headers.authorization;
    if (!token && authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const payload = jwt.verify(token, getJwtSecret());
    if (payload.typ !== "dashboard_access") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.dashboardUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};
