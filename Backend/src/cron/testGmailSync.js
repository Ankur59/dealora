/**
 * testGmailSync.js
 * ----------------
 * Manual test runner for the weekly Gmail Sync cron job.
 * Run with:  node src/cron/testGmailSync.js
 *
 * Make sure your .env is loaded and your MongoDB is reachable
 * before running this script.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error('❌  No MONGO_URI found in .env. Aborting.');
    process.exit(1);
}

(async () => {
    // ── 1. Connect to MongoDB ──────────────────────────────────────────────────
    console.log('🔌  Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI);
    console.log('✅  MongoDB connected.\n');

    // ── 2. Run the Gmail Sync ──────────────────────────────────────────────────
    console.log('📬  Triggering Gmail Sync (same function used by the cron job)…\n');
    logger.info('TEST: Manually triggering weekly Gmail sync job…');

    const gmailSyncService = require('../services/gmailSyncService');

    try {
        const result = await gmailSyncService.runDailySync();

        console.log('\n─────────────────────────────────────────');
        console.log('✅  Gmail Sync finished successfully!');
        console.log('📊  Results:');
        console.log(`   • Accounts processed : ${result.totalProcessed}`);
        console.log(`   • Successfully synced: ${result.totalEmailsSync}`);
        console.log(`   • Tokens removed     : ${result.totalRemoved}`);
        console.log('─────────────────────────────────────────\n');

        logger.info(`TEST: Gmail sync result → ${JSON.stringify(result)}`);
    } catch (err) {
        console.error('\n❌  Gmail Sync encountered an error:');
        console.error(err.message || err);
        logger.error(`TEST: Gmail sync failed → ${err.message}`);
        process.exitCode = 1;
    } finally {
        // ── 3. Disconnect ──────────────────────────────────────────────────────
        await mongoose.disconnect();
        console.log('🔌  MongoDB disconnected. Done.');
    }
})();
