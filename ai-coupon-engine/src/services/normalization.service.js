import axios from 'axios';
import Partner from '../models/partners.model.js';
import Campaign from '../models/campaign.model.js';
import Coupon from '../models/coupon.model.js';
import { Category } from '../models/category.model.js';
import { getAllCampaigns, getAllCouponsVcom } from '../providers/trackier.js';
import campaign from '../models/campaign.model.js';

// Helper to get nested properties by string path (e.g. "data.items")
const getNestedValue = (obj, path) => {
    if (!path || !obj) return obj;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Apply type casting
const castValue = (value, type) => {
    if (value == null) return null;
    switch (type) {
        case 'String': return String(value);
        case 'Number': return Number(value);
        case 'Date': return new Date(value);
        case 'Boolean': return Boolean(value);
        case 'Array': return Array.isArray(value) ? value : [value];
        default: return value;
    }
};

/**
 * Normalizes an item from a partner's API response based on the defined apiDiff mappings
 * @param {Object} partnerItem - The raw item from the partner API
 * @param {Array} apiDiff - Array of apiDiffSchema rules
 * @returns {Object} Normalized object matching standard schema
 */
export const normalizeData = (partnerItem, apiDiff) => {
    const normalizedItem = {};

    apiDiff.forEach(rule => {
        const { standardField, partnerField, defaultValue, castTo } = rule;

        // Extract value from the partner item using the partnerField path
        let rawValue = getNestedValue(partnerItem, partnerField);

        // Fallback to default value if undefined or null
        if (rawValue == null && defaultValue !== undefined) {
            rawValue = defaultValue;
        }

        // Apply casting if a type is specified and value exists
        const finalValue = rawValue != null ? castValue(rawValue, castTo) : null;

        // Assign to the standard field
        normalizedItem[standardField] = finalValue;
    });

    return normalizedItem;
};


// Future changes: can also add handlers for revalidation to run the api we discussed about and diff changes
const handlerMap = {
    vcommission: {
        coupons: getAllCouponsVcom,
        campaigns: getAllCampaigns,
    },
    // When adding new partner add new key here like this 
    // coupomated: {
    //     coupons: "some function to fetch coupons"
    //     campaigns:"some other functio"
    // }
}
/**
 * Fetches data from a partner API and normalizes it
 * @param {String} partnerName 
 * @param {String} targetSchema - 'campaign', 'coupon', or 'category'
 */
export const fetchAndNormalizePartnerData = async (partnerName, targetSchema) => {
    try {
        const handler = handlerMap?.[partnerName]?.[targetSchema];

        if (!handler) {
            throw new Error(`No handler for ${partnerName} - ${targetSchema}`);
        }
        return await handler();
    }
    catch {
        console.log("something went wrong")
    }
};
