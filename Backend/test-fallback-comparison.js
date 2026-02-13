/**
 * Test fallback cleaner with the same data to compare results
 */

require('dotenv').config();
const geminiService = require('./src/services/geminiExtractionService');
const logger = require('./src/utils/logger');

// Same messy data
const messyScrapedData = {
    couponTitle: "Free Delivery on Orders Above Rs 199",
    couponName: "Free Delivery",
    brandName: "Zomato",
    category: "Food",
    couponCode: "FREESHIPPINGUNLOCKED",
    couponDetails: `Valentine's💞 Day Gifts : Up To 80% OFF On Gifts
Valentines Day Offers
Grab free delivery on your food orders
The minimum order should be Rs 199 & above
No coupon code is required to avail of this offer
Applicable on all restaurants & can be combined with other coupons/offers

Blog
Subscribe
View All Faasos Offers`,
    terms: `Valentine's💞 Day Gifts
Blog
Contact Us
Follow Us
Terms apply
Special Offer!`,
    couponLink: "https://www.zomato.com/",
    discountType: "flat",
};

async function testFallbackOnly() {
    logger.info('=== Testing Fallback Cleaner Only ===\n');

    console.log('📥 INPUT:');
    console.log('  Code:', messyScrapedData.couponCode);
    console.log('  Details (first 100 chars):', messyScrapedData.couponDetails.substring(0, 100) + '...');
    console.log('');

    // Disable Gemini to force fallback
    geminiService.enabled = false;
    
    const result = await geminiService.extractCouponData(messyScrapedData);
    
    console.log('✅ OUTPUT (Fallback cleaned):');
    console.log('  Code:', result.couponCode || 'null');
    console.log('  Details:', result.couponDetails);
    console.log('  Terms:');
    console.log(result.terms);
    console.log('  useCouponVia:', result.useCouponVia);
    console.log('');
    
    console.log('🔍 VERIFICATION:');
    console.log('  ✅ "FREESHIPPINGUNLOCKED" rejected?', result.couponCode === null ? 'YES ✅' : 'NO ❌');
    console.log('  ✅ Emojis removed?', !result.couponDetails?.includes('💞') ? 'YES ✅' : 'NO ❌');
    console.log('  ✅ "Blog" removed?', !result.couponDetails?.includes('Blog') ? 'YES ✅' : 'NO ❌');
    console.log('  ✅ Terms structured?', result.terms?.includes('•') ? 'YES ✅' : 'NO ❌');
    console.log('  ✅ Brand unchanged?', result.brandName === 'Zomato' ? 'YES ✅' : 'NO ❌');
    console.log('');
    
    console.log('📊 COMPARISON:');
    console.log('  Gemini result: PARTY15 (hallucination) + Box8 details (wrong brand)');
    console.log('  Fallback result:', result.couponCode || 'null', '+ Zomato preserved ✅');
}

testFallbackOnly();
