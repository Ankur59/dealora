const express = require('express');
const router = express.Router();
const partnerCouponController = require('../controllers/partnerCouponController');
const authenticate = require('../middlewares/authenticate');

// All routes are private and require a valid Firebase token
router.use(authenticate);

// GET  /api/partner-coupons/search     → simple search by brandName & category (verified + not expired, sorted by healthScore)
router.get('/search', partnerCouponController.searchPartnerCoupons);

// GET  /api/partner-coupons            → paginated list sorted by discountWeight ↓
router.get('/', partnerCouponController.getPartnerCoupons);

// GET  /api/partner-coupons/saved      → coupons this user has saved
router.get('/saved', partnerCouponController.getSavedPartnerCoupons);

// GET  /api/partner-coupons/redeemed   → coupons this user has redeemed
router.get('/redeemed', partnerCouponController.getRedeemedPartnerCoupons);

// POST /api/partner-coupons/:id/redeem → create a Redemption entry
router.post('/:id/redeem', partnerCouponController.redeemPartnerCoupon);

// POST /api/partner-coupons/:id/vote   → directly update success/failed counts
router.post('/:id/vote', partnerCouponController.votePartnerCoupon);

// POST /api/partner-coupons/:id/discover → track discover click for trend analytics
router.post('/:id/discover', partnerCouponController.trackDiscover);

// POST /api/partner-coupons/:id/save   → save a partner coupon
router.post('/:id/save', partnerCouponController.savePartnerCoupon);

// DELETE /api/partner-coupons/:id/save → unsave a partner coupon
router.delete('/:id/save', partnerCouponController.unsavePartnerCoupon);

module.exports = router;
