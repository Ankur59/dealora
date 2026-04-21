import { Router } from 'express';
import automationController from '../controllers/automation.controller.js';
import { requireDashboardAuth } from '../middleware/requireDashboardAuth.middleware.js';

const router = Router();

router.post('/login/:merchantId', requireDashboardAuth, automationController.loginToMerchant);
router.post('/otp', requireDashboardAuth, automationController.provideOTP);

export default router;
