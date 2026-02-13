const express = require('express');
const router = express.Router();
const featureController = require('../controllers/featureController');
// Note: In real app, you would add auth middleware here
// const { verifyToken } = require('../middlewares/authenticate');

// OCR Routes
router.post('/ocr', featureController.processScreenshot);
router.get('/ocr', featureController.getOcrHistory);

// Email Routes
router.post('/email', featureController.processEmail);
router.post('/gmail-sync', featureController.syncGmail);
router.get('/email', featureController.getEmailHistory);

// Shared
router.get('/status', featureController.getStatus);

module.exports = router;
