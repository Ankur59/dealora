/**
 * Admitad Adapter
 *
 * Auth:       OAuth2 Client-Credentials (with auto-refresh)
 * Campaigns:  Offset-based → https://api.admitad.com/advcampaigns/website/{ADMITAD_WEBSITE_ID}/
 * Coupons:    Offset-based → https://api.admitad.com/coupons/website/{ADMITAD_WEBSITE_ID}/
 */

import { createOAuth2Manager } from '../shared/auth/oauth2.js';
import { paginateOffset }      from '../shared/paginator.js';
import { bulkWriteChunked }    from '../shared/chunkedWrite.js';
import Campaign                from '../models/campaign.model.js';
import Coupon                  from '../models/coupon.model.js';
import normalizeAdmitadCoupon  from '../services/admitad/helpers/normalize.js';

// ── Auth ──────────────────────────────────────────────────────────────────────

const oauth2 = createOAuth2Manager({
    partnerName:     'admitad',
    tokenUrl:        'https://api.admitad.com/token/',
    clientIdEnv:     'ADMITAD_CLIENT_ID',
    clientSecretEnv: 'ADMITAD_CLIENT_SECRET',
    scopes:          'advcampaigns_for_website coupons_for_website websites',
});

// ── Normalizers ───────────────────────────────────────────────────────────────

const normalizeAdmitadCampaign = (camp) => ({
    partner:      'admitad',
    campaignId:   String(camp.id),
    title:        camp.name    ?? 'Unknown',
    trackingLink: camp.site_url ?? null,
    categories:   (camp.categories ?? []).map(c => c.name ?? c),
    countries:    [],
    score:        0,
    meta: {
        status:   camp.status  ?? null,
        image:    camp.image   ?? null,
        site_url: camp.site_url ?? null,
    },
});

// ── Adapter ───────────────────────────────────────────────────────────────────

export default {

    name: 'admitad',

    async syncCampaigns() {
        const websiteId = process.env.ADMITAD_WEBSITE_ID;
        if (!websiteId) throw new Error('[Admitad] ADMITAD_WEBSITE_ID missing in env.');

        await paginateOffset({
            endpoint:  `https://api.admitad.com/advcampaigns/website/${websiteId}/`,
            getAuth:   oauth2.getAuth,
            params:    { has_tool: 'coupons' },
            itemsPath: 'results',
            totalPath: 'count',
            batchSize: 100,
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:      normalizeAdmitadCampaign,
                Model:          Campaign,
                getFilter:      (n) => ({ partner: 'admitad', campaignId: n.campaignId }),
                useSetOnInsert: true,
            }),
        });
    },

    async syncCoupons() {
        const websiteId = process.env.ADMITAD_WEBSITE_ID;
        if (!websiteId) throw new Error('[Admitad] ADMITAD_WEBSITE_ID missing in env.');

        await paginateOffset({
            endpoint:  `https://api.admitad.com/coupons/website/${websiteId}/`,
            getAuth:   oauth2.getAuth,
            itemsPath: 'results',
            totalPath: 'count',
            batchSize: 100,
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:  normalizeAdmitadCoupon,
                Model:      Coupon,
                getFilter:  (n) => ({ partner: 'admitad', couponId: n.couponId }),
            }),
        });
    },
};
