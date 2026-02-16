/**
 * Quick test script for Exclusive Coupons Google Sheet Sync
 * 
 * Usage: node testExclusiveCouponSync.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1rm26_ul-O5w_twJGexAlKHbjVp_0EeQcVKV7E6QHUiY/edit?gid=0#gid=0';

const log = {
    success: (msg) => console.log('\x1b[32m✓\x1b[0m', msg),
    error: (msg) => console.log('\x1b[31m✗\x1b[0m', msg),
    info: (msg) => console.log('\x1b[36mℹ\x1b[0m', msg),
    section: (msg) => console.log('\n\x1b[1m\x1b[35m' + '='.repeat(60) + '\x1b[0m\n\x1b[1m' + msg + '\x1b[0m\n' + '\x1b[35m' + '='.repeat(60) + '\x1b[0m\n'),
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAddSheet() {
    log.section('TEST 1: Add Google Sheet URL');
    
    try {
        const response = await axios.post(`${BASE_URL}/api/exclusive-coupons/add-sheet`, {
            sheetUrl: SHEET_URL
        });
        
        if (response.data.success) {
            log.success('Sheet URL added successfully!');
            log.info(`Synced ${response.data.data.syncResult.stats?.successCount || 0} coupons`);
            console.log(JSON.stringify(response.data, null, 2));
            return true;
        } else {
            log.error('Failed to add sheet URL');
            return false;
        }
    } catch (error) {
        log.error(`Error: ${error.response?.data?.message || error.message}`);
        return false;
    }
}

async function testGetCoupons() {
    log.section('TEST 2: Get All Exclusive Coupons');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/exclusive-coupons`);
        
        if (response.data.success) {
            const coupons = response.data.data.coupons;
            log.success(`Retrieved ${coupons.length} coupons`);
            log.info(`Total coupons in DB: ${response.data.data.pagination.total}`);
            
            // Show first 3 coupons
            if (coupons.length > 0) {
                console.log('\nFirst few coupons:');
                coupons.slice(0, 3).forEach((coupon, idx) => {
                    console.log(`\n${idx + 1}. ${coupon.couponName}`);
                    console.log(`   Brand: ${coupon.brandName}`);
                    console.log(`   Code: ${coupon.couponCode}`);
                    console.log(`   Category: ${coupon.category || 'N/A'}`);
                    console.log(`   Expiry: ${coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString() : 'N/A'}`);
                    console.log(`   Stackable: ${coupon.stackable || 'N/A'}`);
                    console.log(`   Source: ${coupon.source || 'N/A'}`);
                });
            }
            
            return true;
        } else {
            log.error('Failed to get coupons');
            return false;
        }
    } catch (error) {
        log.error(`Error: ${error.response?.data?.message || error.message}`);
        return false;
    }
}

async function testGetCouponByCode() {
    log.section('TEST 3: Get Coupon by Code');
    
    try {
        // First get all coupons to find a code
        const allResponse = await axios.get(`${BASE_URL}/api/exclusive-coupons`);
        const coupons = allResponse.data.data.coupons;
        
        if (coupons.length === 0) {
            log.error('No coupons available to test');
            return false;
        }
        
        const testCode = coupons[0].couponCode;
        log.info(`Testing with coupon code: ${testCode}`);
        
        const response = await axios.get(`${BASE_URL}/api/exclusive-coupons/${testCode}`);
        
        if (response.data.success) {
            log.success('Coupon retrieved successfully!');
            console.log(JSON.stringify(response.data.data, null, 2));
            return true;
        } else {
            log.error('Failed to get coupon');
            return false;
        }
    } catch (error) {
        log.error(`Error: ${error.response?.data?.message || error.message}`);
        return false;
    }
}

async function testFilterByBrand() {
    log.section('TEST 4: Filter Coupons by Brand');
    
    try {
        // First get all coupons to find a brand
        const allResponse = await axios.get(`${BASE_URL}/api/exclusive-coupons`);
        const coupons = allResponse.data.data.coupons;
        
        if (coupons.length === 0) {
            log.error('No coupons available to test');
            return false;
        }
        
        const testBrand = coupons[0].brandName;
        log.info(`Testing filter with brand: ${testBrand}`);
        
        const response = await axios.get(`${BASE_URL}/api/exclusive-coupons?brand=${testBrand}`);
        
        if (response.data.success) {
            log.success(`Found ${response.data.data.coupons.length} coupons for brand: ${testBrand}`);
            return true;
        } else {
            log.error('Failed to filter coupons');
            return false;
        }
    } catch (error) {
        log.error(`Error: ${error.response?.data?.message || error.message}`);
        return false;
    }
}

async function testGetSheetConfig() {
    log.section('TEST 5: Get Sheet Configuration');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/exclusive-coupons/config/sheet`);
        
        if (response.data.success) {
            log.success('Sheet config retrieved successfully!');
            const config = response.data.data;
            log.info(`Last synced: ${config.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString() : 'Never'}`);
            log.info(`Sync status: ${config.syncStatus}`);
            log.info(`Total coupons synced: ${config.totalCouponsSynced}`);
            console.log(JSON.stringify(response.data.data, null, 2));
            return true;
        } else {
            log.error('Failed to get sheet config');
            return false;
        }
    } catch (error) {
        log.error(`Error: ${error.response?.data?.message || error.message}`);
        return false;
    }
}

async function testManualSync() {
    log.section('TEST 6: Manual Sync Trigger');
    
    try {
        log.info('Triggering manual sync...');
        const response = await axios.post(`${BASE_URL}/api/exclusive-coupons/sync-now`);
        
        if (response.data.success) {
            log.success('Manual sync completed!');
            log.info(`Success: ${response.data.data.stats?.successCount || 0} coupons`);
            log.info(`Failed: ${response.data.data.stats?.failCount || 0} coupons`);
            console.log(JSON.stringify(response.data, null, 2));
            return true;
        } else {
            log.error('Manual sync failed');
            return false;
        }
    } catch (error) {
        log.error(`Error: ${error.response?.data?.message || error.message}`);
        return false;
    }
}

async function runAllTests() {
    console.log('\n\x1b[1m\x1b[36m');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     EXCLUSIVE COUPONS - GOOGLE SHEET SYNC TEST SUITE    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\x1b[0m');
    
    log.info(`Server: ${BASE_URL}`);
    log.info(`Sheet URL: ${SHEET_URL}`);
    
    const results = {
        passed: 0,
        failed: 0,
    };
    
    // Test 1: Add Sheet
    if (await testAddSheet()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    await sleep(1000);
    
    // Test 2: Get All Coupons
    if (await testGetCoupons()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    await sleep(500);
    
    // Test 3: Get Coupon by Code
    if (await testGetCouponByCode()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    await sleep(500);
    
    // Test 4: Filter by Brand
    if (await testFilterByBrand()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    await sleep(500);
    
    // Test 5: Get Sheet Config
    if (await testGetSheetConfig()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    await sleep(500);
    
    // Test 6: Manual Sync
    if (await testManualSync()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    // Summary
    log.section('TEST SUMMARY');
    console.log(`Total Tests: ${results.passed + results.failed}`);
    log.success(`Passed: ${results.passed}`);
    if (results.failed > 0) {
        log.error(`Failed: ${results.failed}`);
    }
    
    if (results.failed === 0) {
        console.log('\n\x1b[32m\x1b[1m🎉 ALL TESTS PASSED! 🎉\x1b[0m\n');
    } else {
        console.log('\n\x1b[31m\x1b[1m⚠️  SOME TESTS FAILED ⚠️\x1b[0m\n');
    }
}

// Run tests
runAllTests().catch(error => {
    log.error(`Test suite failed: ${error.message}`);
    process.exit(1);
});
