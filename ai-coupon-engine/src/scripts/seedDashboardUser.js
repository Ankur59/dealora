import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import DashboardUser from "../models/dashboardUser.model.js";

dotenv.config();

const DEFAULT_DEV_EMAIL = "admin@dealora.local";
const DEFAULT_DEV_PASSWORD = "DealoraInternal#2026-Dashboard";

const main = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to ai-coupon-engine/.env");
    process.exit(1);
  }

  const email = (process.env.DASHBOARD_ADMIN_EMAIL || DEFAULT_DEV_EMAIL)
    .toLowerCase()
    .trim();
  const password = process.env.DASHBOARD_ADMIN_PASSWORD || DEFAULT_DEV_PASSWORD;

  if (!process.env.DASHBOARD_ADMIN_PASSWORD) {
    console.warn(
      "DASHBOARD_ADMIN_PASSWORD is not set; using the built-in DEV password from the seed script.",
    );
    console.warn("Set DASHBOARD_ADMIN_PASSWORD in .env before production.");
  }

  await mongoose.connect(uri);
  const rounds = 12;
  const passwordHash = await bcrypt.hash(password, rounds);

  await DashboardUser.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        passwordHash,
        role: "admin",
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log("Dashboard admin user is ready in MongoDB.");
  console.log("  Email:   ", email);
  console.log("  Password:", password);

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
