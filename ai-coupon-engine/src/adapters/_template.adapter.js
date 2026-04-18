/**
 * ────────────────────────────────────────────────────────────────────────────
 * PARTNER ADAPTER TEMPLATE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * HOW TO ADD A NEW PARTNER (5 steps):
 *
 * 1. Copy this file → src/adapters/[partnerName].adapter.js
 * 2. Fill in the [ ] placeholders below
 * 3. Choose the right auth helper (apiKeyAuth or createOAuth2Manager)
 * 4. Choose the right paginator (paginateOffset / paginateCursor / paginatePage / paginateNone)
 * 5. Add one import line in src/adapters/index.js
 *
 * That's it. No other files need touching.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ── Auth — pick ONE, delete the other ────────────────────────────────────────

import { apiKeyAuth } from '../shared/auth/apiKey.js';
// import { createOAuth2Manager } from '../shared/auth/oauth2.js';

// Option A — API Key (most common)
const getAuth = apiKeyAuth({
    envVar:    'YOUR_PARTNER_API_KEY_ENV',  // e.g. 'COUPO_MATED_API_KEY'
    paramName: 'apikey',                    // query param name the API expects
});

// Option B — OAuth2 (uncomment if needed)
// const oauth2 = createOAuth2Manager({
//     partnerName:     '[partnerName]',
//     tokenUrl:        'https://api.partner.com/token/',
//     clientIdEnv:     'PARTNER_CLIENT_ID',
//     clientSecretEnv: 'PARTNER_CLIENT_SECRET',
//     scopes:          'scope1 scope2',
// });
// const getAuth = oauth2.getAuth;

// ── Paginators — import whichever you need ────────────────────────────────────

import { paginateOffset } from '../shared/paginator.js';
// import { paginatePage }   from '../shared/paginator.js';
// import { paginateCursor } from '../shared/paginator.js';
// import { paginateNone }   from '../shared/paginator.js';

// ── Shared write utility ──────────────────────────────────────────────────────

import { bulkWriteChunked } from '../shared/chunkedWrite.js';

// ── Models ─────────────────────────────────────────────────────────────────────

import Campaign from '../models/campaign.model.js';
import Coupon   from '../models/coupon.model.js';

// ── Normalizers — define inline OR import from a helpers/normalize.js file ────

const normalizeCampaign = (raw) => ({
    partner:      '[partnerName]',
    campaignId:   String(raw.id),
    title:        raw.name    ?? 'Unknown',
    trackingLink: raw.siteUrl ?? null,
    categories:   [],
    countries:    [],
    score:        0,
    meta:         {},
});

const normalizeCoupon = (raw) => ({
    partner:      '[partnerName]',
    couponId:     String(raw.id),
    code:         raw.code        ?? null,
    description:  raw.description ?? null,
    discount:     raw.discount    ?? null,
    start:        raw.startDate   ? new Date(raw.startDate) : null,
    end:          raw.endDate     ? new Date(raw.endDate)   : null,
    trackingLink: raw.trackUrl    ?? null,
    brandName:    raw.brandName   ?? 'Unknown',
    campaignId:   raw.campaignId  ? String(raw.campaignId) : null,
    isVerified:   false,
    status:       'pending',
    type:         'generic',
    categories:   [],
    countries:    [],
    meta:         {},
});

// ── Adapter (this is what gets registered) ────────────────────────────────────

export default {

    name: '[partnerName]',  // must match the key in adapters/index.js

    async syncCampaigns() {
        await paginateOffset({
            endpoint:  'https://api.partner.com/campaigns/',
            getAuth,
            params:    {},
            itemsPath: 'results',   // dot-path to items array in response body
            totalPath: 'count',     // dot-path to total count  
            batchSize: 100,
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:      normalizeCampaign,
                Model:          Campaign,
                getFilter:      (n) => ({ partner: '[partnerName]', campaignId: n.campaignId }),
                useSetOnInsert: true,   // true = don't overwrite existing campaigns
            }),
        });
    },

    async syncCoupons() {
        await paginateOffset({
            endpoint:  'https://api.partner.com/coupons/',
            getAuth,
            params:    {},
            itemsPath: 'results',
            totalPath: 'count',
            batchSize: 100,
            onBatch: (items) => bulkWriteChunked({
                items,
                normalize:  normalizeCoupon,
                Model:      Coupon,
                getFilter:  (n) => ({ partner: '[partnerName]', couponId: n.couponId }),
            }),
        });
    },
};
