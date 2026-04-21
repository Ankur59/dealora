import { Router } from 'express';
import automationController from '../controllers/automation.controller.js';
import { requireDashboardAuth } from '../middleware/requireDashboardAuth.middleware.js';

const router = Router();

// All automation routes require dashboard auth
router.post('/login/:merchantId', requireDashboardAuth, automationController.loginToMerchant);
router.post('/create-account/:merchantId', requireDashboardAuth, automationController.createAccountOnMerchant);
router.post('/otp', requireDashboardAuth, automationController.provideOTP);
router.post('/save-session/:merchantId', requireDashboardAuth, automationController.saveSessionNow);
router.get('/session-status/:merchantId', requireDashboardAuth, automationController.getSessionStatus);
router.delete('/session/:merchantId', requireDashboardAuth, automationController.clearSession);

export default router;
