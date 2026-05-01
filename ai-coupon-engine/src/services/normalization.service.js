import { adapters } from '../adapters/index.js';
import { getNestedValue } from '../shared/utils.js';

// ── Type casting utility (kept for partner controller's schema-diff flow) ─────

const castValue = (value, type) => {
    if (value == null) return null;
    switch (type) {
        case 'String':  return String(value);
        case 'Number':  return Number(value);
        case 'Date':    return new Date(value);
        case 'Boolean': return Boolean(value);
        case 'Array':   return Array.isArray(value) ? value : [value];
        default:        return value;
    }
};

/**
 * Normalizes a raw item using the partner's apiDiff field-mapping rules.
 * Used by the partner controller's schema-diff / manual mapping flow.
 *
 * @param {Object} partnerItem - Raw item from partner API
 * @param {Array}  apiDiff     - Array of { standardField, partnerField, defaultValue, castTo }
 * @returns {Object} Normalized object
 */
export const normalizeData = (partnerItem, apiDiff) => {
    const result = {};
    for (const { standardField, partnerField, defaultValue, castTo } of apiDiff) {
        let raw = getNestedValue(partnerItem, partnerField);
        if (raw == null && defaultValue !== undefined) raw = defaultValue;
        result[standardField] = raw != null ? castValue(raw, castTo) : null;
    }
    return result;
};

/**
 * Routes a sync request to the correct adapter method.
 *
 * Supported targetSchema values per adapter:
 *   'campaigns'  → adapter.syncCampaigns()
 *   'coupons'    → adapter.syncCoupons()
 *   'categories' → adapter.syncCategories()
 *
 * Adding a new partner: create adapter + add to src/adapters/index.js.
 * No changes needed here.
 *
 * @param {string} partnerName   - e.g. 'admitad', 'coupomated', 'vcommission'
 * @param {string} targetSchema  - e.g. 'campaigns', 'coupons', 'categories'
 */
export const fetchAndNormalizePartnerData = async (partnerName, targetSchema) => {
    const adapter = adapters[partnerName];
    if (!adapter) {
        throw new Error(`[Normalization] No adapter registered for partner: "${partnerName}"`);
    }

    // Map targetSchema → adapter method name
    // Accepts both singular ('coupon') and plural ('coupons') for convenience
    const schema     = targetSchema.endsWith('s') ? targetSchema : targetSchema + 's';
    const methodName = `sync${schema.charAt(0).toUpperCase()}${schema.slice(1)}`;

    const method = adapter[methodName];
    if (typeof method !== 'function') {
        throw new Error(
            `[Normalization] Adapter "${partnerName}" has no method "${methodName}". ` +
            `Available: ${Object.getOwnPropertyNames(adapter).filter(k => k.startsWith('sync')).join(', ')}`
        );
    }

    try {
        console.log(`[Normalization] Starting ${partnerName}.${methodName}()`);
        await method.call(adapter);
        console.log(`[Normalization] Completed ${partnerName}.${methodName}()`);
    } catch (err) {
        console.error(`[Normalization] ${partnerName}.${methodName}() failed:`, err.message);
        throw err;
    }
};
