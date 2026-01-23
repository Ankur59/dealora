const express = require('express');
const router = express.Router();
const privateCouponController = require('../controllers/privateCouponController');
const authenticate = require('../middlewares/authenticate');


router.post('/sync', privateCouponController.syncCoupons);
router.post('/statistics', privateCouponController.getStatistics);


router.use(authenticate);

// Discovery Routes
// router.get('/categories', privateCouponController.getPrivateCategories);
// router.get('/sort-options', privateCouponController.getPrivateSortOptions);
// router.get('/filter-options', privateCouponController.getPrivateFilterOptions);

// router.get('/', privateCouponController.getPrivateCoupons);
// router.get('/active', (req, res, next) => { req.query.status = 'active'; privateCouponController.getPrivateCoupons(req, res, next); });
// router.get('/expired', (req, res, next) => { req.query.status = 'expired'; privateCouponController.getPrivateCoupons(req, res, next); });
// router.get('/redeemed', (req, res, next) => { req.query.status = 'redeemed'; privateCouponController.getPrivateCoupons(req, res, next); });
// router.get('/all', privateCouponController.getAllPrivateCoupons); 
// Keep legacy if needed
router.patch('/:id/redeem', privateCouponController.redeemPrivateCoupon);

module.exports = router;