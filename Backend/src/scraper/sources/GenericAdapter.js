const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../../utils/logger');
const geminiExtractionService = require('../../services/geminiExtractionService');

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
            // Handle axios errors properly
            if (error.response) {
                // Server responded with error status
                const status = error.response.status;
                const statusText = error.response.statusText || 'Unknown Error';
                const errorMsg = `Request failed with status ${status} (${statusText})`;

                // Don't throw for 404s, just log and return null
                if (status === 404) {
                    logger.warn(`${this.sourceName}: Page not found (404) - ${endpoint}`);
                    return null;
                }

                logger.error(`${this.sourceName}: ${errorMsg} - ${endpoint}`);
                throw new Error(errorMsg);
            } else if (error.request) {
                // Request was made but no response received
                logger.error(`${this.sourceName}: No response received - ${endpoint}`);
                throw new Error('No response received from server');
            } else {
                // Error setting up the request
                logger.error(`${this.sourceName}: ${error.message} - ${endpoint}`);
                throw error;
            }
        }
    }

    /**
     * Map raw data to standardized coupon object using Gemini AI for intelligent extraction
     * Gemini will properly segregate fields (couponName, couponCode, couponDetails, etc.)
     */
    async normalize(rawData) {
        try {
            // First, use Gemini AI to intelligently extract and segregate coupon data
            logger.info(`Using Gemini AI to extract and segregate coupon data for: ${rawData.couponTitle || rawData.couponName || 'Unknown'}`);
            const extractedData = await geminiExtractionService.extractCouponData(rawData);

            // Apply basic normalization on top of Gemini's extracted data
            const title = extractedData.couponName?.trim() || extractedData.couponTitle?.trim() || 'Exciting Offer';
            const brand = this.normalizeBrand(extractedData.brandName || rawData.brandName);

            // Ensure description is at least 10 chars for model validation
            let description = extractedData.description?.trim() || extractedData.couponTitle?.trim() || title;
            if (description.length < 10) {
                description = `${description} - Limited time offer from ${brand}`;
            }

            // Determine coupon code - prefer Gemini extraction, fallback to normalized raw data
            let finalCouponCode = extractedData.couponCode || null;
            if (!finalCouponCode && rawData.couponCode) {
                finalCouponCode = this.normalizeCode(rawData.couponCode);
            }

            // Build final normalized object
            const normalized = {
                userId: 'system_scraper',
                couponName: (extractedData.couponName || title).substring(0, 100),
                brandName: brand,
                couponTitle: (extractedData.couponTitle || title).substring(0, 200),
                description: description.substring(0, 1000),
                couponCode: finalCouponCode,
                discountType: extractedData.discountType || this.normalizeDiscountType(rawData.discountType),
                discountValue: extractedData.discountValue || rawData.discountValue || null,
                expireBy: extractedData.expireBy ? new Date(extractedData.expireBy) : (rawData.expireBy ? new Date(rawData.expireBy) : this.getDefaultExpiry()),
                categoryLabel: extractedData.categoryLabel || this.normalizeCategory(extractedData.category || rawData.category),
                couponVisitingLink: extractedData.couponVisitingLink || rawData.couponLink || this.baseUrl,
                sourceWebsite: this.sourceName,
                addedMethod: 'scraper',
                useCouponVia: extractedData.useCouponVia || (finalCouponCode ? 'Coupon Code' : (extractedData.couponVisitingLink ? 'Coupon Visiting Link' : 'None')),
                status: 'active',
                couponDetails: extractedData.couponDetails || rawData.terms || null,
                terms: rawData.terms || extractedData.couponDetails || null, // Add terms field
                minimumOrder: extractedData.minimumOrder || rawData.minimumOrder || null,
            };

            logger.info(`Successfully normalized coupon: ${normalized.couponName} (Code: ${normalized.couponCode || 'N/A'}, Link: ${normalized.couponVisitingLink ? 'Yes' : 'No'})`);
            return normalized;

        } catch (error) {
            logger.error(`Error in normalize with Gemini: ${error.message}. Using fallback normalization.`);

            // Fallback to basic normalization if Gemini fails
            const title = rawData.couponTitle?.trim() || 'Exciting Offer';
            const brand = this.normalizeBrand(rawData.brandName);
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
                terms: rawData.terms || null, // Add terms field in fallback too
            };
        }
    }

    normalizeBrand(brand) {
        if (!brand) return 'General';
        return brand.split(' ')[0].trim();
    }

    normalizeCode(code) {
        if (!code || typeof code !== 'string' || code === 'Show Coupon Code') return null;

        let cleanCode = code.toString().toUpperCase().trim();

        // Remove common non-code phrases
        cleanCode = cleanCode.replace(/(SHOW CODE|CLICK HERE|REVEAL CODE|COPY CODE|GET CODE|GET DEAL|ACTIVATE OFFER)/gi, '').trim();

        // Remove special characters and spaces - codes should be alphanumeric only
        cleanCode = cleanCode.replace(/[^A-Z0-9]/g, '');

        // Validate length - real coupon codes are typically 3-20 characters
        // If it's longer than 20 chars, it's likely not a real code (probably scraped description/title)
        if (cleanCode.length < 3 || cleanCode.length > 20) {
            return null;
        }

        // Must have at least one letter or number
        if (!/[A-Z0-9]/.test(cleanCode)) {
            return null;
        }

        return cleanCode;
    }

    normalizeDiscountType(type) {
        const types = ['percentage', 'flat', 'cashback', 'freebie'];
        const lowerType = type?.toLowerCase();
        return types.includes(lowerType) ? lowerType : 'unknown';
    }

    normalizeCategory(category) {
        const validCategories = ['Food', 'Fashion', 'Grocery', 'Wallet Rewards', 'Beauty', 'Travel', 'Entertainment', 'Other'];
        const found = validCategories.find(c => c.toLowerCase() === category?.toLowerCase());
        return found || 'Other';
    }

    getDefaultExpiry() {
        const date = new Date();
        date.setDate(date.getDate() + 30); // Default 30 days
        return date;
    }

    /**
     * Get the actual brand website URL from brand name
     * This ensures couponLink points to the actual brand website, not the source scraper site
     */
    getBrandUrl(brandName) {
        const brandUrls = {
            // Food Delivery
            'Zomato': 'https://www.zomato.com',
            'Swiggy': 'https://www.swiggy.com',
            'Fassos': 'https://www.fassos.com',
            'Eatsure': 'https://www.eatsure.com',
            'Box8': 'https://www.box8.in',
            'Rebel foods': 'https://www.rebelfoods.com',
            'Freshmenu': 'https://www.freshmenu.com',
            'FreshMenu': 'https://www.freshmenu.com',
            
            // E-commerce & Shopping
            'Amazon': 'https://www.amazon.in',
            'Flipkart': 'https://www.flipkart.com',
            'Myntra': 'https://www.myntra.com',
            'Snapdeal': 'https://www.snapdeal.com',
            'Shopclues': 'https://www.shopclues.com',
            'Limeroad': 'https://www.limeroad.com',
            'Nykaa': 'https://www.nykaa.com',
            'Meesho': 'https://www.meesho.com',
            'Ajio': 'https://www.ajio.com',
            
            // Wallet & Payment Apps
            'Paytm': 'https://www.paytm.com',
            'PhonePe': 'https://www.phonepe.com',
            'Freecharge': 'https://www.freecharge.in',
            'MobiKwik': 'https://www.mobikwik.com',
            'TWID': 'https://www.twid.app',
            'Pop': 'https://www.getpop.in',
            'Dhani': 'https://www.dhani.com',
            'Kiwi': 'https://www.kiwi.money',
            'Payzapp': 'https://www.payzapp.com',
            'Freo': 'https://www.freo.money',
            'BharatNxt': 'https://www.bharatnxt.com',
            'Payworld': 'https://www.payworld.in',
            'Rio Money': 'https://www.riomoney.in',
            'Payinstacard': 'https://www.payinstacard.com',
            
            // Grocery & Daily Needs
            'BigBasket': 'https://www.bigbasket.com',
            'Blinkit': 'https://www.blinkit.com',
            'Zepto': 'https://www.zeptonow.com',
            'Dunzo': 'https://www.dunzo.com',
            'Grofers': 'https://www.grofers.com',
            'Dealshare': 'https://www.dealshare.in',
            'Satvacart': 'https://www.satvacart.com',
            'nearwala': 'https://www.nearwala.com',
            
            // Travel & Transportation
            'MakeMyTrip': 'https://www.makemytrip.com',
            'Goibibo': 'https://www.goibibo.com',
            'Cleartrip': 'https://www.cleartrip.com',
            'Uber': 'https://www.uber.com',
            'Ola': 'https://www.olacabs.com',
            'Rapido': 'https://www.rapido.bike',
            'redBus': 'https://www.redbus.in',
            'Zingbus': 'https://www.zingbus.com',
            'Yatra': 'https://www.yatra.com',
            'EaseMyTrip': 'https://www.easemytrip.com',
            'Ixigo': 'https://www.ixigo.com',
            
            // Beauty & Wellness
            'Purplle': 'https://www.purplle.com',
            'Salon Nayana': 'https://www.salonnayana.com',
            'HR Wellness': 'https://www.hrwellness.in',
            'UrbanClap': 'https://www.urbancompany.com',
            'Cult.fit': 'https://www.cult.fit',
            
            // Entertainment & OTT
            'BookMyShow': 'https://www.bookmyshow.com',
            'Netflix': 'https://www.netflix.com',
            'Amazon Prime': 'https://www.primevideo.com',
            'Disney+ Hotstar': 'https://www.hotstar.com',
            'Zee5': 'https://www.zee5.com',
            'SonyLiv': 'https://www.sonyliv.com',
            
            // Others
            'NPCL': 'https://www.npci.org.in',
            'Sarvatra tech': 'https://www.sarvatra.in',
        };
        
        // Try exact match first
        if (brandUrls[brandName]) {
            return brandUrls[brandName];
        }
        
        // Try case-insensitive match
        const brandKey = Object.keys(brandUrls).find(
            key => key.toLowerCase() === brandName.toLowerCase()
        );
        
        if (brandKey) {
            return brandUrls[brandKey];
        }
        
        // Fallback: return null to use source website
        return null;
    }

    /**
     * Abstract method to be implemented by subclasses
     */
    async scrape() {
        throw new Error('Method scrape() must be implemented');
    }
}

module.exports = GenericAdapter;
