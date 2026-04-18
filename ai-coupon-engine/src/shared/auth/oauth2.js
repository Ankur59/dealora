/**
 * Generic OAuth2 Client-Credentials Manager
 *
 * Creates an isolated token manager per partner (keyed by partnerName).
 * Handles: initial fetch, expiry check, auto-refresh, fallback re-auth.
 *
 * Returns:
 *   manager.getToken()  → Promise<string>  (raw access token)
 *   manager.getAuth()   → Promise<{ headers, params }>  (paginator-compatible)
 *
 * Usage:
 *   const oauth2 = createOAuth2Manager({
 *     partnerName:     'admitad',
 *     tokenUrl:        'https://api.admitad.com/token/',
 *     clientIdEnv:     'ADMITAD_CLIENT_ID',
 *     clientSecretEnv: 'ADMITAD_CLIENT_SECRET',
 *     scopes:          'advcampaigns_for_website coupons_for_website',
 *   });
 *
 *   const { headers } = await oauth2.getAuth();
 *   // headers → { Authorization: 'Bearer eyJ...' }
 */

import axios from 'axios';

// One cache entry per partner — survives across requests within the process lifetime
const _caches = {};

export const createOAuth2Manager = ({
    partnerName,
    tokenUrl,
    clientIdEnv,
    clientSecretEnv,
    scopes = '',
}) => {
    // ── Init cache slot ────────────────────────────────────────────────────────
    if (!_caches[partnerName]) {
        _caches[partnerName] = { accessToken: null, refreshToken: null, expiresAt: null };
    }
    const cache = _caches[partnerName];

    // ── Helpers ────────────────────────────────────────────────────────────────
    const isValid = () =>
        cache.accessToken && cache.expiresAt && Date.now() < cache.expiresAt - 60_000;

    const basicHeader = () => {
        const id     = process.env[clientIdEnv];
        const secret = process.env[clientSecretEnv];
        return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
    };

    const _storeToken = ({ access_token, refresh_token, expires_in }) => {
        cache.accessToken  = access_token;
        cache.refreshToken = refresh_token ?? cache.refreshToken;
        cache.expiresAt    = Date.now() + expires_in * 1000;
    };

    // ── Step 1: Client-credentials fetch ──────────────────────────────────────
    const fetchToken = async () => {
        const id     = process.env[clientIdEnv];
        const body   = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, scope: scopes });

        const { data } = await axios.post(tokenUrl, body.toString(), {
            headers: { Authorization: basicHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        _storeToken(data);
        console.log(`[OAuth2:${partnerName}] Token fetched. Expires in ${data.expires_in}s.`);
        return cache.accessToken;
    };

    // ── Step 2: Refresh ────────────────────────────────────────────────────────
    const refreshToken = async () => {
        if (!cache.refreshToken) return fetchToken();

        const id     = process.env[clientIdEnv];
        const secret = process.env[clientSecretEnv];
        const body   = new URLSearchParams({
            grant_type:    'refresh_token',
            client_id:     id,
            client_secret: secret,
            refresh_token: cache.refreshToken,
        });

        try {
            const { data } = await axios.post(tokenUrl, body.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            _storeToken(data);
            console.log(`[OAuth2:${partnerName}] Token refreshed.`);
            return cache.accessToken;
        } catch (err) {
            console.error(`[OAuth2:${partnerName}] Refresh failed, re-authenticating.`, err.message);
            return fetchToken();
        }
    };

    // ── Public API ─────────────────────────────────────────────────────────────
    const getToken = async () => {
        if (isValid())           return cache.accessToken;
        if (cache.refreshToken)  return refreshToken();
        return fetchToken();
    };

    /**
     * Paginator-compatible auth accessor.
     * Returns { headers: { Authorization: 'Bearer ...' }, params: {} }
     */
    const getAuth = async () => ({
        headers: { Authorization: `Bearer ${await getToken()}` },
        params:  {},
    });

    return { getToken, getAuth };
};
