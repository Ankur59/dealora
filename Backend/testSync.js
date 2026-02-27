require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const { runDailySync } = require('./src/services/gmailSyncService');
const logger = require('./src/utils/logger');

const testSync = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info('Connected to MongoDB');

        const result = await runDailySync();
        console.log('Sync result:', result);

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
};

testSync();
