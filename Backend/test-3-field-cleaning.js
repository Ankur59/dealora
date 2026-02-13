/**
 * Test the new 3-field cleaning approach with Gemini
 */

require('dotenv').config();
const geminiService = require('./src/services/geminiExtractionService');
const logger = require('./src/utils/logger');

// Sample messy scraped data
const testData = {
    couponTitle: "Valentine's💞 Day Gifts : Up To 80% OFF On Gifts",
    brandName: "Box8",
    couponCode: "PARTY15 - CLICK TO COPY CODE ACTIVATED",
    couponDetails: `Valentine's💞 Day Gifts : Up To 80% OFF On Gifts
Valentines Day Offers
Get flat 15% off on party orders.
Minimum order value - Rs 348.
60% OFF
Flat 60% OFF + Up To Rs 100 Cashback on Paytm`,
    terms: `🎉 Special Offer! 🎉
Blog
View All Offers
Subscribe
Contact Us
Follow Us
Terms apply
Offer valid for limited time
Cannot be combined`,
    couponVisitingLink: "https://www.box8.com/party-orders",
    categoryLabel: "Food",
    discountType: "percentage"
};

async function testCleaningService() {
    logger.info('=== Testing Gemini 3-Field Cleaning Service ===');
    
    logger.info('\n📥 INPUT (Messy Data):');
    logger.info(JSON.stringify({
        couponCode: testData.couponCode,
        couponDetails: testData.couponDetails,
        terms: testData.terms
    }, null, 2));

    try {
        const result = await geminiService.extractCouponData(testData);
        
        logger.info('\n✅ OUTPUT (Cleaned Data):');
        logger.info(JSON.stringify({
            couponCode: result.couponCode,
            couponDetails: result.couponDetails,
            terms: result.terms,
            useCouponVia: result.useCouponVia
        }, null, 2));

        logger.info('\n🔍 VALIDATION:');
        logger.info(`✓ Coupon Code: ${result.couponCode || 'null'} (Valid: ${result.couponCode ? 'Yes' : 'No'})`);
        logger.info(`✓ Details Length: ${result.couponDetails?.length || 0} chars`);
        logger.info(`✓ Terms: ${result.terms ? 'Structured bullet points' : 'null'}`);
        logger.info(`✓ Use Coupon Via: ${result.useCouponVia}`);

        // Check that other fields remained unchanged
        logger.info('\n📌 UNTOUCHED FIELDS (Should remain original):');
        logger.info(`✓ Brand Name: ${result.brandName} (Original: ${testData.brandName})`);
        logger.info(`✓ Category: ${result.categoryLabel} (Original: ${testData.categoryLabel})`);
        logger.info(`✓ Discount Type: ${result.discountType} (Original: ${testData.discountType})`);
        
        logger.info('\n✅ Test completed successfully!');

    } catch (error) {
        logger.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testCleaningService();
