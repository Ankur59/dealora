import cron from 'node-cron';
import Merchant from '../models/merchant.model.js';
import VerificationJob from '../models/verificationJob.model.js';
import browserService from './browser.service.js';
import couponVerificationService from './couponVerification.service.js';
import { io } from '../index.js';

class VerificationSchedulerService {
  constructor() {
    this.currentJob = null;
    this.concurrency = 5;
    this._starting = false;
  }

  /**
   * Initialize the scheduler to run every 12 hours.
   */
  init() {
    // Run at 00:00 and 12:00 every day
    cron.schedule('0 0,12 * * *', () => {
      this.startGlobalVerificationCycle();
    });
    console.log('🗓️ Verification Scheduler initialized: runs every 12 hours.');
  }

  /**
   * Starts the batch verification job across all enabled merchants.
   */
  async startGlobalVerificationCycle(triggerType = 'scheduled') {
    if (this._starting) {
      console.log('⚠️ A verification job is already starting. Skipping cycle.');
      return;
    }
    if (this.currentJob && this.currentJob.status === 'running') {
      console.log('⚠️ A verification job is already running. Skipping cycle.');
      return;
    }
    this._starting = true;

    try {
      const enabledMerchants = await Merchant.find({ autoVerificationEnabled: true });
      if (enabledMerchants.length === 0) {
        console.log('ℹ️ No merchants enabled for auto-verification.');
        return;
      }

      const job = new VerificationJob({
        cycleStartTime: new Date(),
        status: 'running',
        totalMerchants: enabledMerchants.length,
        triggerType,
        config: { concurrency: this.concurrency }
      });
      await job.save();
      this.currentJob = job;

      io.emit('verification:job_started', { jobId: job._id, totalMerchants: job.totalMerchants });

      // Process in chunks of concurrency
      const merchantChunks = [];
      for (let i = 0; i < enabledMerchants.length; i += this.concurrency) {
        merchantChunks.push(enabledMerchants.slice(i, i + this.concurrency));
      }

      for (const chunk of merchantChunks) {
        await Promise.all(chunk.map(m => this.processMerchantVerifications(m, job)));
        job.processedMerchants += chunk.length;
        await job.save();
        io.emit('verification:progress', { jobId: job._id, processed: job.processedMerchants, total: job.totalMerchants });
      }

      job.status = 'completed';
      job.cycleEndTime = new Date();
      await job.save();
      this.currentJob = null;

      io.emit('verification:job_completed', { jobId: job._id });
      console.log(`✅ Global verification cycle completed. Job ID: ${job._id}`);
    } catch (err) {
      console.error('🔥 Global verification cycle failed:', err);
      const failedJobId = this.currentJob?._id;
      if (this.currentJob) {
        this.currentJob.status = 'failed';
        this.currentJob.error = { message: err.message, stack: err.stack };
        await this.currentJob.save();
        this.currentJob = null;
      }
      io.emit('verification:job_completed', { jobId: failedJobId, error: err.message });
    } finally {
      this._starting = false;
    }
  }

  async processMerchantVerifications(merchant, job) {
    const merchantId = merchant._id;
    try {
      await browserService.emitLog(merchantId, `🚀 Starting batch verification cycle…`);

      const { page, context } = await browserService.getPageWithSession(merchantId);

      // Perform verification
      await couponVerificationService.verifyAllMerchantCoupons(merchantId, page, context, job);

      await browserService.closeSession(merchantId);
      await browserService.emitLog(merchantId, `✅ Batch verification finished for merchant.`, 'success');
    } catch (err) {
      console.error(`Error processing merchant ${merchant.merchantName}:`, err);
      await browserService.emitLog(merchantId, `🔥 Verification cycle error: ${err.message}`, 'error');
    }
  }

  /**
   * Starts a manual verification job for selected merchants.
   * Runs independently of scheduled jobs so they can work concurrently.
   */
  async startManualVerificationForMerchants(merchantIds) {
    const merchants = await Merchant.find({ _id: { $in: merchantIds } });
    if (merchants.length === 0) {
      console.log('ℹ️ No valid merchants selected for manual verification.');
      return null;
    }

    const job = new VerificationJob({
      cycleStartTime: new Date(),
      status: 'running',
      totalMerchants: merchants.length,
      triggerType: 'manual',
      config: { concurrency: this.concurrency }
    });
    await job.save();

    io.emit('verification:job_started', { jobId: job._id, totalMerchants: job.totalMerchants, manual: true });

    // Process in chunks of concurrency independently
    const merchantChunks = [];
    for (let i = 0; i < merchants.length; i += this.concurrency) {
      merchantChunks.push(merchants.slice(i, i + this.concurrency));
    }

    // Run asynchronously so we don't block the HTTP response
    (async () => {
      for (const chunk of merchantChunks) {
        await Promise.all(chunk.map(m => this.processMerchantVerifications(m, job)));
        job.processedMerchants += chunk.length;
        await job.save();
        io.emit('verification:progress', { jobId: job._id, processed: job.processedMerchants, total: job.totalMerchants });
      }

      job.status = 'completed';
      job.cycleEndTime = new Date();
      await job.save();
      io.emit('verification:job_completed', { jobId: job._id, manual: true });
      console.log(`✅ Manual verification cycle completed. Job ID: ${job._id}`);
    })();

    return job;
  }

  async toggleMerchantAutoVerification(merchantId, enabled) {
    return await Merchant.findByIdAndUpdate(merchantId, { autoVerificationEnabled: enabled }, { new: true });
  }

  async getLatestJobStatus() {
    return await VerificationJob.findOne().sort({ createdAt: -1 });
  }
}

export default new VerificationSchedulerService();
