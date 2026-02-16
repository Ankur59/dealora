const mongoose = require('mongoose');
require('dotenv').config();

const { connectDB } = require('./src/config/database');
const User = require('./src/models/User');
const PrivateCoupon = require('./src/models/PrivateCoupon');
const Notification = require('./src/models/Notification');
const notificationService = require('./src/services/notificationService');

const testExpiryNotification = async () => {
    try {
        console.log('--- Starting Expiry Notification Logic Test ---');
        await connectDB();

        // 1. Run the Logic (copied from jobs.js for direct testing)
        console.log('Running expiry check logic against existing coupons...');
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        console.log(`Searching for coupons expiring between: \n  ${now.toISOString()} \n  ${tomorrow.toISOString()}`);

        const expiringCoupons = await PrivateCoupon.find({
            expiryDate: { $gte: now, $lte: tomorrow },
            redeemed: false
        });

        console.log(`\nFound ${expiringCoupons.length} expiring coupons in the database.`);

        if (expiringCoupons.length > 0) {
            // Log the brands/titles found
            expiringCoupons.forEach(c => {
                console.log(` - [${c.brandName}] ${c.couponTitle} (Expires: ${c.expiryDate.toISOString()})`);
            });

            const users = await User.find({ fcmToken: { $ne: null } }, 'fcmToken uid');
            const tokens = users.map(u => u.fcmToken).filter(t => !!t);

            console.log(`\nFound ${tokens.length} users with valid FCM tokens.`);

            if (tokens.length === 0) {
                console.log('⚠️ No users found with FCM tokens. Skipping notification delivery test.');
            } else {
                for (const coupon of expiringCoupons) {
                    console.log(`\n📧 Processing notification for: ${coupon.couponTitle}`);
                    const title = `Coupon Expiring Soon: ${coupon.couponTitle}`;
                    const body = `Your ${coupon.brandName} coupon is about to expire. Redeem it soon!`;

                    try {
                        console.log(`Sending multicast message to ${tokens.length} tokens...`);
                        const response = await notificationService.sendMulticastNotification(
                            tokens, 
                            title, 
                            body,
                            { 
                                type: 'expiry_alert',
                                couponId: coupon._id.toString(),
                                couponModel: 'PrivateCoupon'
                            }
                        );
                        console.log(`✅ FCM Result: ${response.successCount} successful, ${response.failureCount} failed.`);

                        // Save ONE notification to database with array of userIds
                        console.log(`💾 Saving notification to database for ${users.length} users...`);
                        const userIds = users.map(user => user._id);
                        
                        const savedNotification = await Notification.create({
                            userId: userIds, // Array of user IDs
                            title: title,
                            body: body,
                            type: 'expiry_alert',
                            data: {
                                couponId: coupon._id.toString(),
                                brandName: coupon.brandName,
                                expiryDate: coupon.expiryDate
                            },
                            couponId: coupon._id,
                            couponModel: 'PrivateCoupon',
                            isSent: true,
                            isRead: false
                        });
                        console.log(`✅ Single notification saved to DB with ${userIds.length} userIds (ID: ${savedNotification._id})`);


                    } catch (e) {
                        console.log('❌ Notification operation failed:', e.message);
                        console.error(e);
                    }
                }
            }
        } else {
            console.log('\n😴 No coupons in the database match the "expiring in 24h" criteria.');
            console.log('   Note: "redeemed: false" must be set for them to be picked up.');
        }

        // Show notification count in database
        const notificationCount = await Notification.countDocuments();
        console.log(`\n📊 Total notifications in database: ${notificationCount}`);

        console.log('\n--- Test Execution Complete ---');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed.');
    }
};

testExpiryNotification();
