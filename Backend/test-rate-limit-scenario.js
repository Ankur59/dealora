/**
 * Test fallback cleaner by temporarily disabling Gemini
 */

require('dotenv').config();
const geminiService = require('./src/services/geminiExtractionService');
const logger = require('./src/utils/logger');

// Real messy data from GrabOn scraper
const realScrapedData = {
    "couponTitle": "Free Delivery on Orders Above Rs 199",
    "brandName": "Zomato",
    "couponCode": "FREESHIPPINGUNLOCKED",
    "couponDetails": `Valentine's💞 Day Gifts : Up To 80% OFF On Gifts
Valentines Day Offers
Grab free delivery on your food orders
The minimum order should be Rs 199 & above
No coupon code is required to avail of this offer
Applicable on all restaurants & can be combined with other coupons/offers
60% OFF

Flat 60% OFF + Up To Rs 100 Cashback on Paytm

View All Faasos Offers
Speciality Pages
AI Tools
Surge 2025
Blog
Mobile Apps
Product Deals
Charities
Gift Cards
More…
City Offers
Brand Offers
Bank Offers
Festival Offers`,
    "terms": `Valentine's💞 Day Gifts : Up To 80% OFF On Gifts
Valentines Day Offers
Grab free delivery on your food orders
The minimum order should be Rs 199 & above
No coupon code is required to avail of this offer
Applicable on all restaurants & can be combined with other coupons/offers`,
    "couponVisitingLink": "https://www.zomato.com/",
    "categoryLabel": "Food",
    "discountType": "flat",
    "sourceWebsite": "GrabOn"
};

async function testRateLimitScenario() {
    logger.info('=== Testing Rate Limit Scenario ===\n');
    
    console.log('📥 BEFORE CLEANING:');
    console.log('Code:', realScrapedData.couponCode);
    console.log('Details (first 150 chars):', realScrapedData.couponDetails.substring(0, 150) + '...');
    console.log('Terms (first 150 chars):', realScrapedData.terms.substring(0, 150) + '...');
    console.log('Has emojis:', realScrapedData.couponDetails.includes('💞') ? 'YES' : 'NO');
    console.log('Has "Blog":', realScrapedData.couponDetails.includes('Blog') ? 'YES' : 'NO');
    console.log('');

    try {
        // Temporarily disable Gemini to force fallback
        const originalEnabled = geminiService.enabled;
        geminiService.enabled = false;
        
        const result = await geminiService.extractCouponData(realScrapedData);
        
        // Restore
        geminiService.enabled = originalEnabled;
        
        console.log('✅ AFTER CLEANING (Fallback):');
        console.log('Code:', result.couponCode);
        console.log('Details:', result.couponDetails);
        console.log('Terms:');
        console.log(result.terms);
        console.log('useCouponVia:', result.useCouponVia);
        console.log('');
        
        console.log('🔍 VALIDATION:');
        console.log('✅ "FREESHIPPINGUNLOCKED" rejected?', result.couponCode === null ? 'YES' : 'NO');
        console.log('✅ Emojis removed?', !result.couponDetails?.includes('💞') && !result.terms?.includes('💞') ? 'YES' : 'NO');
        console.log('✅ "Blog" removed?', !result.couponDetails?.includes('Blog') && !result.terms?.includes('Blog') ? 'YES' : 'NO');
        console.log('✅ Terms as bullets?', result.terms?.includes('•') ? 'YES' : 'NO');
        console.log('✅ Shorter than original?', 
            (result.couponDetails?.length || 0) < realScrapedData.couponDetails.length ? 'YES' : 'NO');
        console.log('');
        
        console.log('📊 SIZE REDUCTION:');
        console.log('Details:', realScrapedData.couponDetails.length, '→', result.couponDetails?.length || 0, 'chars');
        console.log('Terms:', realScrapedData.terms.length, '→', result.terms?.length || 0, 'chars');
        
        logger.info('\n✅ Test completed successfully!');

    } catch (error) {
        logger.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testRateLimitScenario();
