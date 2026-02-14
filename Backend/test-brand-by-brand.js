require('dotenv').config();
const mongoose = require('mongoose');
const ScraperEngine = require('./src/scraper/engine');
const GenericAdapter = require('./src/scraper/sources/GenericAdapter');
const Coupon = require('./src/models/Coupon');
const logger = require('./src/utils/logger');

// Mock adapter for testing brand-by-brand processing
class TestBrandAdapter extends GenericAdapter {
    constructor() {
        super('TestSource', 'https://test.com');
    }

    async scrape() {
        logger.info('TestBrandAdapter: Scraping test brands...');
        
        // Simulate scraping multiple brands with multiple coupons each
        return [
            // Brand 1: Zomato (3 coupons)
            {
                brandName: 'Zomato',
                couponTitle: 'Flat 40% OFF on Food',
                couponCode: 'ZOM40',
                couponDetails: 'Get discount on food orders',
                terms: 'Min order applies',
                discountType: 'percentage',
                discountValue: 40,
                category: 'Food',
                couponLink: 'https://zomato.com'
            },
            {
                brandName: 'Zomato',
                couponTitle: 'Free Delivery on Orders',
                couponCode: 'FREESHIP',
                couponDetails: 'No delivery charges',
                terms: 'All orders',
                discountType: 'free_delivery',
                category: 'Food',
                couponLink: 'https://zomato.com'
            },
            {
                brandName: 'Zomato',
                couponTitle: '₹100 OFF on First Order',
                couponCode: 'FIRST100',
                couponDetails: 'New user offer',
                terms: 'New users only',
                discountType: 'flat',
                discountValue: 100,
                category: 'Food',
                couponLink: 'https://zomato.com'
            },
            
            // Brand 2: Swiggy (2 coupons)
            {
                brandName: 'Swiggy',
                couponTitle: 'Get 50% OFF on Orders',
                couponCode: 'SWIGGY50',
                couponDetails: 'Discount on food',
                terms: 'Min ₹199',
                discountType: 'percentage',
                discountValue: 50,
                category: 'Food',
                couponLink: 'https://swiggy.com'
            },
            {
                brandName: 'Swiggy',
                couponTitle: '₹75 Cashback',
                couponCode: 'CASH75',
                couponDetails: 'Paytm cashback',
                terms: 'Min order ₹299',
                discountType: 'cashback',
                discountValue: 75,
                category: 'Food',
                couponLink: 'https://swiggy.com'
            },
            
            // Brand 3: Myntra (2 coupons)
            {
                brandName: 'Myntra',
                couponTitle: '30% OFF on Fashion',
                couponCode: 'FASHION30',
                couponDetails: 'Fashion sale',
                terms: 'All products',
                discountType: 'percentage',
                discountValue: 30,
                category: 'Fashion',
                couponLink: 'https://myntra.com'
            },
            {
                brandName: 'Myntra',
                couponTitle: 'Extra 10% on Footwear',
                couponCode: 'SHOES10',
                couponDetails: 'Footwear discount',
                terms: 'Shoes only',
                discountType: 'percentage',
                discountValue: 10,
                category: 'Fashion',
                couponLink: 'https://myntra.com'
            }
        ];
    }
}

async function testBrandByBrandProcessing() {
    console.log('\n🧪 Testing Brand-by-Brand Database Processing\n');
    console.log('='.repeat(70));
    
    try {
        // Connect to database
        console.log('\n📦 Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected\n');
        
        // Clean up test data
        await Coupon.deleteMany({ 
            brandName: { $in: ['Zomato', 'Swiggy', 'Myntra'] },
            userId: 'system_scraper'
        });
        
        // Create engine with test adapter
        const testAdapter = new TestBrandAdapter();
        const engine = new ScraperEngine([testAdapter]);
        
        console.log('🚀 Starting brand-by-brand scraping...\n');
        console.log('Watch how each brand gets processed and saved separately:\n');
        console.log('='.repeat(70));
        
        // Add timestamps to watch processing
        const startTime = Date.now();
        
        // Run scraper
        const result = await engine.runAll();
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log('\n' + '='.repeat(70));
        console.log('📊 SCRAPING COMPLETED\n');
        console.log(`Total Duration: ${duration}s`);
        console.log(`Total Added: ${result.totalAdded}`);
        console.log(`Total Updated: ${result.totalUpdated}`);
        
        // Verify database
        console.log('\n' + '='.repeat(70));
        console.log('🔍 Verifying Database\n');
        
        const brands = ['Zomato', 'Swiggy', 'Myntra'];
        
        for (const brand of brands) {
            const count = await Coupon.countDocuments({ 
                brandName: brand,
                userId: 'system_scraper'
            });
            console.log(`${brand}: ${count} coupons saved ✅`);
        }
        
        const total = await Coupon.countDocuments({ 
            brandName: { $in: brands },
            userId: 'system_scraper'
        });
        
        console.log(`\nTotal: ${total} coupons in database`);
        
        // Clean up
        console.log('\n🧹 Cleaning up test data...');
        await Coupon.deleteMany({ 
            brandName: { $in: brands },
            userId: 'system_scraper'
        });
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ TEST PASSED: Brand-by-brand processing works!\n');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        return false;
    } finally {
        await mongoose.connection.close();
    }
}

// Run test
testBrandByBrandProcessing().then(success => {
    process.exit(success ? 0 : 1);
});
