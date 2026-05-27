import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection("partnercoupons");
    
    const count = await col.countDocuments({});
    console.log("Total partner coupons:", count);

    const categoriesQuery = [
      "healthcare",
      "oral care",
      "sanitizers",
      "medicines and health check-ups",
      "sexual wellness",
      "sports and fitness",
      "fitness equipment",
      "supplements and health drinks",
      "sports"
    ];

    // Query 1: matching categories with offerType: "Coupon"
    const matchedWithCoupon = await col.find({
      categories: { $in: categoriesQuery },
      offerType: "Coupon"
    }).toArray();
    
    console.log(`\nMatched ${matchedWithCoupon.length} coupons with offerType "Coupon":`);
    matchedWithCoupon.forEach(doc => {
      console.log(`- ID: ${doc._id}, Brand: ${doc.brandName}, Categories: ${JSON.stringify(doc.categories)}, Title: ${doc.title || doc.discount}`);
    });

    // Query 2: matching categories with any offerType
    const matchedAny = await col.find({
      categories: { $in: categoriesQuery }
    }).toArray();
    console.log(`\nTotal matched with ANY offerType: ${matchedAny.length}`);
    
    // Group by brand and print count
    const brandCounts = {};
    matchedAny.forEach(doc => {
      brandCounts[doc.brandName] = (brandCounts[doc.brandName] || 0) + 1;
    });
    console.log("Brand counts matching category list:", brandCounts);

  } finally {
    await client.close();
  }
}

run().catch(console.error);
