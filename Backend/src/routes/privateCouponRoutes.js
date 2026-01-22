const express = require('express');
const router = express.Router();
const privateCouponController = require('../controllers/privateCouponController');
const authenticate = require('../middlewares/authenticate');

router.post('/sync', privateCouponController.syncCoupons);

router.use(authenticate);

// Discovery Routes
router.get('/categories', privateCouponController.getPrivateCategories);
router.get('/sort-options', privateCouponController.getPrivateSortOptions);
router.get('/filter-options', privateCouponController.getPrivateFilterOptions);

router.get('/', privateCouponController.getPrivateCoupons);
router.get('/all', privateCouponController.getAllPrivateCoupons); // Keep legacy if needed
router.patch('/:id/redeem', privateCouponController.redeemPrivateCoupon);

module.exports = router;
