// @deprecated — Logic migrated to src/adapters/admitad.adapter.js
// Kept for git history. Do not use in new code.
// providers/admitad.js
// Handles Admitad OAuth (client_credentials + refresh) and API calls.

import axios from 'axios';
import limitedGet from '../config/axios.js';
import { syncCampaignsAdmitad } from '../services/admitad/campaign.service.js';
import { syncAllCouponsAdmitad } from '../services/admitad/coupon.service.js';

const BASE_URL = 'https://api.admitad.com';
const BATCH_SIZE = 100;

// ─── In-memory token cache ────────────────────────────────────────────────────
let tokenCache = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null, // Unix ms timestamp
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const basicAuthHeader = () => {
    const clientId     = process.env.ADMITAD_CLIENT_ID;
    const clientSecret = process.env.ADMITAD_CLIENT_SECRET;
    return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
};

const isTokenValid = () =>
    tokenCache.accessToken &&
    tokenCache.expiresAt &&
    Date.now() < tokenCache.expiresAt - 60_000;

// ─── Step 1: Fetch a fresh access token (client_credentials) ─────────────────

export const fetchAccessToken = async () => {
    const clientId = process.env.ADMITAD_CLIENT_ID;

    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id:  clientId,
        scope:      'advcampaigns_for_website coupons_for_website websites',
    });

    const response = await axios.post(`${BASE_URL}/token/`, params.toString(), {
        headers: {
            Authorization:  basicAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    const { access_token, refresh_token, expires_in } = response.data;

    tokenCache = {
        accessToken:  access_token,
        refreshToken: refresh_token,
        expiresAt:    Date.now() + expires_in * 1000,
    };

    console.log('[Admitad] Access token fetched. Expires in', expires_in, 'seconds.');
    return access_token;
};

// ─── Step 2: Refresh the access token using refresh_token ────────────────────

export const refreshAccessToken = async () => {
    const clientId     = process.env.ADMITAD_CLIENT_ID;
    const clientSecret = process.env.ADMITAD_CLIENT_SECRET;

    if (!tokenCache.refreshToken) {
        return fetchAccessToken();
    }

    const params = new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: tokenCache.refreshToken,
    });

    try {
        const response = await axios.post(`${BASE_URL}/token/`, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token, expires_in } = response.data;

        tokenCache = {
            accessToken:  access_token,
            refreshToken: refresh_token ?? tokenCache.refreshToken,
            expiresAt:    Date.now() + expires_in * 1000,
        };

        console.log('[Admitad] Token refreshed successfully.');
        return access_token;
    } catch (err) {
        console.error('[Admitad] Token refresh failed. Re-authenticating...', err.message);
        return fetchAccessToken();
    }
};

export const getToken = async () => {
    if (isTokenValid()) return tokenCache.accessToken;
    if (tokenCache.refreshToken) return refreshAccessToken();
    return fetchAccessToken();
};

// ─── Campaigns API with Chunking ──────────────────────────────────────────────

export const getAllCampaigns = async (couponsOnly = true) => {
    const token     = await getToken();
    const websiteId = process.env.ADMITAD_WEBSITE_ID;
    let   offset    = 0;
    const limit     = BATCH_SIZE;

    if (!websiteId) {
        throw new Error('[Admitad] ADMITAD_WEBSITE_ID is missing in environment variables.');
    }

    const endpoint = `${BASE_URL}/advcampaigns/website/${websiteId}/`;

    while (true) {
        const params = { limit, offset };
        if (couponsOnly) params.has_tool = 'coupons';

        const response = await limitedGet(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
            params,
        });

        const results = response.data?.results ?? [];
        if (results.length === 0) break;

        // Process chunk immediately
        await syncCampaignsAdmitad(results);

        offset += limit;
        const total = response.data?.count ?? Infinity;
        if (offset >= total) break;
    }
};

// ─── Coupons API with Chunking ────────────────────────────────────────────────

export const getAllCoupons = async () => {
    const token     = await getToken();
    const websiteId = process.env.ADMITAD_WEBSITE_ID;
    let   offset    = 0;
    const limit     = BATCH_SIZE;

    if (!websiteId) {
        throw new Error('[Admitad] ADMITAD_WEBSITE_ID is missing in environment variables.');
    }

    const endpoint = `${BASE_URL}/coupons/website/${websiteId}/`;

    while (true) {
        const response = await limitedGet(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
            params:  { limit, offset },
        });

        const results = response.data?.results ?? [];
        if (results.length === 0) break;

        // Process chunk immediately
        await syncAllCouponsAdmitad(results);

        offset += limit;
        const total = response.data?.count ?? Infinity;
        if (offset >= total) break;
    }
};

