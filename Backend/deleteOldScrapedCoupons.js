require('dotenv').config();
require('./src/config/database');
const Coupon = require('./src/models/Coupon');

async function deleteOldScrapedCoupons() {
    try {
        const result = await Coupon.deleteMany({ 
            userId: 'system_scraper',
            sourceWebsite: 'GrabOn'
        });
        console.log(`✅ Deleted ${result.deletedCount} old GrabOn coupons`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

deleteOldScrapedCoupons();
