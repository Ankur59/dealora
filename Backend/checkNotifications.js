const mongoose = require('mongoose');
require('dotenv').config();

const Notification = require('./src/models/Notification');

const checkNotifications = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dealora';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Get all notifications
        const notifications = await Notification.find()
            .populate('couponId', 'couponTitle brandName couponCode')
            .sort({ createdAt: -1 })
            .lean();

        console.log('\n📊 Total Notifications:', notifications.length);
        console.log('═══════════════════════════════════════════════\n');

        if (notifications.length === 0) {
            console.log('❌ No notifications found in database');
            console.log('\n💡 Notifications will be created when:');
            console.log('   1. The cron job runs (every 12 hours)');
            console.log('   2. There are coupons expiring in next 24 hours');
            console.log('   3. Users have FCM tokens set up');
        } else {
            notifications.forEach((notif, index) => {
                console.log(`${index + 1}. ${notif.title}`);
                console.log(`   Type: ${notif.type}`);
                console.log(`   Body: ${notif.body}`);
                console.log(`   Read: ${notif.isRead ? '✓' : '✗'}`);
                console.log(`   Sent: ${notif.isSent ? '✓' : '✗'}`);
                console.log(`   Priority: ${notif.priority}`);
                console.log(`   User ID: ${notif.userId || 'Broadcast'}`);
                console.log(`   Created: ${notif.createdAt}`);
                if (notif.couponId) {
                    console.log(`   Coupon: ${notif.couponId.couponTitle || 'N/A'}`);
                }
                console.log('');
            });
        }

        // Get statistics
        const stats = await Notification.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        if (stats.length > 0) {
            console.log('📈 Statistics by Type:');
            stats.forEach(stat => {
                console.log(`   ${stat._id}: ${stat.count}`);
            });
        }

        await mongoose.connection.close();
        console.log('\n✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

checkNotifications();
