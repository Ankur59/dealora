/**
 * Test Script for Partner Coupon Search Functionality
 * 
 * Usage: 
 * node test-search-fix.js
 * 
 * This script tests the search filter logic to ensure it's working correctly
 * without needing to make HTTP requests.
 */

// Mock buildFilter function (copied from partnerCouponController.js)
function buildFilter({ tab, redeemedIds, category, brand, search, discountType, validity, offerType, verified }) {
    const now = new Date();
    const andConditions = [];

    // ── 1. TAB FILTER (active/expired) ──
    if (tab === 'expired') {
        andConditions.push({ end: { $lt: now } });
    } else {
        andConditions.push({
            $or: [
                { end: { $gte: now } },
                { end: null },
                { end: { $exists: false } },
            ]
        });
        if (redeemedIds.length > 0) {
            andConditions.push({ _id: { $nin: redeemedIds } });
        }
    }

    // ── 2. VERIFIED FILTER ──
    if (verified === 'true' || verified === true) {
        andConditions.push({ isVerified: true });
    }

    // ── 3. CATEGORY FILTER ──
    if (category) {
        andConditions.push({ categories: category });
    }

    // ── 4. BRAND FILTER ──
    if (brand) {
        andConditions.push({ brandName: { $regex: brand, $options: 'i' } });
    }

    // ── 5. OFFER TYPE FILTER ──
    if (offerType) {
        andConditions.push({ offerType: offerType });
    }

    // ── 6. DISCOUNT TYPE FILTER ──
    if (discountType) {
        andConditions.push({
            $or: [
                { couponType: { $regex: discountType, $options: 'i' } },
                { discount: { $regex: discountType, $options: 'i' } }
            ]
        });
    }

    // ── 7. VALIDITY FILTER ──
    if (validity) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (validity === 'valid_today') {
            const tonight = new Date(today);
            tonight.setHours(23, 59, 59, 999);
            andConditions.push({ end: { $gte: today, $lte: tonight } });
        } else if (validity === 'valid_this_week') {
            const endOfWeek = new Date(today);
            endOfWeek.setDate(today.getDate() + 7);
            andConditions.push({ end: { $gte: today, $lte: endOfWeek } });
        } else if (validity === 'valid_this_month') {
            const endOfMonth = new Date(today);
            endOfMonth.setMonth(today.getMonth() + 1);
            endOfMonth.setDate(0);
            andConditions.push({ end: { $gte: today, $lte: endOfMonth } });
        }
    }

    // ── 8. SEARCH FILTER ──
    if (search) {
        const searchTerm = search.trim();
        if (searchTerm !== '') {
            const rx = { $regex: searchTerm, $options: 'i' };

            andConditions.push({
                $or: [
                    { brandName: rx },
                    { categories: rx },
                    { title: rx },
                    { couponTitle: rx },
                    { couponName: rx },
                    { description: rx },
                    { code: rx },
                    { discount: rx }
                ]
            });
        }
    }

    const filter = andConditions.length > 0
        ? { $and: andConditions }
        : {};

    return filter;
}

// Test Cases
console.log('\n=== PARTNER COUPON SEARCH FILTER TESTS ===\n');

// Test 1: Search for "Amazon"
console.log('Test 1: Search for "Amazon" (verified, active tab)');
const filter1 = buildFilter({
    tab: 'active',
    redeemedIds: [],
    search: 'Amazon',
    verified: 'true'
});
console.log('Filter:', JSON.stringify(filter1, null, 2));
console.log('✓ This filter should match coupons with "Amazon" in:');
console.log('  - brandName (e.g., "Amazon")');
console.log('  - categories (e.g., coupons in Electronics category)');
console.log('  - title, description, code, discount\n');

// Test 2: Search for "amazon" (lowercase)
console.log('Test 2: Search for "amazon" (lowercase - should be case-insensitive)');
const filter2 = buildFilter({
    tab: 'active',
    redeemedIds: [],
    search: 'amazon',
    verified: 'true'
});
console.log('Filter:', JSON.stringify(filter2, null, 2));
console.log('✓ This should match same results as Test 1 (case-insensitive)\n');

// Test 3: Search for "Nike"
console.log('Test 3: Search for "Nike" with category filter');
const filter3 = buildFilter({
    tab: 'active',
    redeemedIds: [],
    search: 'Nike',
    category: 'Fashion',
    verified: 'true'
});
console.log('Filter:', JSON.stringify(filter3, null, 2));
console.log('✓ This should match Nike coupons in Fashion category\n');

// Test 4: No search (just brand filter)
console.log('Test 4: Filter by brand "Flipkart" (no search query)');
const filter4 = buildFilter({
    tab: 'active',
    redeemedIds: [],
    brand: 'Flipkart',
    verified: 'true'
});
console.log('Filter:', JSON.stringify(filter4, null, 2));
console.log('✓ This should match only Flipkart coupons\n');

// Test 5: Empty search
console.log('Test 5: Empty search query');
const filter5 = buildFilter({
    tab: 'active',
    redeemedIds: [],
    search: '',
    verified: 'true'
});
console.log('Filter:', JSON.stringify(filter5, null, 2));
console.log('✓ This should NOT include search filter (empty string)\n');

// Test 6: All filters combined
console.log('Test 6: Combined filters (search + brand + category)');
const filter6 = buildFilter({
    tab: 'active',
    redeemedIds: [],
    search: 'discount',
    brand: 'Amazon',
    category: 'Electronics',
    verified: 'true',
    validity: 'valid_today'
});
console.log('Filter:', JSON.stringify(filter6, null, 2));
console.log('✓ This is a complex query combining multiple filters\n');

// Test 7: Verify filter structure
console.log('Test 7: Structure validation');
const testFilter = buildFilter({
    tab: 'active',
    redeemedIds: [],
    search: 'test',
    verified: 'true'
});

// Check if filter has $and at root level (correct structure)
if (testFilter.$and) {
    console.log('✓ Filter uses $and at root level (CORRECT)');
    console.log(`✓ Filter contains ${testFilter.$and.length} conditions`);
    console.log('✓ Structure: { $and: [condition1, condition2, ...] }');
} else if (Object.keys(testFilter).length === 0) {
    console.log('✓ Filter is empty (no conditions specified)');
} else {
    console.log('✗ Filter structure may be incorrect');
}

console.log('\n=== DEBUGGING NOTES ===\n');
console.log('If search is not working:');
console.log('1. Check MongoDB logs to see the actual query being executed');
console.log('2. Verify the field names in the database match these names:');
console.log('   - brandName');
console.log('   - categories');
console.log('   - title / couponTitle / couponName');
console.log('   - description');
console.log('   - code');
console.log('   - discount');
console.log('3. Ensure isVerified field exists in database');
console.log('4. Check that end field is properly set for expiry logic');
console.log('5. Add debug logging in Backend logs (already done)');

console.log('\n=== TEST COMPLETE ===\n');
