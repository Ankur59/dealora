#!/usr/bin/env node

/**
 * Health Score Calculation Test Script
 *
 * This script tests the health score calculation functionality independently.
 * It can be run manually to verify that the cron job logic works correctly.
 *
 * Usage:
 *   cd Backend
 *   node test-health-score.js
 *
 * Environment Variables:
 *   MONGODB_URI - MongoDB connection string (defaults to localhost)
 *   NODE_ENV - Environment (defaults to development)
 */

const mongoose = require('mongoose');
const { runHealthScoreCalculation } = require('./src/cron/healthScoreCron');
const logger = require('./src/utils/logger');

async function testHealthScoreCalculation() {
    const startTime = Date.now();

    try {
        console.log('🚀 Starting Health Score Calculation Test...\n');

        // 1. Connect to database
        console.log('📡 Connecting to database...');
        const mongoUri = "credential";
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to database\n');

        // 2. Run health score calculation
        console.log('🧮 Running health score calculation...');
        const result = await runHealthScoreCalculation();

        // 3. Display results
        console.log('\n📊 Calculation Results:');
        console.log(`   Processed: ${result.processed} coupons`);
        console.log(`   Updated: ${result.updated} coupons`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Average time per coupon: ${result.processed > 0 ? (result.duration / result.processed).toFixed(2) : 0}ms\n`);

        // 4. Sample some results to verify
        if (result.processed > 0) {
            console.log('🔍 Verifying sample results...');

            const col = () => mongoose.connection.db.collection('partnercoupons');
            const sampleCoupons = await col()
                .find({ couponId: "91364" })
                .limit(3)
                .project({
                    brandName: 1,
                    discountWeight: 1,
                    successCount: 1,
                    failedCount: 1,
                    'trend.discoverCount': 1,
                    'trend.lastDiscoverAt': 1,
                    'trend.reliabilityScore': 1,
                    'trend.trendScore': 1,
                    'trend.healthScore': 1,
                    createdAt: 1
                })
                .toArray();

            console.log('\n📋 Sample Coupon Results:');
            sampleCoupons.forEach((coupon, index) => {
                console.log(`\n   Coupon ${index + 1}: ${coupon.brandName || 'Unknown Brand'}`);
                console.log(`   ├─ Discount Weight: ${coupon.discountWeight || 0}`);
                console.log(`   ├─ Success/Failed: ${coupon.successCount || 0}/${coupon.failedCount || 0}`);
                console.log(`   ├─ Discover Count: ${coupon.trend?.discoverCount || 0}`);
                console.log(`   ├─ Reliability Score: ${(coupon.trend?.reliabilityScore || 0).toFixed(2)}`);
                console.log(`   ├─ Trend Score: ${(coupon.trend?.trendScore || 0).toFixed(2)}`);
                console.log(`   └─ Health Score: ${(coupon.trend?.healthScore || 0).toFixed(2)}`);
            });
            console.log('');
        }

        // 5. Summary
        const totalDuration = Date.now() - startTime;
        console.log('✅ Health Score Calculation Test Completed Successfully!');
        console.log(`   Total test duration: ${totalDuration}ms`);
        console.log(`   Database operations: ${result.updated} updates`);
        console.log('\n💡 Next Steps:');
        console.log('   - The cron job will run this same logic every 5 hours');
        console.log('   - Coupons will now be sorted by healthScore by default');
        console.log('   - Users can still sort by discountWeight explicitly');

    } catch (error) {
        console.error('\n❌ Health Score Calculation Test Failed!');
        console.error(`   Error: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        process.exit(1);
    } finally {
        // 6. Cleanup
        try {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from database');
        } catch (disconnectError) {
            console.warn('⚠️  Warning: Could not disconnect cleanly:', disconnectError.message);
        }
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('\n💥 Uncaught Exception:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled Rejection:', reason);
    process.exit(1);
});

// Run the test
if (require.main === module) {
    testHealthScoreCalculation();
}

module.exports = { testHealthScoreCalculation };