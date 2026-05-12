require('dotenv').config();
const mongoose = require('mongoose');
const geminiExtractionService = require('./src/services/geminiExtractionService');
const ScraperEngine = require('./src/scraper/engine');
const Coupon = require('./src/models/Coupon');
const logger = require('./src/utils/logger');

// Test coupons
const testCoupons = [
    {
        brandName: 'TestBrand',
        couponTitle: 'Flat 50% OFF on All Products',
        couponCode: 'TEST50',
        couponDetails: 'Get amazing discount Blog Subscribe',
        terms: 'Limited offer View All',
        discountType: 'percentage',
        discountValue: 50,
        expireBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        category: 'Fashion',
        couponLink: 'https://example.com'
    },
    {
        brandName: 'TestBrand',
        couponTitle: 'Extra 30% OFF on Fashion Items',
        couponCode: 'FASHION30',
        couponDetails: 'Amazing fashion sale 🎉 Blog',
        terms: 'Site-wide offer Blog',
        discountType: 'percentage',
        discountValue: 30,
        expireBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        category: 'Fashion',
        couponLink: 'https://example.com'
    }
];

async function testFullPipeline() {
    console.log('\n🧪 Testing Full Scraping Pipeline with Deduplication\n');
    console.log('='.repeat(70));
    
    try {
        // Connect to database
        console.log('\n📦 Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database');
        
        // Clean up test data
        console.log('\n🧹 Cleaning up existing test data...');
        await Coupon.deleteMany({ brandName: 'TestBrand' });
        console.log('✅ Test data cleaned');
        
        // Create scraper engine
        const engine = new ScraperEngine([]);
        
        console.log('\n' + '='.repeat(70));
        console.log('Testing Coupon Processing with Gemini Extraction');
        console.log('='.repeat(70));
        
        const results = [];
        
        for (let i = 0; i < testCoupons.length; i++) {
            const rawCoupon = testCoupons[i];
            
            console.log(`\n📝 Processing Coupon ${i + 1}: ${rawCoupon.couponTitle}`);
            console.log('-'.repeat(70));
            
            // Step 1: Extract with Gemini
            console.log('\n🤖 Step 1: Gemini Extraction');
            const extracted = await geminiExtractionService.extractCouponData(rawCoupon);
            
            console.log('  ✅ Code:', extracted.couponCode || 'null');
            console.log('  ✅ Details:', extracted.couponDetails?.substring(0, 60) + '...');
            console.log('  ✅ Terms (lines):', extracted.terms?.split('\n').length || 0);
            
            // Step 2: Normalize
            console.log('\n📋 Step 2: Normalization');
            const normalized = {
                userId: 'system_scraper',
                couponName: extracted.couponTitle || rawCoupon.couponTitle,
                brandName: rawCoupon.brandName,
                couponTitle: rawCoupon.couponTitle,
                description: rawCoupon.couponTitle,
                couponCode: extracted.couponCode,
                discountType: rawCoupon.discountType,
                discountValue: rawCoupon.discountValue,
                expireBy: rawCoupon.expireBy,
                categoryLabel: rawCoupon.category,
                couponVisitingLink: rawCoupon.couponLink,
                sourceWebsite: 'test',
                addedMethod: 'scraper',
                useCouponVia: extracted.useCouponVia,
                status: 'active',
                couponDetails: extracted.couponDetails,
                terms: extracted.terms,
                minimumOrder: null
            };
            
            console.log('  ✅ Normalized coupon data');
            
            // Step 3: Save with deduplication check
            console.log('\n💾 Step 3: Saving with Deduplication Check');
            const saveResult = await engine.saveOrUpdate(normalized);
            
            console.log(`  ${saveResult.isNew ? '➕' : '🔄'} ${saveResult.isNew ? 'New coupon created' : 'Existing coupon updated'}`);
            
            results.push({
                coupon: rawCoupon.couponTitle,
                extracted,
                isNew: saveResult.isNew
            });
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Check database for duplicates
        console.log('\n' + '='.repeat(70));
        console.log('Checking Database for Duplicates');
        console.log('='.repeat(70));
        
        const allTestCoupons = await Coupon.find({ brandName: 'TestBrand' }).select('couponTitle couponDetails terms');
        
        console.log(`\n📊 Found ${allTestCoupons.length} coupons for TestBrand\n`);
        
        const detailsSet = new Set();
        const termsSet = new Set();
        let hasDuplicates = false;
        
        allTestCoupons.forEach((coupon, index) => {
            console.log(`${index + 1}. ${coupon.couponTitle}`);
            console.log(`   Details: ${coupon.couponDetails?.substring(0, 50)}...`);
            console.log(`   Terms: ${coupon.terms?.split('\n')[0]}`);
            
            // Check for duplicates
            if (detailsSet.has(coupon.couponDetails)) {
                console.log('   ⚠️  DUPLICATE DETAILS DETECTED!');
                hasDuplicates = true;
            }
            if (termsSet.has(coupon.terms)) {
                console.log('   ⚠️  DUPLICATE TERMS DETECTED!');
                hasDuplicates = true;
            }
            
            detailsSet.add(coupon.couponDetails);
            termsSet.add(coupon.terms);
            console.log('');
        });
        
        console.log('='.repeat(70));
        console.log('\n📊 FINAL RESULTS\n');
        
        console.log(`Total Coupons Processed: ${results.length}`);
        console.log(`New Coupons Created: ${results.filter(r => r.isNew).length}`);
        console.log(`Unique Details: ${detailsSet.size} / ${allTestCoupons.length}`);
        console.log(`Unique Terms: ${termsSet.size} / ${allTestCoupons.length}`);
        
        if (!hasDuplicates && detailsSet.size === allTestCoupons.length && termsSet.size === allTestCoupons.length) {
            console.log('\n✅ SUCCESS: No duplicate terms or details detected!');
            console.log('✅ All coupons have unique content!');
            return true;
        } else {
            console.log('\n⚠️ WARNING: Some duplicates detected');
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        return false;
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await Coupon.deleteMany({ brandName: 'TestBrand' });
        await mongoose.connection.close();
        console.log('✅ Cleanup complete\n');
    }
}

// Run test
testFullPipeline().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
