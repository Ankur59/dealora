const mongoose = require('mongoose');
require('dotenv').config();

const Notification = require('./src/models/Notification');
const User = require('./src/models/User');

const createTestNotification = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dealora';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Get first user with fcmToken
        const user = await User.findOne({ fcmToken: { $ne: null } });
        
        if (!user) {
            console.log('⚠️  No users with FCM token found. Creating a test notification anyway...');
        }

        // Create test notification
        const notification = await Notification.create({
            userId: user?._id || null,
            title: 'Test Notification',
            body: 'This is a test notification to verify database storage',
            type: 'general',
            data: {
                test: true,
                timestamp: new Date()
            },
            priority: 'medium',
            isSent: true,
            sentAt: new Date(),
        });

        console.log('\n✅ Test notification created successfully!');
        console.log('   ID:', notification._id);
        console.log('   Title:', notification.title);
        console.log('   User ID:', notification.userId || 'Broadcast to all');
        console.log('\n📝 Now run: node checkNotifications.js to see it');

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createTestNotification();
