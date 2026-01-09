const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const authenticate = require('../middlewares/authenticate');
const { validateCoupon } = require('../middlewares/validation');

// Test routes - No authentication, accepts uid as query parameter
router.get('/test', couponController.getUserCouponsTest);
router.get('/test/:id', couponController.getCouponByIdTest);

// Apply authentication to all routes below
router.use(authenticate);

// Discovery Routes (Should be before /:id)
router.get('/categories', couponController.getCategories);
router.get('/sort-options', couponController.getSortOptions);
router.get('/filter-options', couponController.getFilterOptions);
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
