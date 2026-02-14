require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/database');
const PrivateCoupon = require('./src/models/PrivateCoupon');
const logger = require('./src/utils/logger');

/**
 * Update existing private coupons to add couponDetails and terms fields
 */
async function updateExistingCoupons() {
    try {
        console.log('\n🚀 Starting Private Coupon Field Update...\n');
        console.log('='.repeat(70));
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to database\n');
        
        // Find all private coupons that don't have the new fields
        const couponsToUpdate = await PrivateCoupon.find({
            $or: [
                { couponDetails: { $exists: false } },
                { couponDetails: null },
                { terms: { $exists: false } },
                { terms: null }
            ]
        });
        
        console.log(`📊 Found ${couponsToUpdate.length} coupons to update\n`);
        
        if (couponsToUpdate.length === 0) {
            console.log('✅ All coupons already have the new fields!\n');
            process.exit(0);
        }
        
        let updated = 0;
        let failed = 0;
        
        for (const coupon of couponsToUpdate) {
            try {
                // Generate couponDetails from existing data
                const couponDetails = coupon.description || 
                    `Get exclusive ${coupon.couponTitle} at ${coupon.brandName}. ` +
                    `${coupon.minimumOrderValue ? `Minimum order value of ${coupon.minimumOrderValue} required.` : ''} ` +
                    `This offer is valid for a limited time period. Shop now and save on your purchase.`;
                
                // Generate terms from existing data
                const termsArray = [];
                
                if (coupon.minimumOrderValue) {
                    termsArray.push(`• Minimum order value of ${coupon.minimumOrderValue} required`);
                }
                
                if (coupon.expiryDate) {
                    const expDate = new Date(coupon.expiryDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    });
                    termsArray.push(`• Offer valid till ${expDate}`);
                }
                
                if (coupon.category) {
                    termsArray.push(`• Valid on ${coupon.category} category items`);
                }
                
                termsArray.push('• Cannot be combined with other offers or promotions');
                termsArray.push(`• Check ${coupon.brandName} website for complete terms and conditions`);
                
                const terms = termsArray.join('\n');
                
                // Update the coupon
                coupon.couponDetails = couponDetails;
                coupon.terms = terms;
                await coupon.save();
                
                updated++;
                
                if (updated % 10 === 0) {
                    console.log(`   Updated ${updated}/${couponsToUpdate.length} coupons...`);
                }
                
            } catch (error) {
                failed++;
                logger.error(`Failed to update coupon ${coupon._id}: ${error.message}`);
            }
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('📊 UPDATE SUMMARY\n');
        console.log(`Total Coupons: ${couponsToUpdate.length}`);
        console.log(`✅ Successfully Updated: ${updated}`);
        console.log(`❌ Failed: ${failed}`);
        
        // Show sample of updated coupon
        if (updated > 0) {
            console.log('\n' + '='.repeat(70));
            console.log('📝 SAMPLE UPDATED COUPON\n');
            
            const sample = await PrivateCoupon.findOne({ 
                couponDetails: { $ne: null },
                terms: { $ne: null }
            });
            
            if (sample) {
                console.log(`Brand: ${sample.brandName}`);
                console.log(`Title: ${sample.couponTitle}`);
                console.log(`\nCoupon Details:\n${sample.couponDetails}`);
                console.log(`\nTerms:\n${sample.terms}`);
            }
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('\n✅ UPDATE COMPLETED SUCCESSFULLY!\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error updating coupons:', error.message);
        logger.error('Failed to update private coupons:', error);
        process.exit(1);
    }
}

// Run the update
updateExistingCoupons();
