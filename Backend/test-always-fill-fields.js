/**
 * Test that EVERY coupon gets couponDetails and terms filled,
 * regardless of whether it has a coupon code or not
 */

require('dotenv').config();
const geminiService = require('./src/services/geminiExtractionService');
const logger = require('./src/utils/logger');

// Test cases: with code and without code
const testCases = [
    {
        name: "Coupon WITH code",
        data: {
            couponTitle: "Flat Rs 50 OFF Via HDFC PayZapp Card",
            brandName: "Swiggy",
            couponCode: "SWIGGY50",
            couponDetails: "Blog Subscribe View All Offers",
            terms: "Special Offer!",
            couponLink: "https://www.swiggy.com/",
            category: "Food"
        }
    },
    {
        name: "Coupon WITHOUT code (deal)",
        data: {
            couponTitle: "Get 10% Discount using HDFC Bank Credit Cards",
            brandName: "Swiggy",
            couponCode: "UNLOCKED", // garbage
            couponDetails: "",  // empty
            terms: "", // empty
            couponLink: "https://www.swiggy.com/",
            category: "Food"
        }
    },
    {
        name: "Coupon with poor data",
        data: {
            couponTitle: "Up To 50% OFF",
            brandName: "Amazon",
            couponCode: null,
            couponDetails: "Blog",
            terms: null,
            couponLink: "https://www.amazon.in/",
            category: "Grocery"
        }
    }
];

async function testAllCouponsGetFields() {
    logger.info('=== Testing: ALL Coupons Must Get couponDetails & terms ===\n');

    // Disable Gemini to test fallback (more predictable)
    geminiService.enabled = false;

    let allPassed = true;

    for (const testCase of testCases) {
        console.log(`\n📝 TEST: ${testCase.name}`);
        console.log('─'.repeat(60));
        console.log('Input Title:', testCase.data.couponTitle);
        console.log('Input Code:', testCase.data.couponCode || 'null');
        console.log('Input Details:', testCase.data.couponDetails || 'empty');
        console.log('Input Terms:', testCase.data.terms || 'empty');

        const result = await geminiService.extractCouponData(testCase.data);

        console.log('\n✅ OUTPUT:');
        console.log('Code:', result.couponCode || 'null');
        console.log('Details:', result.couponDetails);
        console.log('Terms:', result.terms);
        console.log('useCouponVia:', result.useCouponVia);

        // Verify
        const hasDetails = result.couponDetails && result.couponDetails.trim().length > 20;
        const hasTerms = result.terms && result.terms.trim().length > 10;
        const detailsNotSameAsTitle = !result.couponDetails?.toLowerCase().includes(testCase.data.couponTitle.toLowerCase().substring(0, 20));

        console.log('\n🔍 VALIDATION:');
        console.log(`  ✓ couponDetails filled? ${hasDetails ? '✅ YES' : '❌ NO'}`);
        console.log(`  ✓ terms filled? ${hasTerms ? '✅ YES' : '❌ NO'}`);
        console.log(`  ✓ details != title? ${detailsNotSameAsTitle ? '✅ YES' : '❌ NO'}`);
        console.log(`  ✓ terms has bullets? ${result.terms?.includes('•') ? '✅ YES' : '❌ NO'}`);

        if (!hasDetails || !hasTerms) {
            console.log('\n❌ FAILED! Missing required fields!');
            allPassed = false;
        } else {
            console.log('\n✅ PASSED!');
        }
    }

    console.log('\n' + '═'.repeat(60));
    if (allPassed) {
        logger.info('✅✅✅ ALL TESTS PASSED! ✅✅✅');
        logger.info('Every coupon will get both couponDetails and terms, regardless of having a code!');
    } else {
        logger.error('❌ SOME TESTS FAILED!');
    }
}

testAllCouponsGetFields();
