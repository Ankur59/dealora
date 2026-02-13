/**
 * END-TO-END TEST: Verify complete flow with database
 */

require('dotenv').config();
const { connectDB } = require('./src/config/database');
const Coupon = require('./src/models/Coupon');
const GenericAdapter = require('./src/scraper/sources/GenericAdapter');
const logger = require('./src/utils/logger');
const mongoose = require('mongoose');

// Test both scenarios: with code and without code
const testCoupons = [
    {
        name: "WITH CODE",
        data: {
            couponTitle: "Flat Rs 50 OFF Via HDFC PayZapp Card",
            brandName: "Swiggy",
            couponCode: "SWIGGY50",
            couponDetails: "Blog Subscribe View All Offers 🎉",
            terms: "Special Offer! Blog",
            couponLink: "https://www.swiggy.com/",
            category: "Food"
        }
    },
    {
        name: "WITHOUT CODE (Deal)",
        data: {
            couponTitle: "Get 10% Discount using HDFC Bank Credit Cards",
            brandName: "Swiggy",
            couponCode: "UNLOCKED",
            couponDetails: "",
            terms: "",
            couponLink: "https://www.swiggy.com/",
            category: "Food"
        }
    }
];

async function testEndToEnd() {
    try {
        logger.info('=== END-TO-END TEST: Scraper → Cleaning → Database ===\n');
        await connectDB();

        // Disable Gemini for consistent testing
        const geminiService = require('./src/services/geminiExtractionService');
        geminiService.enabled = false;

        const adapter = new GenericAdapter('TestSource', 'https://test.com');
        const savedIds = [];

        for (const testCase of testCoupons) {
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`📝 TEST: ${testCase.name}`);
            console.log(`${'─'.repeat(60)}`);
            
            // Normalize
            const normalized = await adapter.normalize(testCase.data);
            
            console.log('\n✅ NORMALIZED DATA:');
            console.log('  Code:', normalized.couponCode || 'null');
            console.log('  Details:', normalized.couponDetails?.substring(0, 80) + '...');
            console.log('  Terms:', normalized.terms?.split('\n')[0] + '...');
            console.log('  useCouponVia:', normalized.useCouponVia);
            
            // Save to database
            const coupon = new Coupon(normalized);
            await coupon.save();
            savedIds.push(coupon._id);
            
            console.log('\n💾 SAVED TO DATABASE:', coupon._id);
            
            // Fetch back
            const fetched = await Coupon.findById(coupon._id);
            
            console.log('\n🔍 VERIFICATION FROM DB:');
            const hasDetails = fetched.couponDetails && fetched.couponDetails.length > 20;
            const hasTerms = fetched.terms && fetched.terms.length > 10;
            const noEmojis = !fetched.couponDetails?.includes('🎉') && !fetched.terms?.includes('🎉');
            const noBlog = !fetched.couponDetails?.includes('Blog') && !fetched.terms?.includes('Blog');
            
            console.log(`  ✓ couponDetails filled? ${hasDetails ? '✅' : '❌'}`);
            console.log(`  ✓ terms filled? ${hasTerms ? '✅' : '❌'}`);
            console.log(`  ✓ No emojis? ${noEmojis ? '✅' : '❌'}`);
            console.log(`  ✓ No "Blog"? ${noBlog ? '✅' : '❌'}`);
            console.log(`  ✓ useCouponVia correct? ${fetched.useCouponVia !== 'None' ? '✅' : '❌'}`);
            
            if (!hasDetails || !hasTerms || !noEmojis || !noBlog) {
                throw new Error('Verification failed!');
            }
        }

        // Cleanup
        console.log(`\n\n🗑️  Cleaning up test data...`);
        for (const id of savedIds) {
            await Coupon.findByIdAndDelete(id);
        }
        
        console.log('\n' + '═'.repeat(60));
        logger.info('✅✅✅ END-TO-END TEST PASSED! ✅✅✅');
        logger.info('System is ready for production scraping!');
        logger.info('Run: node manualScrape.js');
        console.log('═'.repeat(60));

        setTimeout(() => {
            mongoose.connection.close();
            process.exit(0);
        }, 1000);

    } catch (error) {
        logger.error('❌ Test failed:', error.message);
        mongoose.connection.close();
        process.exit(1);
    }
}

testEndToEnd();
