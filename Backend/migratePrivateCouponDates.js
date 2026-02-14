require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/database');
const PrivateCoupon = require('./src/models/PrivateCoupon');
const logger = require('./src/utils/logger');

const migrateDates = async () => {
    try {
        await connectDB();
        logger.info('Connected to database for migration...');

        // Fetch all private coupons
        const coupons = await PrivateCoupon.find({});
        logger.info(`Found ${coupons.length} private coupons to migrate.`);

        let updatedCount = 0;
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (const coupon of coupons) {
            // Check if expiryDate is a string or needs conversion
            if (coupon.expiryDate) {
                const expiryDate = new Date(coupon.expiryDate);
                
                // Calculate daysUntilExpiry
                const timeDiff = expiryDate.getTime() - currentDate.getTime();
                const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                // Update the coupon
                coupon.expiryDate = expiryDate;
                coupon.daysUntilExpiry = daysDiff;
                
                await coupon.save();
                updatedCount++;
            }
        }

        logger.info(`Successfully migrated ${updatedCount} private coupon dates.`);
        
        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateDates();
