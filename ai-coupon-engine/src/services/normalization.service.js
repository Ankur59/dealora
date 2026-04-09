import axios from 'axios';
import Partner from '../models/partners.model.js';
import Campaign from '../models/campaign.model.js';
import Coupon from '../models/coupon.model.js';
import { Category } from '../models/category.model.js';

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

/**
 * Fetches data from a partner API and normalizes it
 * @param {String} partnerName 
 * @param {String} targetSchema - 'campaign', 'coupon', or 'category'
 */
export const fetchAndNormalizePartnerData = async (partnerName, targetSchema) => {
    try {
        const partner = await Partner.findOne({ partnerName, status: 'active' });
        if (!partner) throw new Error(`Partner ${partnerName} not found or inactive`);

        // Find the matching API configuration for the requested target schema
        const apiConfig = partner.partnerApis.find(api => api.targetSchema === targetSchema);
        if (!apiConfig) throw new Error(`No active API configuration found for schema: ${targetSchema}`);

        const { apiUrl, apiType, apiParams, responseItemPath, apiDiff } = apiConfig;

        // Make the API request
        const requestOptions = {
            method: apiType,
            url: apiUrl,
            [apiType === 'GET' ? 'params' : 'data']: apiParams
        };

        const response = await axios(requestOptions);
        
        // Get the list of items from the response
        const items = responseItemPath ? getNestedValue(response.data, responseItemPath) : response.data;
        
        if (!Array.isArray(items)) {
            throw new Error(`Expected array of items at path '${responseItemPath}', got ${typeof items}`);
        }

        // Normalize each item
        const normalizedItems = items.map(item => normalizeData(item, apiDiff));
        
        // Save to DB depending on target schema
        if (normalizedItems.length > 0) {
            switch (targetSchema) {
                case 'campaign':
                    // Add partner field for reference
                    normalizedItems.forEach(i => i.partner = partnerName);
                    // Insert or update based on your logic (using insertMany or bulkWrite)
                    // For simplicity, we can do insertMany ignoring duplicates if handled, or loop and upsert
                    await Promise.all(normalizedItems.map(item => 
                        Campaign.findOneAndUpdate(
                            { partner: partnerName, campaignId: item.campaignId }, 
                            { $set: item }, 
                            { upsert: true, new: true }
                        )
                    ));
                    break;
                case 'coupon':
                    normalizedItems.forEach(i => i.partner = partnerName);
                    await Promise.all(normalizedItems.map(item => 
                        Coupon.findOneAndUpdate(
                            { partner: partnerName, couponId: item.couponId }, 
                            { $set: item }, 
                            { upsert: true, new: true }
                        )
                    ));
                    break;
                case 'category':
                    await Promise.all(normalizedItems.map(item => 
                        Category.findOneAndUpdate(
                            { apiId: item.apiId }, 
                            { $set: item }, 
                            { upsert: true, new: true }
                        )
                    ));
                    break;
            }
        }

        return {
            success: true,
            partner: partnerName,
            targetSchema,
            count: normalizedItems.length,
            data: normalizedItems
        };

    } catch (error) {
        console.error(`Normalization Error [${partnerName} -> ${targetSchema}]:`, error.message);
        throw error;
    }
};
