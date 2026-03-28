require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const ImportedCoupons = require('./src/models/ImportedCoupons');
const Notification = require('./src/models/Notification');
const notificationService = require('./src/services/notificationService');
const logger = require('./src/utils/logger');
const { connectDB } = require('./src/config/database');

async function testImportedNotification() {
    try {
        // 1. Connect to DB
        await connectDB();
        console.log('--- Database Connected ---');

        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // 1. Fetch users with valid FCM tokens (Same as cron)
        const users = await User.find({ fcmToken: { $ne: null, $exists: true } }, '_id fcmToken name');

        if (!users.length) {
            console.log('CRON: No users with FCM tokens found.');
            process.exit(0);
        }

        console.log(`Found ${users.length} users with FCM tokens.`);

        let totalNotificationsSent = 0;

        // 2. Loop on the list of these users (Same as cron)
        for (const user of users) {
            console.log(`Checking user: ${user.name} (${user._id})...`);
            console.log("today", now, "tommorow", tomorrow)
            // 3. For each user query the imported coupon schema (Same as cron)
            const expiringCoupons = await ImportedCoupons.find({
                userId: user._id,
                expireBy: { $gte: now, $lte: tomorrow },
              
                status: 'active'
            });
            console.log("these are expiring coupons", expiringCoupons)
            if (expiringCoupons.length > 0) {
                console.log(`Found ${expiringCoupons.length} expiring coupons for user ${user.name}.`);
            }

            // 4. For each coupon generate the notification and store in DB (Same as cron)
            for (const coupon of expiringCoupons) {
                const title = `Coupon Expiring Soon: ${coupon.couponName}`;
                const body = `Your ${coupon.brandName} coupon is about to expire. Use it before it's gone!`;
                const data = {
                    couponId: coupon._id.toString(),
                    type: 'expiry_alert',
                    couponModel: 'ImportedCoupon'
                };

                console.log(`Sending notification: ${title}`);

                try {
                    // Send push notification to this specific user
                    const fcmResponse = await notificationService.sendMulticastNotification([user.fcmToken], title, body, data);

                    // Save notification data in the DB
                    await Notification.create({
                        userId: [user._id],
                        title,
                        body,
                        type: 'expiry_alert',
                        data,
                        couponId: coupon._id,
                        couponModel: 'ImportedCoupon',
                        priority: 'high',
                        isSent: true,
                        sentAt: new Date(),
                    });

                    totalNotificationsSent++;
                    console.log('Notification sent and saved.');
                } catch (err) {
                    console.error(`CRON: Failed to send/save notification for user ${user._id} and coupon ${coupon._id}:`, err.message);
                }
            }
        }

        console.log(`\n--- Test finished. Total notifications sent: ${totalNotificationsSent} ---`);

        console.log('Test completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testImportedNotification();
