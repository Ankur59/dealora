/**
 * Diagnostic Test - Partner Coupon Search
 * 
 * This helps debug what MongoDB query is being generated
 * Run: node test-mongo-query.js
 */

// Mock the buildFilter function exactly as it is in the controller
function buildFilter({ tab, redeemedIds, category, brand, search, discountType, validity, offerType, verified }) {
    const now = new Date();
    const andConditions = [];

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

    if (verified === 'true' || verified === true) {
        andConditions.push({ isVerified: true });
    }

    if (category) {
        andConditions.push({ categories: category });
    }

    if (brand) {
        andConditions.push({ brandName: { $regex: brand, $options: 'i' } });
    }

    if (offerType) {
        andConditions.push({ offerType: offerType });
    }

    if (discountType) {
        andConditions.push({
            $or: [
                { couponType: { $regex: discountType, $options: 'i' } },
                { discount: { $regex: discountType, $options: 'i' } }
            ]
        });
    }

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

console.log('\n═══════════════════════════════════════════════════════════');
console.log('DIAGNOSTIC: MongoDB Query Generation for Search');
console.log('═══════════════════════════════════════════════════════════\n');

// Test Case: Search for "Amazon" with verified=true, tab=active
console.log('TEST CASE: Search for "Amazon"');
console.log('─────────────────────────────────────────────────────────');

const filter = buildFilter({
    tab: 'active',
    redeemedIds: [],
    search: 'Amazon',
    verified: 'true'
});

console.log('Filter to be sent to MongoDB:');
console.log(JSON.stringify(filter, null, 2));

console.log('\n✓ Query Structure Analysis:');
if (filter.$and) {
    console.log(`✓ Filter uses $and operator with ${filter.$and.length} conditions:`);
    filter.$and.forEach((condition, index) => {
        console.log(`  [${index}] ${JSON.stringify(condition).substring(0, 80)}...`);
    });
} else {
    console.log('✗ ERROR: Filter does not use $and');
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('WHAT THIS QUERY WILL DO:');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('MongoDB will execute:');
console.log('db.partnercoupons.find({');
console.log('  $and: [');
console.log('    // Condition 1: Active (not expired)');
console.log('    { $or: [');
console.log('      { end: { $gte: <current date> } },');
console.log('      { end: null },');
console.log('      { end: { $exists: false } }');
console.log('    ]},');
console.log('    // Condition 2: Verified');
console.log('    { isVerified: true },');
console.log('    // Condition 3: Search');
console.log('    { $or: [');
console.log('      { brandName: /Amazon/i },');
console.log('      { categories: /Amazon/i },');
console.log('      { title: /Amazon/i },');
console.log('      { couponTitle: /Amazon/i },');
console.log('      { couponName: /Amazon/i },');
console.log('      { description: /Amazon/i },');
console.log('      { code: /Amazon/i },');
console.log('      { discount: /Amazon/i }');
console.log('    ]}');
console.log('  ]');
console.log('})');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('DEBUGGING CHECKLIST:');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('✓ For this Amazon coupon to be found, it MUST have:');
console.log('  1. isVerified: true');
console.log('  2. end: null OR end: { $exists: false } OR end date in future');
console.log('  3. At least ONE of these fields containing "Amazon":');
console.log('     - brandName: "Amazon"');
console.log('     - categories: "Amazon" (or array containing "Amazon")');
console.log('     - title: contains "Amazon"');
console.log('     - couponTitle: contains "Amazon"');
console.log('     - couponName: contains "Amazon"');
console.log('     - description: contains "Amazon"');
console.log('     - code: contains "Amazon"');
console.log('     - discount: contains "Amazon"');

console.log('\n✗ COMMON REASONS WHY QUERY RETURNS NO RESULTS:');
console.log('  1. isVerified is false or missing');
console.log('  2. end date is in the past (expired coupon)');
console.log('  3. brandName field contains different value (e.g., case mismatch)');
console.log('  4. Searching in wrong collection (not partnercoupons)');
console.log('  5. Field name mismatch (db has "brand" but we search "brandName")');
console.log('  6. No coupons exist in the collection');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('SOLUTION:');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('1. Check MongoDB directly:');
console.log('   db.partnercoupons.findOne({brandName: "Amazon"})');
console.log('\n2. If found, check these exact fields:');
console.log('   - isVerified');
console.log('   - end (expiry date)');
console.log('   - All field names');
console.log('\n3. If not found, the coupon might be in a different collection');
console.log('   or the field names are different\n');

console.log('═══════════════════════════════════════════════════════════\n');
