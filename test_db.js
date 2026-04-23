import mongoose from "mongoose";
import coupon from "./ai-coupon-engine/src/models/coupon.model.js";

async function run() {
  await mongoose.connect("mongodb://localhost:27017/dealora"); // Assuming dealora DB or checking index.js for connection string
  const doc = await coupon.findOne({}).lean();
  console.log(JSON.stringify(doc, null, 2));
  process.exit(0);
}
run();
