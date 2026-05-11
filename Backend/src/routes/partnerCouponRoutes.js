const express = require('express');
const router = express.Router();
const partnerCouponController = require('../controllers/partnerCouponController');
const authenticate = require('../middlewares/authenticate');

// All routes are private and require a valid Firebase token
router.use(authenticate);

// GET  /api/partner-coupons            → paginated list sorted by discountWeight ↓
router.get('/', partnerCouponController.getPartnerCoupons);

// GET  /api/partner-coupons/redeemed   → coupons this user has redeemed
router.get('/redeemed', partnerCouponController.getRedeemedPartnerCoupons);

// POST /api/partner-coupons/:id/redeem → create a Redemption entry
router.post('/:id/redeem', partnerCouponController.redeemPartnerCoupon);

module.exports = router;
