import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import cors from "cors"

import partnerRouter from "./routes/partner.route.js"
import merchantCookieRouter from "./routes/merchantCookie.route.js"

dotenv.config()

const app = express()

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (Postman, curl) and chrome-extension origins
        if (!origin || origin.startsWith("chrome-extension://")) {
            return callback(null, true);
        }
        // Also allow the configured CORS_ORIGIN
        const allowed = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : [];
        if (allowed.includes(origin) || allowed.includes("*")) {
            return callback(null, true);
        }
        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Extension-Key"],
}))

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(morgan("dev"))

// Routes
app.use("/api/v1/partners", partnerRouter)
app.use("/api/v1/merchant-cookies", merchantCookieRouter)

export default app