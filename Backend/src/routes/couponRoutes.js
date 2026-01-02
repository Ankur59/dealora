const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const authenticate = require('../middlewares/authenticate');
const { validateCoupon } = require('../middlewares/validation');

// Apply authentication to all routes below
router.use(authenticate);

// Discovery Routes (Should be before /:id)
router.get('/expiring-soon', couponController.getExpiringSoon);
router.get('/brand/:brandName', couponController.getCouponsByBrand);

// Basic CRUD
router.post('/', validateCoupon, couponController.createCoupon);
router.get('/', couponController.getUserCoupons);
router.get('/:id', couponController.getCouponById);
router.put('/:id', validateCoupon, couponController.updateCoupon);
router.delete('/:id', couponController.deleteCoupon);

// Special Actions
router.patch('/:id/redeem', couponController.redeemCoupon);

module.exports = router;
