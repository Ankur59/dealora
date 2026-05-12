require('dotenv').config();
const geminiExtractionService = require('./src/services/geminiExtractionService');
const logger = require('./src/utils/logger');

// Test data simulating scraped coupons
const testCoupons = [
    {
        brandName: 'Zomato',
        couponTitle: 'Flat 40% OFF on Food Orders',
        couponCode: 'ZOMFOOD40',
        couponDetails: 'Limited time offer! Get discount on food orders. Min order ₹249. Use code: ZOMFOOD40',
        terms: 'Offer valid for new users. Min order applies. T&C apply.',
        discountType: 'percentage',
        discountValue: 40
    },
    {
        brandName: 'Zomato',
        couponTitle: 'Get ₹100 OFF on First Order',
        couponCode: 'FIRST100',
        couponDetails: '🎉 Amazing offer! First order special 💰 Get discount Blog Subscribe',
        terms: 'New users only! Limited time! View All Terms 🎁',
        discountType: 'flat',
        discountValue: 100
    },
    {
        brandName: 'Myntra',
        couponTitle: 'Extra 30% OFF on Fashion',
        couponCode: 'MYNTRA30',
        couponDetails: 'Fashion sale! Get extra discount on clothing Blog Click Here',
        terms: 'Site-wide offer Blog Subscribe View All',
        discountType: 'percentage',
        discountValue: 30
    }
];

async function testGeminiExtraction() {
    console.log('🧪 Testing Gemini Extraction Service\n');
    console.log('=' .repeat(60));
    
    const results = [];
    
    for (let i = 0; i < testCoupons.length; i++) {
        const rawCoupon = testCoupons[i];
        
        console.log(`\n📝 Test ${i + 1}: ${rawCoupon.brandName} - ${rawCoupon.couponTitle}`);
        console.log('-'.repeat(60));
        
        console.log('\nRAW DATA:');
        console.log('  Code:', rawCoupon.couponCode);
        console.log('  Details:', rawCoupon.couponDetails);
        console.log('  Terms:', rawCoupon.terms);
        
        try {
            // Extract with Gemini
            const extracted = await geminiExtractionService.extractCouponData(rawCoupon);
            
            console.log('\n✅ EXTRACTED DATA:');
            console.log('  Code:', extracted.couponCode || 'null');
            console.log('  Details:', extracted.couponDetails || 'null');
            console.log('  Details Length:', extracted.couponDetails?.length || 0);
            console.log('  Terms:', extracted.terms || 'null');
            console.log('  Terms Lines:', extracted.terms?.split('\n').length || 0);
            
            // Validate extraction
            const validations = {
                hasCode: extracted.couponCode !== null && extracted.couponCode !== undefined,
                hasDetails: extracted.couponDetails && extracted.couponDetails.length >= 20,
                hasTerms: extracted.terms && extracted.terms.includes('•'),
                detailsDifferentFromTitle: !extracted.couponDetails?.toLowerCase().includes(rawCoupon.couponTitle.toLowerCase().substring(0, 20)),
                noEmojis: !extracted.couponDetails?.match(/[\u{1F300}-\u{1F9FF}]/u) && !extracted.terms?.match(/[\u{1F300}-\u{1F9FF}]/u),
                noNavText: !extracted.couponDetails?.toLowerCase().includes('blog') && !extracted.terms?.toLowerCase().includes('blog')
            };
            
            console.log('\n🔍 VALIDATION:');
            Object.entries(validations).forEach(([check, passed]) => {
                console.log(`  ${passed ? '✅' : '❌'} ${check}: ${passed}`);
            });
            
            results.push({
                coupon: rawCoupon.couponTitle,
                extracted,
                validations,
                passed: Object.values(validations).every(v => v)
            });
            
        } catch (error) {
            console.error('\n❌ ERROR:', error.message);
            results.push({
                coupon: rawCoupon.couponTitle,
                error: error.message,
                passed: false
            });
        }
        
        // Small delay between requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY\n');
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    // Check for duplicate terms/details
    console.log('\n🔍 UNIQUENESS CHECK\n');
    
    const details = results.filter(r => r.extracted).map(r => r.extracted.couponDetails);
    const terms = results.filter(r => r.extracted).map(r => r.extracted.terms);
    
    const uniqueDetails = new Set(details);
    const uniqueTerms = new Set(terms);
    
    console.log(`Unique couponDetails: ${uniqueDetails.size} / ${details.length}`);
    console.log(`Unique terms: ${uniqueTerms.size} / ${terms.length}`);
    
    if (uniqueDetails.size === details.length && uniqueTerms.size === terms.length) {
        console.log('✅ All content is unique!');
    } else {
        console.log('⚠️ Some duplicate content detected');
        
        // Show duplicates
        const detailCounts = {};
        details.forEach(d => {
            detailCounts[d] = (detailCounts[d] || 0) + 1;
        });
        
        Object.entries(detailCounts).forEach(([detail, count]) => {
            if (count > 1) {
                console.log(`  Duplicate detail (${count}x):`, detail.substring(0, 50) + '...');
            }
        });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(passed === total ? '\n✅ ALL TESTS PASSED!\n' : '\n⚠️ SOME TESTS FAILED\n');
    
    return passed === total;
}

// Run the test
testGeminiExtraction().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
});
