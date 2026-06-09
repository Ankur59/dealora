import cron from 'node-cron';
import Partner from '../models/partners.model.js';
import SyncJob from '../models/syncJob.model.js';
import { fetchAndNormalizePartnerData } from './normalization.service.js';
import merchantSyncService from './merchantSync.service.js';
import { adapters } from '../adapters/index.js';

class PartnerSyncSchedulerService {
    constructor() {
        this._syncRunning = false;
    }

    init() {
        if (process.env.ENABLE_AUTOMATIC_CRON === 'true') {
            // Run every 12 hours at 00:00 and 12:00
            cron.schedule('0 0,12 * * *', async () => {
                console.log('⏰ Starting scheduled 12-hour Partner Data Sync...');
                try {
                    await this.runPartnerSync();
                } catch (err) {
                    console.error('❌ Scheduled Partner Data Sync failed:', err);
                }
            });
            console.log('🗓️ Partner Sync Scheduler initialized: runs every 12 hours.');

            // Check if we missed a run while the server was down
            this._checkMissedSync();
        } else {
            console.log('ℹ️ Automatic cron partner sync scheduler is disabled.');
        }
    }

    async _checkMissedSync() {
        try {
            const lastJob = await SyncJob.findOne({ status: 'completed' }).sort({ syncStartTime: -1 });
            if (!lastJob) {
                console.log('No completed sync job history yet. Skipping startup catch-up.');
                return;
            }

            const now = Date.now();
            const twelveHoursMs = 12 * 60 * 60 * 1000;

            if (now - lastJob.syncStartTime.getTime() >= twelveHoursMs) {
                console.log('🔄 Missed or outdated Partner Sync detected. Triggering immediate sync...');
                this.runPartnerSync().catch(err => console.error('Immediate sync failed:', err));
            } else {
                console.log('✅ Partner Sync is up to date.');
            }
        } catch (err) {
            console.error('⚠️ Failed to check missed Partner Sync:', err);
        }
    }

    async runPartnerSync() {
        if (this._syncRunning) {
            console.log('⚠️ A partner sync is already in progress. Skipping...');
            return;
        }
        this._syncRunning = true;

        try {
            const activePartners = await Partner.find({ status: 'active' }).lean();
            if (activePartners.length === 0) {
                console.log('[PartnerSync] No active partners found in DB.');
                return;
            }

            const job = new SyncJob({ syncStartTime: new Date(), status: 'running' });
            await job.save();

            console.log(`[PartnerSync] Found ${activePartners.length} active partners. Starting sync steps...`);

            // Step 1: Sync merchants for all active partners who have a syncMerchants method
            for (const partner of activePartners) {
                const partnerName = partner.partnerName;
                const adapter = adapters[partnerName];
                if (adapter && typeof adapter.syncMerchants === 'function') {
                    console.log(`[PartnerSync] Syncing merchants for partner: ${partnerName}`);
                    try {
                        await fetchAndNormalizePartnerData(partnerName, 'merchants');
                    } catch (err) {
                        console.error(`[PartnerSync] Failed to sync merchants for ${partnerName}:`, err.message);
                    }
                }
            }

            // Step 2: Bridge PartnerMerchant metadata to internal Merchant model
            console.log('[PartnerSync] Bridging partner merchants to internal Merchant collection...');
            try {
                await merchantSyncService.syncAndCleanup();
            } catch (err) {
                console.error('[PartnerSync] Merchant sync and cleanup failed:', err.message);
            }

            // Step 3: Sync newCoupons for all active partners
            for (const partner of activePartners) {
                const partnerName = partner.partnerName;
                const adapter = adapters[partnerName];
                if (adapter && typeof adapter.syncNewCoupons === 'function') {
                    console.log(`[PartnerSync] Syncing new coupons for partner: ${partnerName}`);
                    try {
                        await fetchAndNormalizePartnerData(partnerName, 'newCoupons');
                    } catch (err) {
                        console.error(`[PartnerSync] Failed to sync new coupons for ${partnerName}:`, err.message);
                    }
                }
            }

            // Step 4: Sync updatedCoupons for all active partners
            for (const partner of activePartners) {
                const partnerName = partner.partnerName;
                const adapter = adapters[partnerName];
                if (adapter && typeof adapter.syncUpdatedCoupons === 'function') {
                    console.log(`[PartnerSync] Syncing updated coupons for partner: ${partnerName}`);
                    try {
                        await fetchAndNormalizePartnerData(partnerName, 'updatedCoupons');
                    } catch (err) {
                        console.error(`[PartnerSync] Failed to sync updated coupons for ${partnerName}:`, err.message);
                    }
                }
            }

            console.log('[PartnerSync] Scheduled partner sync completed successfully.');
            job.status = 'completed';
            job.syncEndTime = new Date();
            await job.save();
        } catch (err) {
            console.error('[PartnerSync] Critical error during partner sync:', err);
            job.status = 'failed';
            job.syncEndTime = new Date();
            job.error = { message: err.message, stack: err.stack };
            await job.save();
        } finally {
            this._syncRunning = false;
        }
    }
}

export default new PartnerSyncSchedulerService();
