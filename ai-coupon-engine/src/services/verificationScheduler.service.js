import cron from 'node-cron';
import PartnerMerchant from '../models/partnerMerchant.model.js';
import Merchant from '../models/merchant.model.js';
import VerificationJob from '../models/verificationJob.model.js';
import browserService, { BrowserService } from './browser.service.js';
import couponVerificationService from './couponVerification.service.js';
import proxyManager from './proxyManager.service.js';
import healthScoreService from './healthScore.service.js';
import { io } from '../index.js';

/** Number of coupons to verify per merchant per minute tick */
const COUPONS_PER_MINUTE = 3;

/** Max time (ms) allowed for a single merchant in full cycle before we give up */
const MERCHANT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Max consecutive failures before we skip a merchant for the rest of the cycle */
const MAX_CONSECUTIVE_FAILURES = 5;

class VerificationSchedulerService {
  constructor() {
    this.currentJob = null;
    this.concurrency = 5;
    this._starting = false;

    /**
     * Minute-cycle state: tracks whether a minute-tick is currently running
     * to prevent overlapping ticks.
     */
    this._minuteTickRunning = false;
  }

  /**
   * Resolve the best target URL from PartnerMerchant fields.
   */
  _resolveTargetUrl(merchant) {
    return merchant.website || merchant.affiliateLink || null;
  }

  /**
   * Given a PartnerMerchant doc, find the corresponding internal Merchant
   * by merchantName so we can use its _id for browser/cookie/automation ops.
   */
  async _resolveBrowserMerchantId(partnerMerchant) {
    const merchant = await Merchant.findOne({ merchantName: partnerMerchant.merchantName });
    return merchant ? merchant._id.toString() : partnerMerchant._id.toString();
  }

  /**
   * Initialize the scheduler.
   * - Every minute: process 3 coupons per enabled merchant (lightweight, incremental)
   * - Every 12 hours: full verification cycle (legacy, processes all coupons)
   *
   * Both paths enforce the 3 coupons/minute rate limit per merchant.
   */
  init() {
    // ─── Every-minute tick: process 3 coupons per merchant ───────────
    cron.schedule('* * * * *', () => {
      this._runMinuteTick();
    });
    console.log('⏱️ Minute-tick scheduler initialized: 3 coupons/merchant/minute.');

    // ─── 12-hour cycle (00:00 and 12:00 daily) ──────────────────────
    cron.schedule('0 0,12 * * *', () => {
      this.startGlobalVerificationCycle();
    });
    console.log('🗓️ Verification Scheduler initialized: runs every 12 hours.');

    // ─── Health Score computation every 12 hours (offset by 30min from verification) ──
    cron.schedule('30 0,12 * * *', () => {
      this._computeHealthScores();
    });
    console.log('📊 Health Score scheduler initialized: runs every 12 hours (offset +30min).');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MINUTE-TICK: lightweight per-minute batch of 3 coupons/merchant
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Called every minute by cron. Processes 3 coupons per enabled merchant.
   * Prevents overlapping runs.
   */
  async _runMinuteTick() {
    if (this._minuteTickRunning) {
      return; // Previous tick still in progress
    }
    // Prevent collision: do not run minute ticks if 12h cycle or manual job is running
    if (this.currentJob && this.currentJob.status === 'running') {
      return;
    }
    this._minuteTickRunning = true;

    try {
      const enabledMerchants = await PartnerMerchant.find({ isActive: true });
      if (enabledMerchants.length === 0) return;

      // Process merchants sequentially to keep resource usage sane
      for (const merchant of enabledMerchants) {
        try {
          await this._processMinuteBatch(merchant);
        } catch (err) {
          // Individual merchant failure shouldn't stop others
          console.error(`[Minute] Merchant ${merchant.merchantName} failed:`, err.message);
        }
      }
    } catch (err) {
      console.error('🔥 Minute-tick error:', err);
    } finally {
      this._minuteTickRunning = false;
    }
  }

  /**
   * Process exactly COUPONS_PER_MINUTE coupons for one merchant.
   * Opens browser, verifies batch, closes browser.
   */
  async _processMinuteBatch(merchant) {
    const partnerMerchantId = merchant._id;
    const browserMerchantId = await this._resolveBrowserMerchantId(merchant);
    let page, context;
    try {
      const session = await browserService.getPageWithSession(browserMerchantId);
      page = session.page;
      context = session.context;

      // Navigate to merchant site using PartnerMerchant for best URL
      const targetUrl = this._resolveTargetUrl(merchant);
      if (targetUrl) {
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await BrowserService.warmUpPage(page);
        } catch (navErr) {
          await browserService.emitLog(browserMerchantId, `⚠️ Navigation slow: ${navErr.message}`, 'warning');
          // Page might still be partially loaded, continue anyway
        }
      }

      // Verify batch of 3
      const result = await couponVerificationService.verifyBatchCoupons(
        partnerMerchantId, page, context, COUPONS_PER_MINUTE
      );

      // Save cookies after each successful batch
      if (context && !page.isClosed()) {
        try {
          await browserService.saveSession(browserMerchantId, context);
        } catch (cookieErr) {
          // Non-fatal: log and continue
          console.error(`[Minute] Cookie save failed for ${merchant.merchantName}:`, cookieErr.message);
        }
      }

      if (result.done) {
        await browserService.emitLog(browserMerchantId, `✅ All coupons verified for this cycle.`, 'success');
      }
    } catch (err) {
      console.error(`[Minute] Error for ${merchant.merchantName}:`, err.message);
      await browserService.emitLog(browserMerchantId, `⚠️ Minute-batch error: ${err.message}`, 'error');
    } finally {
      // Cleanup browser context to free resources
      try {
        const existingCtx = browserService.contexts.get(browserMerchantId);
        if (existingCtx) {
          await browserService.closeSession(browserMerchantId);
        }
      } catch (closeErr) {
        console.error(`Failed to close session for ${browserMerchantId}:`, closeErr);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  12-HOUR CYCLE: full verification run across all merchants
  //  (also limited to 3 coupons/minute per merchant via batch method)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Starts the full 12-hour verification cycle.
   * Uses verifyBatchCoupons internally to enforce 3/min rate limit.
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
      const enabledMerchants = await PartnerMerchant.find({ isActive: true });
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

      // Process merchants one by one (sequentially for 3/min rate limit)
      for (const merchant of enabledMerchants) {
        try {
          await this._processMerchantFullCycle(merchant, job);
        } catch (merchantErr) {
          // Individual merchant failure shouldn't kill entire cycle
          console.error(`[Cycle] Merchant ${merchant.merchantName} failed fatally:`, merchantErr.message);
          await browserService.emitLog(merchant._id, `🔥 Skipped due to fatal error: ${merchantErr.message}`, 'error');
        }
        job.processedMerchants += 1;
        await job.save();
        io.emit('verification:progress', {
          jobId: job._id,
          processed: job.processedMerchants,
          total: job.totalMerchants
        });
      }

      job.status = 'completed';
      job.cycleEndTime = new Date();
      await job.save();
      this.currentJob = null;

      io.emit('verification:job_completed', { jobId: job._id });
      console.log(`✅ Global verification cycle completed. Job ID: ${job._id}`);

      // Compute health scores after cycle completes
      try {
        await this._computeHealthScores();
      } catch (healthErr) {
        console.error('⚠️ Post-cycle health score computation failed:', healthErr.message);
      }
    } catch (err) {
      console.error('🔥 Global verification cycle failed:', err);
      const failedJobId = this.currentJob?._id;
      if (this.currentJob) {
        this.currentJob.status = 'failed';
        this.currentJob.error = { message: err.message, stack: err.stack };
        await this.currentJob.save().catch(() => {});
        this.currentJob = null;
      }
      io.emit('verification:job_completed', { jobId: failedJobId, error: err.message });
    } finally {
      this._starting = false;
    }
  }

  /**
   * Process ALL coupons for a merchant in the 12-hour cycle,
   * but in batches of 3 with ~60s delay between batches (≈3/min).
   */
  async _processMerchantFullCycle(merchant, job) {
    const partnerMerchantId = merchant._id;
    const browserMerchantId = await this._resolveBrowserMerchantId(merchant);
    const startTime = Date.now();
    let consecutiveFailures = 0;

    try {
      await browserService.emitLog(browserMerchantId, `🚀 Starting full verification cycle…`);

      let page, context;
      try {
        const session = await browserService.getPageWithSession(browserMerchantId);
        page = session.page;
        context = session.context;
      } catch (browserErr) {
        await browserService.emitLog(browserMerchantId, `🔥 Browser launch failed: ${browserErr.message}`, 'error');
        throw browserErr;
      }

      // ─── INITIAL NAVIGATION (PartnerMerchant URL preferred) ───
      const targetUrl = this._resolveTargetUrl(merchant);
      if (targetUrl) {
        await browserService.emitLog(browserMerchantId, `🌐 Navigating to ${targetUrl}…`);
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await BrowserService.warmUpPage(page);
        } catch (navErr) {
          await browserService.emitLog(browserMerchantId, `⚠️ Navigation slow: ${navErr.message}`, 'warning');
          // Continue anyway — page might be partially loaded
        }
      }

      // Process in batches of 3 with ~60s delay between batches
      let done = false;
      while (!done) {
        // Timeout check
        if (Date.now() - startTime > MERCHANT_TIMEOUT_MS) {
          await browserService.emitLog(browserMerchantId, `⏱️ Merchant timeout (${MERCHANT_TIMEOUT_MS / 60000}min). Moving to next.`, 'warning');
          break;
        }

        // Circuit breaker: too many consecutive failures
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          await browserService.emitLog(browserMerchantId, `🛑 ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Skipping remaining coupons.`, 'error');
          break;
        }

        try {
          const result = await couponVerificationService.verifyBatchCoupons(
            partnerMerchantId, page, context, COUPONS_PER_MINUTE, job
          );
          done = result.done;
          consecutiveFailures = 0; // Reset on success

          // Save cookies after each batch to preserve session state
          if (context && !page.isClosed()) {
            try {
              await browserService.saveSession(browserMerchantId, context);
            } catch (cookieErr) {
              // Non-fatal: session still works
              await browserService.emitLog(browserMerchantId, `⚠️ Cookie save failed: ${cookieErr.message}`, 'warning');
            }
          }
        } catch (batchErr) {
          consecutiveFailures++;
          const msg = batchErr.message || '';

          // Fatal page error — need to recreate browser
          if (msg.includes('PAGE_FATAL') || msg.includes('Target page, context or browser has been closed')) {
            await browserService.emitLog(browserMerchantId, `💀 Browser died. Attempting recovery…`, 'error');
            try {
              const fresh = await browserService.getPageWithSession(browserMerchantId);
              page = fresh.page;
              context = fresh.context;
              if (targetUrl) {
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
              }
              await browserService.emitLog(browserMerchantId, `🔄 Browser recovered. Continuing…`);
            } catch (recoveryErr) {
              await browserService.emitLog(browserMerchantId, `🔥 Recovery failed: ${recoveryErr.message}`, 'error');
              break;
            }
          } else {
            await browserService.emitLog(browserMerchantId, `❌ Batch error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${msg}`, 'error');
          }
        }

        if (!done) {
          // Wait ~60s before next batch to maintain 3 coupons/minute rate
          await browserService.emitLog(browserMerchantId, `⏳ Waiting ~60s before next batch (rate limit: ${COUPONS_PER_MINUTE}/min)…`);
          await new Promise(r => setTimeout(r, 55000 + Math.random() * 10000));
        }
      }

      await browserService.emitLog(browserMerchantId, `✅ Full verification finished for merchant.`, 'success');
    } catch (err) {
      console.error(`Error processing merchant ${merchant.merchantName}:`, err);
      await browserService.emitLog(browserMerchantId, `🔥 Verification cycle error: ${err.message}`, 'error');
    } finally {
      // Guaranteed cleanup: close browser context even on fatal errors / timeouts
      try {
        // Final cookie save attempt before closing
        const ctx = browserService.contexts.get(browserMerchantId);
        if (ctx) {
          try {
            await browserService.saveSession(browserMerchantId, ctx);
            await browserService.emitLog(browserMerchantId, `🍪 Final cookies saved before cleanup.`, 'info');
          } catch (_) {
            // Best effort
          }
          await browserService.closeSession(browserMerchantId);
          await browserService.emitLog(browserMerchantId, `🧹 Browser session cleaned up.`, 'info');
        }
      } catch (closeErr) {
        console.error(`Failed to close session for ${browserMerchantId}:`, closeErr);
      }
    }
  }

  /**
   * Starts a manual verification job for selected merchants.
   * Also enforces the 3 coupons/minute rate limit via batch processing.
   */
  async startManualVerificationForMerchants(merchantIds) {
    // merchantIds are typically Merchant _ids from the dashboard.
    // Resolve them to their merchantNames to fetch the corresponding PartnerMerchants.
    const internalMerchants = await Merchant.find({ _id: { $in: merchantIds } }).lean();
    const merchantNames = internalMerchants.map(m => m.merchantName);
    const merchants = await PartnerMerchant.find({ merchantName: { $in: merchantNames } });

    if (merchants.length === 0) {
      console.log('ℹ️ No valid partner merchants found for manual verification.');
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

    // Run asynchronously so we don't block the HTTP response
    (async () => {
      for (const merchant of merchants) {
        await this._processMerchantFullCycle(merchant, job);
        job.processedMerchants += 1;
        await job.save();
        io.emit('verification:progress', {
          jobId: job._id,
          processed: job.processedMerchants,
          total: job.totalMerchants
        });
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
    // merchantId is the internal Merchant _id from the dashboard.
    const m = await Merchant.findByIdAndUpdate(merchantId, { autoVerificationEnabled: enabled, isActive: enabled }, { new: true });
    let pm = null;
    if (m) {
      pm = await PartnerMerchant.findOneAndUpdate(
        { merchantName: m.merchantName },
        { isActive: enabled },
        { new: true }
      );
    }
    return pm || m;
  }

  async getLatestJobStatus() {
    return await VerificationJob.findOne().sort({ createdAt: -1 });
  }

  /**
   * Get proxy usage stats for monitoring.
   */
  getProxyStats() {
    return proxyManager.getStats();
  }

  /**
   * Compute and emit health scores for all enabled merchants.
   * Called by 12h cron or after a verification cycle.
   */
  async _computeHealthScores() {
    try {
      console.log('📊 Computing health scores for all enabled merchants…');
      const healthData = await healthScoreService.computeAllHealthScores();
      io.emit('health:scores_updated', healthData);
      console.log(`📊 Health scores computed. System health: ${healthData.systemHealth}%`);
      return healthData;
    } catch (err) {
      console.error('🔥 Health score computation failed:', err.message);
      return null;
    }
  }
}

export default new VerificationSchedulerService();
