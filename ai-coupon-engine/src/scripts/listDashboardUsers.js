import dotenv from "dotenv";
import mongoose from "mongoose";
import DashboardUser from "../models/dashboardUser.model.js";

dotenv.config();

const main = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri?.trim()) {
    console.error("MONGODB_URI is not set. Add it to ai-coupon-engine/.env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const users = await DashboardUser.find({})
    .select("email role isActive lastLoginAt createdAt")
    .sort({ createdAt: 1 })
    .lean();

  console.log(`Connected to MongoDB. Dashboard users: ${users.length}\n`);

  if (users.length === 0) {
    console.log(
      "No users found. Create one with: npm run seed:dashboard-user",
    );
  } else {
    for (const u of users) {
      console.log({
        id: u._id.toString(),
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt ?? null,
        createdAt: u.createdAt ?? null,
      });
    }
  }

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
