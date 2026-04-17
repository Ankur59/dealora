/**
 * One-off seed: ingest 8 vcommission coupons into the `partnercoupon` collection.
 * Run: node --env-file=.env scripts/seed-vcommission-coupons.js
 */

import mongoose from "mongoose";
import Coupon from "../src/models/coupon.model.js";
import connectDB from "../src/db/connectDB.js";

const COUPONS = [
  {
    partner: "vcommission",
    couponId: "68e5e87d64a97875ab5bd544",
    campaignId: "10111",
    code: "VCOMHKV",
    description: "Extra 10% off on Min Purchase of ₹1,999",
    end: new Date("2026-10-31T00:00:00.000Z"),
    start: new Date("2025-10-08T00:00:00.000Z"),
    status: "active",
    type: "generic",
    brandName: "HKvitals.com",
    isVerified: false,
    meta: {},
    countries: [],
    categories: [],
  },
  {
    partner: "vcommission",
    couponId: "68e75f887a04de491e0b0eb5",
    campaignId: "10109",
    code: "VCHK5",
    description: "Enjoy 5% OFF + Free Shaker on Biozyme Range (1kg & Above).",
    end: new Date("2026-08-01T00:00:00.000Z"),
    start: new Date("2025-10-09T00:00:00.000Z"),
    status: "active",
    type: "generic",
    brandName: "Healthkart.com",
    isVerified: false,
    meta: {},
    countries: [],
    categories: [],
  },
  {
    partner: "vcommission",
    couponId: "68e516b7a4283f1d204bbdd8",
    campaignId: "10169",
    code: "VCMB",
    description: "Flat Rs 150 off on min purchase of Rs 1999",
    end: new Date("2026-08-01T00:00:00.000Z"),
    start: new Date("2025-10-07T00:00:00.000Z"),
    status: "active",
    type: "generic",
    brandName: "Muscleblaze.com",
    isVerified: false,
    meta: {},
    countries: [],
    categories: [],
  },
  {
    partner: "vcommission",
    couponId: "66696a9128d21a784a5fc216",
    campaignId: "10169",
    code: "SV10VC",
    description: "Get upto 45% off + Additional 10% off",
    end: null,
    start: new Date("2024-06-12T00:00:00.000Z"),
    status: "active",
    type: "generic",
    brandName: "Muscleblaze.com",
    isVerified: false,
    meta: {},
    countries: [],
    categories: [],
  },
  {
    partner: "vcommission",
    couponId: "69b0011cb40a1d31054e937b",
    campaignId: "10803",
    code: "VC20",
    description: "Flat 20% OFF on minimum purchase of ₹3299",
    end: new Date("2026-10-01T00:00:00.000Z"),
    start: new Date("2026-03-10T00:00:00.000Z"),
    status: "active",
    type: "generic",
    brandName: "Snitch.com",
    isVerified: false,
    meta: {},
    countries: [],
    categories: [],
  },
  {
    partner: "vcommission",
    couponId: "69b000f7b442021cf6700c85",
    campaignId: "10803",
    code: "VC625",
    description: "625 OFF on minimum purchase of ₹2599",
    end: new Date("2026-10-01T00:00:00.000Z"),
    start: new Date("2026-03-10T00:00:00.000Z"),
    status: "active",
    type: "generic",
    brandName: "Snitch.com",
    isVerified: false,
    meta: {},
    countries: [],
    categories: [],
  },
  {
    partner: "vcommission",
    couponId: "69b23eeb97bb0577cd2bc399",
    campaignId: "13046",
    code: "VCSAVE10",
    description: "Get 10% on a spend of above 1499",
    end: new Date("2026-05-01T00:00:00.000Z"),
    start: new Date("2026-03-12T00:00:00.000Z"),
    status: "active",
    type: "generic",
    brandName: "Manmatters.com",
    isVerified: false,
    meta: {},
    countries: [],
    categories: [],
  },
  {
    partner: "vcommission",
    couponId: "69b23ec61079cc5e171b87f6",
    campaignId: "13046",
    code: "VCSAVE5",
    description: "Get 5% on a spend of above 491",
    end: new Date("2026-05-01T00:00:00.000Z"),
    start: new Date("2026-03-12T00:00:00.000Z"),
    status: "active",
    type: "generic",
    brandName: "Manmatters.com",
    isVerified: false,
    meta: {},
    countries: [],
    categories: [],
  },
];

async function main() {
  await connectDB();

  const ops = COUPONS.map((c) => ({
    updateOne: {
      filter: { partner: c.partner, couponId: c.couponId },
      update: { $set: c },
      upsert: true,
    },
  }));

  const result = await Coupon.bulkWrite(ops, { ordered: false });

  console.log("\n✅ Seed complete (partnercoupon collection):");
  console.log(`   Inserted : ${result.upsertedCount}`);
  console.log(`   Modified : ${result.modifiedCount}`);
  console.log(`   Matched  : ${result.matchedCount}`);

  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
