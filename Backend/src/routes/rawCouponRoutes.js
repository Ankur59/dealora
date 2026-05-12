/**
 * Raw Scraped Coupons — public browsing endpoint.
 *
 * Exposes rawScrapedCoupons for the "Exclusive" toggle in the mobile app.
 * Supports sorting by discountScore (couponScore desc by default), plus
 * category / brand / validity / search filters and page-based pagination.
 *
 * Mount: /api/raw-coupons
 */

const express = require('express');
const router = express.Router();
const RawScrapedCoupon = require('../models/RawScrapedCoupon');

/**
 * @route   GET /api/raw-coupons
 * @desc    Get raw scraped coupons with filters, sort and pagination
 * @query   category, brand, search, discountType, validity, sortBy, page, limit
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const {
            category,
            brand,
            search,
            discountType,
            validity,
            sortBy = 'discountScore',   // default: highest scored first
            page: pageStr = '1',
            limit: limitStr = '20',
        } = req.query;

        const limit = Math.min(Math.max(Number(limitStr) || 20, 1), 100);
        const page  = Math.max(Number(pageStr) || 1, 1);
        const skip  = (page - 1) * limit;

        // ── Build filter ──────────────────────────────────────────────────────
        const filter = {};

        if (category) {
            filter.category = { $regex: category, $options: 'i' };
        }

        if (brand) {
            filter.brandName = { $regex: brand, $options: 'i' };
        }

        if (search) {
            filter.$or = [
                { brandName:   { $regex: search, $options: 'i' } },
                { couponTitle: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { couponCode:  { $regex: search, $options: 'i' } },
            ];
        }

        if (discountType) {
            // UI labels → DB enum values
            const typeMap = {
                'percentage_off': 'percentage',
                'flat_discount':  'flat',
                'cashback':       'cashback',
                'freebie':        'freebie',
            };
            const mapped = typeMap[discountType] || discountType;
            filter.discountType = mapped;
        }

        if (validity) {
            const now = new Date();
            if (validity === 'valid_today') {
                const endOfDay = new Date(now);
                endOfDay.setHours(23, 59, 59, 999);
                filter.expiryDate = { $gte: now, $lte: endOfDay };
            } else if (validity === 'valid_this_week') {
                const endOfWeek = new Date(now);
                endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
                filter.expiryDate = { $gte: now, $lte: endOfWeek };
            } else if (validity === 'valid_this_month') {
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                filter.expiryDate = { $gte: now, $lte: endOfMonth };
            } else if (validity === 'expired') {
                filter.expiryDate = { $lt: now };
            }
        }

        // ── Build sort ────────────────────────────────────────────────────────
        let sort = {};
        switch (sortBy) {
            case 'discountScore':
            case 'discount_score':
                sort = { couponScore: -1, scrapedAt: -1 };
                break;
            case 'newest':
            case 'newest_first':
                sort = { scrapedAt: -1 };
                break;
            case 'oldest':
            case 'oldest_first':
                sort = { scrapedAt: 1 };
                break;
            case 'expiring_soon':
                // non-null expiryDate first, then soonest
                sort = { expiryDate: 1 };
                break;
            case 'a_z':
                sort = { brandName: 1 };
                break;
            case 'z_a':
                sort = { brandName: -1 };
                break;
            default:
                sort = { couponScore: -1, scrapedAt: -1 };
        }

        // ── Query ─────────────────────────────────────────────────────────────
        const [coupons, total] = await Promise.all([
            RawScrapedCoupon.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .select(
                    '_id brandName couponTitle description couponCode ' +
                    'discountType discountValue category couponLink ' +
                    'expiryDate couponScore discountWeight usedBy ' +
                    'verified platformVerified trustscore scrapedAt'
                )
                .lean(),
            RawScrapedCoupon.countDocuments(filter),
        ]);

        const pages = Math.ceil(total / limit);

        // ── Shape response ────────────────────────────────────────────────────
        const shaped = coupons.map(c => {
            // Compute daysUntilExpiry if we have an expiryDate
            let daysUntilExpiry = null;
            if (c.expiryDate) {
                const diff = c.expiryDate - Date.now();
                daysUntilExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));
            }

            return {
                _id:             c._id,
                brandName:       c.brandName,
                couponTitle:     c.couponTitle,
                description:     c.description ?? null,
                couponCode:      c.couponCode  ?? null,
                discountType:    c.discountType ?? null,
                discountValue:   c.discountValue ?? null,
                category:        c.category    ?? null,
                couponLink:      c.couponLink  ?? null,
                expiryDate:      c.expiryDate  ?? null,
                daysUntilExpiry: daysUntilExpiry,
                discountScore:   c.couponScore ?? null,
                discountWeight:  c.discountWeight ?? null,
                usedBy:          c.usedBy ?? null,
                trustscore:      c.trustscore ?? null,
                verified:        c.platformVerified ?? c.verified ?? null,
                scrapedAt:       c.scrapedAt,
            };
        });

        res.json({
            success: true,
            message: 'Raw coupons fetched successfully',
            data: {
                total,
                page,
                pages,
                count: shaped.length,
                limit,
                coupons: shaped,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
