const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../../utils/logger');

class GenericAdapter {
    constructor(sourceName, baseUrl) {
        this.sourceName = sourceName;
        this.baseUrl = baseUrl;

        this.client = axios.create({
            baseURL: baseUrl,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        axiosRetry(this.client, {
            retries: 3,
            retryDelay: axiosRetry.exponentialDelay,
            onRetry: (retryCount, error) => {
                logger.warn(`Retry attempt ${retryCount} for ${this.sourceName}: ${error.message}`);
            }
        });
    }

    /**
     * Fetch HTML from a URL
     */
    async fetchHtml(endpoint) {
        try {
            const response = await this.client.get(endpoint);
            return response.data;
        } catch (error) {
            logger.error(`Error fetching from ${this.sourceName} (${endpoint}):`, error.message);
            throw error;
        }
    }

    /**
     * Map raw data to standardized coupon object
     * Should be overridden by subclasses
     */
    normalize(rawData) {
        const title = rawData.couponTitle?.trim() || 'Exciting Offer';
        const brand = this.normalizeBrand(rawData.brandName);

        // Ensure description is at least 10 chars for model validation
        let description = rawData.description?.trim() || title;
        if (description.length < 10) {
            description = `${description} - Limited time offer from ${brand}`;
        }

        return {
            userId: 'system_scraper',
            couponName: title.substring(0, 100),
            brandName: brand,
            couponTitle: title.substring(0, 200),
            description: description.substring(0, 1000),
            couponCode: this.normalizeCode(rawData.couponCode),
            discountType: this.normalizeDiscountType(rawData.discountType),
            discountValue: rawData.discountValue,
            expireBy: rawData.expireBy ? new Date(rawData.expireBy) : this.getDefaultExpiry(),
            categoryLabel: this.normalizeCategory(rawData.category),
            couponVisitingLink: rawData.couponLink || this.baseUrl,
            sourceWebsite: this.sourceName,
            addedMethod: 'scraper',
            useCouponVia: rawData.couponCode ? 'Coupon Code' : 'Coupon Visiting Link',
            status: 'active',
            couponDetails: rawData.terms || null,
        };
    }

    normalizeBrand(brand) {
        if (!brand) return 'General';
        // Simple normalization: "Zomato Offers" -> "Zomato"
        return brand.split(' ')[0].trim();
    }

    normalizeCode(code) {
        if (!code || code === 'Show Coupon Code') return null;
        let cleanCode = code.toString().toUpperCase().trim();
        return cleanCode.substring(0, 50);
    }

    normalizeDiscountType(type) {
        const types = ['percentage', 'flat', 'cashback', 'freebie'];
        const lowerType = type?.toLowerCase();
        return types.includes(lowerType) ? lowerType : 'unknown';
    }

    normalizeCategory(category) {
        const validCategories = ['Food', 'Fashion', 'Electronics', 'Travel', 'Health', 'Beauty', 'Payment', 'Other'];
        const found = validCategories.find(c => c.toLowerCase() === category?.toLowerCase());
        return found || 'Other';
    }

    getDefaultExpiry() {
        const date = new Date();
        date.setDate(date.getDate() + 30); // Default 30 days
        return date;
    }

    /**
     * Abstract method to be implemented by subclasses
     */
    async scrape() {
        throw new Error('Method scrape() must be implemented');
    }
}

module.exports = GenericAdapter;
