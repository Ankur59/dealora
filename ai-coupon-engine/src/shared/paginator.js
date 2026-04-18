/**
 * Shared Pagination Engines
 *
 * All functions share the same signature contract:
 *   - getAuth : async () => { headers, params }    — auth helper from apiKey.js or oauth2.js
 *   - onBatch : async (items[]) => void            — called per page; you call bulkWriteChunked here
 *   - itemsPath: dot-path to the items array in the API response ('' or null = response.data IS the array)
 *
 * ── Variants ──────────────────────────────────────────────────────────────────
 *   paginateOffset  → limit + offset (Admitad style)
 *   paginateCursor  → cursor / pageToken that advances on each request (vCommission style)
 *   paginatePage    → incrementing page number, stops when results are empty (trackier campaigns style)
 *   paginateNone    → single request, no pagination (Coupomated style)
 */

import limitedGet from '../config/axios.js';
import { getNestedValue } from './utils.js';

// ── Offset-based ─────────────────────────────────────────────────────────────

/**
 * @param {string}   endpoint
 * @param {Function} getAuth      — async () => { headers, params }
 * @param {Object}   params       — static extra query params
 * @param {string}   itemsPath    — dot-path to items array in response body
 * @param {string}   totalPath    — dot-path to total count in response body
 * @param {number}   batchSize    — records per request
 * @param {Function} onBatch      — async (items) => void
 */
export const paginateOffset = async ({
    endpoint,
    getAuth,
    params = {},
    itemsPath,
    totalPath,
    batchSize = 100,
    onBatch,
}) => {
    let offset = 0;

    while (true) {
        const { headers, params: authParams } = await getAuth();

        const response = await limitedGet(endpoint, {
            headers,
            params: { ...authParams, ...params, offset, limit: batchSize },
        });

        const items = getNestedValue(response.data, itemsPath) ?? [];
        if (!items.length) break;

        await onBatch(items);

        offset += batchSize;
        const total = getNestedValue(response.data, totalPath) ?? Infinity;
        if (offset >= total) break;
    }
};

// ── Cursor-based ─────────────────────────────────────────────────────────────

/**
 * @param {string}   cursorField  — param name sent in request AND response field that carries next cursor
 */
export const paginateCursor = async ({
    endpoint,
    getAuth,
    params = {},
    itemsPath,
    cursorField = 'pageToken',
    batchSize = 100,
    onBatch,
}) => {
    let cursor = '';
    let prevCursor = null;

    while (true) {
        const { headers, params: authParams } = await getAuth();

        const response = await limitedGet(endpoint, {
            headers,
            params: {
                ...authParams,
                ...params,
                ...(cursor && { [cursorField]: cursor }),
            },
        });

        const items = getNestedValue(response.data, itemsPath) ?? [];
        if (!items.length) break;

        await onBatch(items);

        prevCursor = cursor;
        cursor = getNestedValue(response.data, cursorField) ?? '';
        if (!cursor || cursor === prevCursor) break;
    }
};

// ── Page-number-based ────────────────────────────────────────────────────────

/**
 * @param {string}   pageParam    — query param name for the page number (default: 'page')
 */
export const paginatePage = async ({
    endpoint,
    getAuth,
    params = {},
    itemsPath,
    pageParam = 'page',
    batchSize = 100,
    onBatch,
}) => {
    let page = 1;

    while (true) {
        const { headers, params: authParams } = await getAuth();

        const response = await limitedGet(endpoint, {
            headers,
            params: { ...authParams, ...params, [pageParam]: page, limit: batchSize },
        });

        const items = getNestedValue(response.data, itemsPath) ?? [];
        if (!items.length) break;

        await onBatch(items);
        page++;
    }
};

// ── No pagination — single request ───────────────────────────────────────────

/**
 * For partners that return everything in one shot (e.g. Coupomated).
 * If itemsPath is empty/null and response.data is an array, uses it directly.
 */
export const paginateNone = async ({
    endpoint,
    getAuth,
    params = {},
    itemsPath = '',
    onBatch,
}) => {
    const { headers, params: authParams } = await getAuth();

    const response = await limitedGet(endpoint, {
        headers,
        params: { ...authParams, ...params },
    });

    const items = itemsPath
        ? getNestedValue(response.data, itemsPath) ?? []
        : (Array.isArray(response.data) ? response.data : []);

    if (items.length) await onBatch(items);
};
