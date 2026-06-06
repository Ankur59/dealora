import dotenv from "dotenv";
import mongoose from "mongoose";
import partnerSyncSchedulerService from "../services/partnerSyncScheduler.service.js";

dotenv.config();

const main = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to ai-coupon-engine/.env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  console.log("Executing manual runPartnerSync()...");
  await partnerSyncSchedulerService.runPartnerSync();

  console.log("Disconnecting from MongoDB...");
  await mongoose.disconnect();
  console.log("Disconnected.");
};

main().catch((err) => {
  console.error("Critical test error:", err);
  process.exit(1);
});
