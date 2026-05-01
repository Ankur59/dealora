import { Router } from 'express';
import automationController from '../controllers/automation.controller.js';
import verificationSchedulerService from '../services/verificationScheduler.service.js';
import CouponVerification from '../models/couponVerification.model.js';
import MerchantCredential from '../models/merchantCredential.model.js';
import Merchant from '../models/merchant.model.js';
import browserService from '../services/browser.service.js';
import healthScoreService from '../services/healthScore.service.js';
import { requireDashboardAuth } from '../middleware/requireDashboardAuth.middleware.js';

const router = Router();

// All automation routes require dashboard auth
router.post('/login/:merchantId', requireDashboardAuth, automationController.loginToMerchant);
router.post('/create-account/:merchantId', requireDashboardAuth, automationController.createAccountOnMerchant);
router.post('/otp', requireDashboardAuth, automationController.provideOTP);
router.post('/save-session/:merchantId', requireDashboardAuth, automationController.saveSessionNow);
router.get('/session-status/:merchantId', requireDashboardAuth, automationController.getSessionStatus);
router.delete('/session/:merchantId', requireDashboardAuth, automationController.clearSession);

// ─── Verification Routes ───
router.post('/verify-all', requireDashboardAuth, async (req, res) => {
  try {
    verificationSchedulerService.startGlobalVerificationCycle('manual');
    res.status(200).json({ success: true, data: { message: 'Global verification cycle triggered manually' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to start global verification' });
  }
});

router.post('/verify-selected', requireDashboardAuth, async (req, res) => {
  try {
    const { merchantIds } = req.body;
    if (!Array.isArray(merchantIds) || merchantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'merchantIds array is required' });
    }
    const job = await verificationSchedulerService.startManualVerificationForMerchants(merchantIds);
    res.status(200).json({ success: true, data: { message: `Manual verification started for ${merchantIds.length} merchants`, jobId: job?._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to start manual verification' });
  }
});

router.get('/job-status', requireDashboardAuth, async (req, res) => {
  try {
    const job = await verificationSchedulerService.getLatestJobStatus();
    res.status(200).json({ success: true, data: { job } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch job status' });
  }
});

router.post('/merchant-toggle/:merchantId', requireDashboardAuth, async (req, res) => {
  try {
    const { enabled } = req.body;
    const merchant = await verificationSchedulerService.toggleMerchantAutoVerification(req.params.merchantId, enabled);
    res.status(200).json({ success: true, data: { merchant } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to toggle merchant' });
  }
});

router.get('/verification-results/:merchantId', requireDashboardAuth, async (req, res) => {
  try {
    const results = await CouponVerification.find({ merchantId: req.params.merchantId }).populate('couponId');
    res.status(200).json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch verification results' });
  }
});

// ─── Global Credentials Routes ───
router.get('/global-credentials', requireDashboardAuth, async (req, res) => {
  try {
    const credentials = await MerchantCredential.find({ merchantId: '000000000000000000000000' });
    const emailCreds = credentials.find(c => c.credentialType === 'email_password');
    const phoneCreds = credentials.find(c => c.credentialType === 'phone_password');
    res.status(200).json({
      success: true,
      data: {
        email: emailCreds?.login || 'Nobentadeal@gmail.com',
        password: emailCreds?.password || 'Mumbai@123',
        phone: phoneCreds?.login || '7425817074'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch global credentials' });
  }
});

router.post('/global-credentials', requireDashboardAuth, async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    const globalId = '000000000000000000000000';
    await MerchantCredential.findOneAndUpdate(
      { merchantId: globalId, credentialType: 'email_password' },
      { merchantId: globalId, merchantName: 'GLOBAL_COMMON', credentialType: 'email_password', login: email, password },
      { upsert: true, new: true }
    );
    await MerchantCredential.findOneAndUpdate(
      { merchantId: globalId, credentialType: 'phone_password' },
      { merchantId: globalId, merchantName: 'GLOBAL_COMMON', credentialType: 'phone_password', login: phone, password },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: { message: 'Global common credentials updated' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to save global credentials' });
  }
});

// ─── Merchant Credentials Routes ───
router.get('/credentials/:merchantId', requireDashboardAuth, async (req, res) => {
  try {
    const globalId = '000000000000000000000000';
    const merchantId = req.params.merchantId;

    // 1. Fetch merchant-specific credentials
    const merchantCreds = await MerchantCredential.find({ merchantId });
    const merchantEmail = merchantCreds.find(c => c.credentialType === 'email_password');
    const merchantPhone = merchantCreds.find(c => c.credentialType === 'phone_password');

    // 2. Fetch global credentials as fallback
    const globalCreds = await MerchantCredential.find({ merchantId: globalId });
    const globalEmail = globalCreds.find(c => c.credentialType === 'email_password');
    const globalPhone = globalCreds.find(c => c.credentialType === 'phone_password');

    // 3. Resolve hierarchy: merchant-specific → global → hardcoded defaults
    const email = merchantEmail?.login ?? globalEmail?.login ?? 'Nobentadeal@gmail.com';
    const password = merchantEmail?.password ?? globalEmail?.password ?? 'Mumbai@123';
    const phone = merchantPhone?.login ?? globalPhone?.login ?? '7425817074';

    res.status(200).json({
      success: true,
      data: { email, password, phone }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch credentials' });
  }
});

router.post('/credentials/:merchantId', requireDashboardAuth, async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    const merchantId = req.params.merchantId;
    await MerchantCredential.findOneAndUpdate(
      { merchantId, credentialType: 'email_password' },
      { merchantId, merchantName: 'default', credentialType: 'email_password', login: email, password },
      { upsert: true, new: true }
    );
    await MerchantCredential.findOneAndUpdate(
      { merchantId, credentialType: 'phone_password' },
      { merchantId, merchantName: 'default', credentialType: 'phone_password', login: phone, password },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: { message: 'Credentials updated', email, password, phone } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to save credentials' });
  }
});

// ─── Health Score Routes ───
router.get('/health-scores', requireDashboardAuth, async (req, res) => {
  try {
    const data = await healthScoreService.computeAllHealthScores();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to compute health scores' });
  }
});

router.get('/health-score/:merchantId', requireDashboardAuth, async (req, res) => {
  try {
    const data = await healthScoreService.computeMerchantHealth(req.params.merchantId);
    if (!data) return res.status(404).json({ success: false, message: 'Merchant not found' });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to compute health score' });
  }
});

// ─── AI Model Metrics Route ───
router.get('/model-metrics', requireDashboardAuth, async (req, res) => {
  try {
    const data = await healthScoreService.computeModelMetrics();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to compute model metrics' });
  }
});

// ─── Manual Override Route (by verification ID) ───
router.post('/verification-override/:verificationId', requireDashboardAuth, async (req, res) => {
  try {
    const { newStatus, reason } = req.body;
    if (!['verified', 'failed'].includes(newStatus)) {
      return res.status(400).json({ success: false, message: 'newStatus must be verified or failed' });
    }
    const verification = await CouponVerification.findByIdAndUpdate(
      req.params.verificationId,
      {
        'manualOverride.newStatus': newStatus,
        'manualOverride.reason': reason || '',
        'manualOverride.overriddenAt': new Date(),
      },
      { new: true }
    );
    if (!verification) return res.status(404).json({ success: false, message: 'Verification not found' });
    res.status(200).json({ success: true, data: verification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Manual Override Route (by coupon DB ID) ───
router.post('/verification-override/coupon/:couponDbId', requireDashboardAuth, async (req, res) => {
  try {
    const { newStatus, reason } = req.body;
    if (!['verified', 'failed'].includes(newStatus)) {
      return res.status(400).json({ success: false, message: 'newStatus must be verified or failed' });
    }
    
    // Find latest verification for this coupon
    const verification = await CouponVerification.findOne({ couponId: req.params.couponDbId })
      .sort({ createdAt: -1 });

    if (!verification) {
      return res.status(404).json({ success: false, message: 'No verification history found for this coupon' });
    }

    verification.manualOverride = {
      newStatus,
      reason: reason || 'Manual fleet override from Coupons Page',
      overriddenAt: new Date()
    };
    await verification.save();

    // Re-trigger health/metric compute since ground truth changed
    healthScoreService.computeAllHealthScores().catch(console.error);

    res.status(200).json({ success: true, data: verification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Import Cookies Route (manual login / already logged in case) ───
router.post('/import-cookies/:merchantId', requireDashboardAuth, async (req, res) => {
  try {
    const { cookies } = req.body;
    const merchantId = req.params.merchantId;
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return res.status(400).json({ success: false, message: 'cookies array is required' });
    }
    // Validate cookie structure
    const validCookies = cookies.filter(c => c && typeof c.name === 'string' && typeof c.value === 'string');
    if (validCookies.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid cookies found (need name + value)' });
    }
    await Merchant.findByIdAndUpdate(merchantId, {
      cookies: validCookies,
      'lastLoginAttempt.status': 'success',
      'lastLoginAttempt.message': 'Cookies imported manually',
      'lastLoginAttempt.lastAttempted': new Date(),
    });
    res.status(200).json({ success: true, data: { message: `Imported ${validCookies.length} cookies`, cookieCount: validCookies.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Extract Cookies from Active Browser (already logged in case) ───
router.post('/extract-cookies/:merchantId', requireDashboardAuth, async (req, res) => {
  try {
    const merchantId = req.params.merchantId;
    const context = browserService.contexts.get(merchantId);
    if (!context) {
      return res.status(404).json({ success: false, message: 'No active browser session. Start automation first or import cookies manually.' });
    }
    await browserService.saveSession(merchantId, context);
    const merchant = await Merchant.findById(merchantId).lean();
    res.status(200).json({
      success: true,
      data: {
        message: 'Cookies extracted and saved from active browser',
        cookieCount: Array.isArray(merchant?.cookies) ? merchant.cookies.length : 0,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Proxy Stats Route ───
router.get('/proxy-stats', requireDashboardAuth, (req, res) => {
  try {
    const stats = verificationSchedulerService.getProxyStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch proxy stats' });
  }
});

export default router;
