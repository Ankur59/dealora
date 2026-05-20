// scratch/count_db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './ai-coupon-engine/.env' });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
    console.log('Connecting to:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const couponCount = await mongoose.connection.db.collection('partnercoupons').countDocuments();
    const partnerMerchantCount = await mongoose.connection.db.collection('partnermerchants').countDocuments();
    const merchantCount = await mongoose.connection.db.collection('merchants').countDocuments();

    console.log('--- Database Stats ---');
    console.log('partnercoupons (Coupon) count:', couponCount);
    console.log('partnermerchants (PartnerMerchant) count:', partnerMerchantCount);
    console.log('merchants (Internal Merchant) count:', merchantCount);

    const first5Coupons = await mongoose.connection.db.collection('partnercoupons').find({}).limit(5).toArray();
    console.log('--- Sample Coupons ---');
    first5Coupons.forEach(c => {
        console.log(`Code: ${c.code}, Brand: ${c.brandName}, Link: ${c.couponVisitingLink || c.trackingLink}`);
    });

    const first5PMerchants = await mongoose.connection.db.collection('partnermerchants').find({}).limit(5).toArray();
    console.log('--- Sample Partner Merchants ---');
    first5PMerchants.forEach(m => {
        console.log(`Name: ${m.merchantName}, Domain: ${m.domain}, Website: ${m.website}`);
    });

    await mongoose.disconnect();
}

run().catch(console.error);
