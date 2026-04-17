import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../src/db/connectDB.js";
import Merchant from "../src/models/merchant.model.js";

dotenv.config();

const merchantsToSeed = [
    {
        merchantName: "Muscleblaze",
        merchantUrl: "https://www.muscleblaze.com/",
        domain: "muscleblaze.com",
        score: 95,
        isActive: true
    },
    {
        merchantName: "HKVitals",
        merchantUrl: "https://www.hkvitals.com/",
        domain: "hkvitals.com",
        score: 90,
        isActive: true
    }
];

const seedMerchants = async () => {
    try {
        await connectDB();
        
        console.log("Seeding merchants...");
        
        for (const m of merchantsToSeed) {
            await Merchant.findOneAndUpdate(
                { merchantName: m.merchantName },
                m,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`- Upserted ${m.merchantName}`);
        }
        
        console.log("Seeding completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedMerchants();
