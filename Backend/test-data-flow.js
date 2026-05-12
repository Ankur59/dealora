/**
 * Test that cleaned data flows correctly from scraper -> Gemini/fallback -> database
 */

require('dotenv').config();
const GenericAdapter = require('./src/scraper/sources/GenericAdapter');
const logger = require('./src/utils/logger');

// Simulate messy scraped data (like what GrabOn scraper sends)
const messyScrapedData = {
    couponTitle: "Free Delivery on Orders Above Rs 199",
    couponName: "Free Delivery",
    brandName: "Zomato",
    category: "Food",
    couponCode: "FREESHIPPINGUNLOCKED", // Garbage code
    couponDetails: `Valentine's💞 Day Gifts : Up To 80% OFF On Gifts
Valentines Day Offers
Grab free delivery on your food orders
The minimum order should be Rs 199 & above
No coupon code is required to avail of this offer
Applicable on all restaurants & can be combined with other coupons/offers

Blog
Subscribe
View All Faasos Offers
City Offers
Brand Offers`, // Messy with emojis and navigation text
    terms: `Valentine's💞 Day Gifts
Blog
Contact Us
Follow Us
Terms apply
Special Offer!`, // Messy terms
    couponLink: "https://www.zomato.com/",
    discountType: "flat",
};

async function testDataFlow() {
    logger.info('=== Testing Data Flow: Scraper → Gemini/Fallback → Database ===\n');

    try {
        // Create a generic adapter instance
        const adapter = new GenericAdapter('TestSource', 'https://test.com');

        console.log('📥 INPUT (Messy scraped data):');
        console.log('  Code:', messyScrapedData.couponCode);
        console.log('  Details (first 100 chars):', messyScrapedData.couponDetails.substring(0, 100) + '...');
        console.log('  Terms (first 80 chars):', messyScrapedData.terms.substring(0, 80) + '...');
        console.log('  Has emojis:', messyScrapedData.couponDetails.includes('💞') ? 'YES ❌' : 'NO');
        console.log('  Has "Blog":', messyScrapedData.couponDetails.includes('Blog') ? 'YES ❌' : 'NO');
        console.log('');

        // Run through the normalize method (this calls Gemini/fallback)
        console.log('⚙️  Processing through normalize() method...\n');
        const normalizedData = await adapter.normalize(messyScrapedData);

        console.log('✅ OUTPUT (What will be saved to database):');
        console.log('  Code:', normalizedData.couponCode);
        console.log('  Details:', normalizedData.couponDetails);
        console.log('  Terms:');
        console.log(normalizedData.terms);
        console.log('  useCouponVia:', normalizedData.useCouponVia);
        console.log('');

        console.log('🔍 VERIFICATION:');
        console.log('  ✅ Garbage code rejected?', normalizedData.couponCode === null ? 'YES' : 'NO');
        console.log('  ✅ Emojis removed?', 
            !normalizedData.couponDetails?.includes('💞') && !normalizedData.terms?.includes('💞') ? 'YES' : 'NO');
        console.log('  ✅ "Blog" removed?', 
            !normalizedData.couponDetails?.includes('Blog') && !normalizedData.terms?.includes('Blog') ? 'YES' : 'NO');
        console.log('  ✅ Terms structured?', normalizedData.terms?.includes('•') ? 'YES' : 'NO');
        console.log('  ✅ useCouponVia correct?', normalizedData.useCouponVia === 'Coupon Visiting Link' ? 'YES (Link only)' : 'NO');
        console.log('');

        console.log('📋 OTHER FIELDS (Should be preserved):');
        console.log('  Brand:', normalizedData.brandName);
        console.log('  Category:', normalizedData.categoryLabel);
        console.log('  Link:', normalizedData.couponVisitingLink);
        console.log('  Source:', normalizedData.sourceWebsite);
        console.log('');

        if (normalizedData.couponCode === null && 
            !normalizedData.couponDetails?.includes('💞') &&
            !normalizedData.couponDetails?.includes('Blog') &&
            normalizedData.terms?.includes('•')) {
            logger.info('✅ SUCCESS! Cleaned data will be saved to database correctly!');
        } else {
            logger.error('❌ FAILED! Data is still messy!');
        }

    } catch (error) {
        logger.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testDataFlow();
