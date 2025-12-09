const express = require('express');
const router = express.Router();

const authenticate = require('../middlewares/authenticate');
const { couponValidationRules } = require('../middlewares/validation');
const couponController = require('../controllers/couponController');

router.use(authenticate);

router.post('/', couponValidationRules, couponController.createCoupon);

router.get('/', couponController.getUserCoupons);

router.get('/:id', couponController.getCouponById);

router.put('/:id', couponValidationRules, couponController.updateCoupon);

router.patch('/:id/redeem', couponController.redeemCoupon);

router.delete('/:id', couponController.deleteCoupon);

module.exports = router;

