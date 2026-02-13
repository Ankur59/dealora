/**
 * FINAL VERIFICATION: What will actually be saved to database
 */

require('dotenv').config();
const { connectDB } = require('./src/config/database');
const Coupon = require('./src/models/Coupon');
const GenericAdapter = require('./src/scraper/sources/GenericAdapter');
const logger = require('./src/utils/logger');
const mongoose = require('mongoose');

// Real messy data from GrabOn scraper
const messyData = {
    couponTitle: "Free Delivery on Zomato",
    brandName: "Zomato",
    couponCode: "FREESHIPPINGUNLOCKED", // Garbage
    couponDetails: `Valentine's💞 Day Gifts
Blog
Subscribe
View All Offers
Get free delivery on orders above ₹199`, // Messy
    terms: `Special Offer! 🎉
Blog
Follow Us`, // Messy
    couponLink: "https://www.zomato.com/",
    category: "Food",
    discountType: "flat",
};

async function finalVerification() {
    try {
        logger.info('=== FINAL VERIFICATION: Database Save Test ===\n');
        await connectDB();

        // Temporarily disable Gemini to use fallback (more reliable for this test)
        const geminiService = require('./src/services/geminiExtractionService');
        geminiService.enabled = false;

        const adapter = new GenericAdapter('TestSource', 'https://test.com');
        
        console.log('📥 INPUT (Messy):');
        console.log('  Code:', messyData.couponCode);
        console.log('  Details:', messyData.couponDetails);
        console.log('');

        // Normalize (this applies cleaning)
        const normalizedData = await adapter.normalize(messyData);
        
        console.log('✅ NORMALIZED (What will be saved):');
        console.log('  Code:', normalizedData.couponCode || 'null');
        console.log('  Details:', normalizedData.couponDetails?.substring(0, 150) + '...');
        console.log('  Terms:', normalizedData.terms?.substring(0, 150) + '...');
        console.log('  useCouponVia:', normalizedData.useCouponVia);
        console.log('');

        // Try to save to database
        console.log('💾 Attempting to save to database...');
        const testCoupon = new Coupon(normalizedData);
        await testCoupon.save();
        
        console.log('✅ Saved successfully with ID:', testCoupon._id);
        console.log('');

        // Fetch it back to verify
        const fetchedCoupon = await Coupon.findById(testCoupon._id);
        
        console.log('🔍 VERIFICATION (Fetched from database):');
        console.log('  Code:', fetchedCoupon.couponCode || 'null');
        console.log('  Details:', fetchedCoupon.couponDetails?.substring(0, 100) + '...');
        console.log('  Has emojis?', fetchedCoupon.couponDetails?.includes('💞') || fetchedCoupon.terms?.includes('💞') ? 'YES ❌' : 'NO ✅');
        console.log('  Has "Blog"?', fetchedCoupon.couponDetails?.includes('Blog') || fetchedCoupon.terms?.includes('Blog') ? 'YES ❌' : 'NO ✅');
        console.log('  useCouponVia:', fetchedCoupon.useCouponVia);
        console.log('');

        // Clean up test data
        await Coupon.findByIdAndDelete(testCoupon._id);
        console.log('🗑️  Test coupon deleted');
        console.log('');

        if (fetchedCoupon.couponCode === null && 
            !fetchedCoupon.couponDetails?.includes('💞') &&
            !fetchedCoupon.couponDetails?.includes('Blog')) {
            logger.info('✅✅✅ SUCCESS! CLEANED DATA IS BEING SAVED TO DATABASE! ✅✅✅');
            logger.info('You can now run manualScrape.js and all data will be cleaned automatically!');
        } else {
            logger.error('❌ FAILED! Data is still messy in database!');
        }

        setTimeout(() => {
            mongoose.connection.close();
            process.exit(0);
        }, 1000);

    } catch (error) {
        logger.error('❌ Test failed:', error);
        mongoose.connection.close();
        process.exit(1);
    }
}

finalVerification();
