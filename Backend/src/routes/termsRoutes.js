const express = require('express');
const { acceptTerms } = require('../controllers/termsController');

const router = express.Router();

// POST /api/terms/accept
router.post('/accept', acceptTerms);

module.exports = router;
