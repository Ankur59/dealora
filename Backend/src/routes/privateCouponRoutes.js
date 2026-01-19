const express = require('express');
const router = express.Router();
const privateCouponController = require('../controllers/privateCouponController');
const authenticate = require('../middlewares/authenticate');

router.post('/sync', privateCouponController.syncCoupons);

router.use(authenticate);
router.get('/', privateCouponController.getAllPrivateCoupons);

module.exports = router;
