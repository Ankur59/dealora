import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import cors from "cors"
import helmet from "helmet"

import partnerRouter from "./routes/partner.route.js"
import couponRouter from "./routes/coupon.route.js"
import authRouter from "./routes/auth.route.js"
import { requireDashboardAuth } from "./middleware/requireDashboardAuth.middleware.js"

dotenv.config()

const app = express()

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1)
}

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
)

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true)
            }
            return callback(null, false)
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
)

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(morgan("dev"))

// Routes
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/partners", requireDashboardAuth, partnerRouter)
app.use("/api/v1/coupons", requireDashboardAuth, couponRouter)

export default app