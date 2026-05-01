/**
 * vCommission Adapter
 *
 * Auth:       API Key (query param 'apiKey')
 * Campaigns:  Page-number pagination → https://api.trackier.com/v2/publisher/campaigns
 * Coupons:    Per-campaign, cursor-based, p-limit(5) concurrency
 *             → https://api.trackier.com/v2/publishers/coupons
 * Categories: Single request → https://api.trackier.com/v2/publishers/categories
 */

import pLimit from 'p-limit';
import { apiKeyAuth }      from '../shared/auth/apiKey.js';
import { paginateCursor, paginatePage, paginateNone } from '../shared/paginator.js';
import { bulkWriteChunked } from '../shared/chunkedWrite.js';
import Campaign  from '../models/campaign.model.js';
import Coupon    from '../models/coupon.model.js';
import { Category } from '../models/category.model.js';
import normalizeCoupon from '../utils/helper.js';  // existing vcommission coupon normalizer

// ── Auth ──────────────────────────────────────────────────────────────────────

const getAuth = apiKeyAuth({ envVar: 'V_COMMISSION_API_KEY', paramName: 'apiKey' });

// ── Normalizers ───────────────────────────────────────────────────────────────

const normalizeCampaign = (camp) => ({
    partner:      'vcommission',
    campaignId:   String(camp.id),
    title:        camp.title,
    categories:   camp.categories || [],
    countries:    camp.countries  || [],
    trackingLink: camp.tracking_link,
    score:        camp.score || 0,
    meta: {
        currency: camp.currency,
        model:    camp.model,
    },
});

// ── Internal: sync coupons for ONE campaign (called concurrently) ─────────────

const _syncCampaignCoupons = async (camp) => {
    await paginateCursor({
        endpoint:    'https://api.trackier.com/v2/publishers/coupons',
        getAuth,
        params:      { campaign_id: camp.campaignId },
        itemsPath:   'coupons',
        cursorField: 'pageToken',
        batchSize:   100,
        onBatch: (items) => bulkWriteChunked({
            items,
            normalize: (raw) => {
                const n = normalizeCoupon(raw);
                // Inherit campaign metadata the coupon API doesn't carry
                n.countries  = camp.countries  || [];
                n.categories = camp.categories || [];
                return n;
            },
            Model:     Coupon,
            getFilter: (n) => ({
                partner: 'vcommission',
                ...(n.couponId ? { couponId: n.couponId } : { code: n.code }),
            }),
        }),
    });
};

// ── Adapter ───────────────────────────────────────────────────────────────────

export default {

    name: 'vcommission',

    /** Fetch all campaigns by page, upsert with $setOnInsert */
    async syncCampaigns() {
        await paginatePage({
            endpoint:  'https://api.trackier.com/v2/publisher/campaigns',
            getAuth,
            params:    {},
            itemsPath: 'data.campaigns',   // response shape: { data: { campaigns: [...] } }
            pageParam: 'page',
            batchSize: 100,
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:      normalizeCampaign,
                Model:          Campaign,
                getFilter:      (n) => ({ partner: 'vcommission', campaignId: n.campaignId }),
                useSetOnInsert: true,
            }),
        });
    },
    /**
     * Fetch all campaigns from DB, then fetch their coupons concurrently
     * (max 5 in-flight at once to respect vCommission rate limits)
     */
    async syncCoupons() {
        const campaigns = await Campaign.find({ partner: 'vcommission' }).lean();
        if (!campaigns.length) {
            console.log('[vCommission] No campaigns found in DB. Run syncCampaigns first.');
            return;
        }

        const limiter = pLimit(5);
        await Promise.all(campaigns.map(camp => limiter(() => _syncCampaignCoupons(camp))));
        console.log(`[vCommission] Coupon sync complete for ${campaigns.length} campaigns.`);
    },

    /** Sync categories once (no pagination — returns all) */
    async syncCategories() {
        await paginateNone({
            endpoint:  'https://api.trackier.com/v2/publishers/categories',
            getAuth,
            itemsPath: 'categories',
            onBatch: async (items) => {
                for (const cat of items) {
                    try {
                        await Category.findOneAndUpdate(
                            { apiId: String(cat.id), partner: 'vcommission' },
                            { $set: { apiId: String(cat.id), name: cat.name, partner: 'vcommission' } },
                            { upsert: true, new: true }
                        );
                    } catch (err) {
                        console.error('[vCommission] Category upsert error:', err.message);
                    }
                }
            },
        });
    },
};
