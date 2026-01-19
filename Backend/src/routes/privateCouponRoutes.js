const express = require('express');
const router = express.Router();
const privateCouponController = require('../controllers/privateCouponController');
const authenticate = require('../middlewares/authenticate');

// Apply authentication to all routes below
router.use(authenticate);

router.post('/sync', privateCouponController.syncCoupons);
router.get('/', privateCouponController.getAllPrivateCoupons);

module.exports = router;
