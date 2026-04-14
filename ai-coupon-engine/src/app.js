import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import cors from "cors"

import partnerRouter from "./routes/partner.route.js"
import validatorRouter from "./routes/validator.route.js"

dotenv.config()

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}))

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(morgan("dev"))

// Routes
app.use("/api/v1/partners", partnerRouter)
app.use("/api/v1/validator", validatorRouter)

export default app