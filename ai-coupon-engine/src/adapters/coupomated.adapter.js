/**
 * Coupomated Adapter
 *
 * Auth:       API Key (query param 'apikey')
 * Campaigns:  Not provided by Coupomated
 * Coupons:    Single request (no pagination)
 *   all     → https://api.coupomated.com/coupons/all
 *   new     → https://api.coupomated.com/coupons/new
 *   updated → https://api.coupomated.com/coupons/updated
 * Merchants:  Single request                → https://api.coupomated.com/merchants
 * Categories: Single request                → https://api.coupomated.com/categories/coupon
 */

import { apiKeyAuth }           from '../shared/auth/apiKey.js';
import { paginateNone }         from '../shared/paginator.js';
import { bulkWriteChunked }     from '../shared/chunkedWrite.js';
import Coupon                   from '../models/coupon.model.js';
import PartnerMerchant          from '../models/partnerMerchant.model.js';
import { Category }             from '../models/category.model.js';
import normalizeCoupomated      from '../services/coupomated/helpers/normalize.js';
import normalizeCoupomatedMerchant from '../services/coupomated/helpers/normalizeMerchant.js';

// ── Auth ──────────────────────────────────────────────────────────────────────

const getAuth = apiKeyAuth({ envVar: 'COUPO_MATED_API_KEY', paramName: 'apikey' });

// ── Adapter ───────────────────────────────────────────────────────────────────

export default {

    name: 'coupomated',

    /**
     * Coupomated returns the full coupon array in a single request.
     * No campaign sync available for this partner.
     */
    async syncCoupons() {
        await paginateNone({
            endpoint: 'https://api.coupomated.com/coupons/all',
            getAuth,
            // Coupomated response.data IS the array — no itemsPath needed
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:  normalizeCoupomated,
                Model:      Coupon,
                getFilter:  (n) => ({ partner: 'coupomated', couponId: n.couponId }),
            }),
        });
    },

    /**
     * Fetches coupons that were newly added since the last sync.
     * Uses the same normalization and upsert pipeline as syncCoupons().
     */
    async syncNewCoupons() {
        await paginateNone({
            endpoint: 'https://api.coupomated.com/coupons/new',
            getAuth,
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:  normalizeCoupomated,
                Model:      Coupon,
                getFilter:  (n) => ({ partner: 'coupomated', couponId: n.couponId }),
            }),
        });
    },

    /**
     * Fetches coupons that were recently updated and patches existing documents.
     * Uses upsert: false so only already-imported coupons are touched — no ghost inserts.
     */
    async syncUpdatedCoupons() {
        await paginateNone({
            endpoint: 'https://api.coupomated.com/coupons/updated',
            getAuth,
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:  normalizeCoupomated,
                Model:      Coupon,
                getFilter:  (n) => ({ partner: 'coupomated', couponId: n.couponId }),
                upsert:     false,   // update-only: never create docs that don't exist yet
            }),
        });
    },

    /**
     * Fetches all merchants from Coupomated and upserts them into the
     * partnermerchant collection, keyed on partner + merchantId.
     */
    async syncMerchants() {
        await paginateNone({
            endpoint: 'https://api.coupomated.com/merchants',
            getAuth,
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:  normalizeCoupomatedMerchant,
                Model:      PartnerMerchant,
                getFilter:  (n) => ({ partner: 'coupomated', merchantId: n.merchantId }),
            }),
        });
    },

    async syncCategories() {
        await paginateNone({
            endpoint:  'https://api.coupomated.com/categories/coupon',
            getAuth,
            onBatch: async (items) => {
                const list = Array.isArray(items) ? items : (items?.categories ?? []);
                for (const cat of list) {
                    try {
                        await Category.findOneAndUpdate(
                            { apiId: String(cat.id), partner: 'coupomated' },
                            {
                                $set: {
                                    apiId:    String(cat.id),
                                    name:     cat.name,
                                    parentId: String(cat.parent_id),
                                    partner:  'coupomated',
                                },
                            },
                            { upsert: true, new: true }
                        );
                    } catch (err) {
                        console.error('[Coupomated] Category upsert error:', err.message);
                    }
                }
            },
        });
    },
};
