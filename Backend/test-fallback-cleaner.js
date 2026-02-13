/**
 * Test the local fallback cleaner (when Gemini is unavailable/rate-limited)
 */

require('dotenv').config();
const geminiService = require('./src/services/geminiExtractionService');
const logger = require('./src/utils/logger');

// Your exact messy scraped data from the screenshot
const testData = {
    couponTitle: "Valentine's Day Gifts : Up To 80% OFF",
    brandName: "Zomato",
    categoryLabel: "Food",
    useCouponVia: "Coupon Visiting Link",
    discountType: "flat",
    discountValue: "FREE DELIVERY",
    minimumOrder: null,
    couponCode: "FREESHIPPINGUNLOCKED",
    couponVisitingLink: "https://www.zomato.com/",
    couponDetails: `Valentine's💞 Day Gifts : Up To 80% OFF On Gifts
Valentines Day Offers
Grab free delivery on your food orders
The minimum order should be  Rs   199  & above
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
    terms: `Valentine's💞 Day Gifts : Up To 80% OFF On Gifts
Valentines Day Offers
Grab free delivery on your food orders
The minimum order should be  Rs   199  & above
No coupon code is required to avail of this offer
Applicable on all restaurants & can be combined with other coupons/offers
60% OFF 
                
                    Flat 60% OFF + Up To Rs 100 Cashback on Paytm`,
    sourceWebsite: "GrabOn"
};

async function testLocalFallbackCleaner() {
    logger.info('=== Testing Local Fallback Cleaner (No Gemini) ===');
    
    logger.info('\n📥 INPUT (Your Messy Data):');
    logger.info('Coupon Code:', testData.couponCode);
    logger.info('Coupon Details (truncated):', testData.couponDetails.substring(0, 200) + '...');
    logger.info('Terms (truncated):', testData.terms.substring(0, 200) + '...');

    try {
        // Test the local fallback cleaner directly
        const result = geminiService.fallbackFieldCleaner(testData);
        
        logger.info('\n✅ OUTPUT (Cleaned Data):');
        logger.info('Coupon Code:', result.couponCode || 'null');
        logger.info('\nCoupon Details:');
        logger.info(result.couponDetails || 'null');
        logger.info('\nTerms:');
        logger.info(result.terms || 'null');
        logger.info('\nUse Coupon Via:', result.useCouponVia);

        logger.info('\n🔍 VALIDATION:');
        logger.info(`✓ Code cleaned: "${testData.couponCode}" → "${result.couponCode || 'null'}"`);
        logger.info(`✓ Details cleaned: ${testData.couponDetails.length} chars → ${result.couponDetails?.length || 0} chars`);
        logger.info(`✓ Terms cleaned: ${testData.terms.length} chars → ${result.terms?.length || 0} chars`);
        logger.info(`✓ Emojis removed: ${result.couponDetails?.includes('💞') || result.terms?.includes('💞') ? 'NO ❌' : 'YES ✅'}`);
        logger.info(`✓ Navigation text removed: ${result.couponDetails?.includes('Blog') || result.terms?.includes('Blog') ? 'NO ❌' : 'YES ✅'}`);

        // Check that other fields remained unchanged
        logger.info('\n📌 UNTOUCHED FIELDS (Should remain original):');
        logger.info(`✓ Brand Name: ${result.brandName} (Original: ${testData.brandName})`);
        logger.info(`✓ Category: ${result.categoryLabel} (Original: ${testData.categoryLabel})`);
        logger.info(`✓ Discount Type: ${result.discountType} (Original: ${testData.discountType})`);
        logger.info(`✓ Visiting Link: ${result.couponVisitingLink === testData.couponVisitingLink ? 'Unchanged ✅' : 'Changed ❌'}`);
        
        logger.info('\n✅ Test completed successfully!');

    } catch (error) {
        logger.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testLocalFallbackCleaner();
