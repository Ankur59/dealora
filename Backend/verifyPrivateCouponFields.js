require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/database');
const PrivateCoupon = require('./src/models/PrivateCoupon');

async function verifyNewFields() {
    try {
        console.log('\n🔍 Verifying New Fields in Private Coupons\n');
        console.log('='.repeat(70));
        
        await connectDB();
        console.log('✅ Connected to database\n');
        
        // Get a few sample coupons to show the new fields
        const samples = await PrivateCoupon.find({
            couponDetails: { $ne: null },
            terms: { $ne: null }
        }).limit(3);
        
        console.log(`📊 Found ${samples.length} coupons with new fields\n`);
        
        samples.forEach((coupon, index) => {
            console.log(`${index + 1}. ${coupon.brandName} - ${coupon.couponTitle}`);
            console.log(`   Code: ${coupon.couponCode}`);
            console.log(`   \n   📝 Coupon Details:`);
            console.log(`   ${coupon.couponDetails?.substring(0, 100)}...`);
            console.log(`   \n   📋 Terms:`);
            const termsLines = coupon.terms?.split('\n').slice(0, 3) || [];
            termsLines.forEach(line => console.log(`   ${line}`));
            console.log('');
        });
        
        // Count total with new fields
        const totalWithNewFields = await PrivateCoupon.countDocuments({
            couponDetails: { $ne: null },
            terms: { $ne: null }
        });
        
        const totalCoupons = await PrivateCoupon.countDocuments();
        
        console.log('='.repeat(70));
        console.log('\n✅ VERIFICATION COMPLETE\n');
        console.log(`Total Private Coupons: ${totalCoupons}`);
        console.log(`Coupons with couponDetails: ${totalWithNewFields}`);
        console.log(`Coupons with terms: ${totalWithNewFields}`);
        console.log(`Coverage: ${((totalWithNewFields / totalCoupons) * 100).toFixed(1)}%`);
        console.log('\n' + '='.repeat(70));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyNewFields();
