const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class CashkaroAdapter extends GenericAdapter {
    constructor() {
        super('Cashkaro', 'https://cashkaro.com');
    }

    /**
     * Convert brand name to URL-friendly slug
     * Example: "Amazon" -> "amazon", "Rebel foods" -> "rebel-foods"
     */
    brandToSlug(brand) {
        return brand.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    async scrape() {
        const brands = [
            // Target Apps from the list
            { brand: 'TWID', category: 'Wallet Rewards' },
            { brand: 'Pop', category: 'Wallet Rewards' },
            { brand: 'NPCL', category: 'All' },
            { brand: 'Dhani', category: 'Wallet Rewards' },
            { brand: 'Kiwi', category: 'Wallet Rewards' },
            { brand: 'Payzapp', category: 'Wallet Rewards' },
            { brand: 'Freo', category: 'Wallet Rewards' },
            { brand: 'Freecharge', category: 'Wallet Rewards' },
            { brand: 'BharatNxt', category: 'Wallet Rewards' },
            { brand: 'Sarvatra tech', category: 'All' },
            { brand: 'Payworld', category: 'Wallet Rewards' },
            { brand: 'Rio Money', category: 'Wallet Rewards' },
            { brand: 'Payinstacard', category: 'Wallet Rewards' },
            { brand: 'nearwala', category: 'Grocery' },
            { brand: 'Limeroad', category: 'Grocery' },
            { brand: 'Shopclues', category: 'Grocery' },
            { brand: 'Snapdeal', category: 'Grocery' },
            { brand: 'Eatsure', category: 'Food' },
            { brand: 'Box8', category: 'Food' },
            { brand: 'Rebel foods', category: 'Food' },
            { brand: 'Fassos', category: 'Food' },
            { brand: 'Zingbus', category: 'Travel' },
            { brand: 'Satvacart', category: 'Grocery' },
            { brand: 'Dealshare', category: 'Grocery' },
            { brand: 'Salon Nayana', category: 'Beauty' },
            { brand: 'HR Wellness', category: 'Beauty' },
            { brand: 'Freshmenu', category: 'Food' },
            // Popular brands (keeping for coverage)
            { brand: 'Zomato', category: 'Food' },
            { brand: 'Swiggy', category: 'Food' },
            { brand: 'Amazon', category: 'Grocery' },
            { brand: 'Flipkart', category: 'Grocery' },
            { brand: 'Myntra', category: 'Fashion' },
            { brand: 'Nykaa', category: 'Beauty' },
            { brand: 'MakeMyTrip', category: 'Travel' },
            { brand: 'Paytm', category: 'Wallet Rewards' }
        ];

        // Convert to pages with correct URL format: /stores/brand (e.g., /stores/amazon)
        const pages = brands.map(b => ({
            brand: b.brand,
            path: `/stores/${this.brandToSlug(b.brand)}`,
            category: b.category
        }));

        let allCoupons = [];

        for (const page of pages) {
            try {
                logger.info(`CashkaroAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                
                // Skip if page not found (404)
                if (!html) {
                    logger.warn(`CashkaroAdapter: Skipping ${page.brand} - page not found (404). Path may be incorrect: ${this.baseUrl}${page.path}`);
                    logger.warn(`CashkaroAdapter: Note - Cashkaro website structure may have changed. These paths may not exist.`);
                    continue;
                }
                
                const $ = cheerio.load(html);
                let brandCoupons = 0;

                // Cashkaro specific selectors
                $('.coupon-card, .offer-card, .deal-card, [class*="coupon"], [class*="offer"]').each((i, el) => {
                    const $el = $(el);
                    
                    // Try multiple selectors for title
                    const title = $el.find('.coupon-title, .offer-title, .deal-title, h3, h4, .title').first().text().trim() ||
                                 $el.find('a').first().text().trim() ||
                                 $el.text().split('\n')[0].trim();

                    // Try multiple selectors for discount
                    const discount = $el.find('.discount-amount, .discount, .offer-amount, [class*="discount"]').text().trim() ||
                                   $el.find('.cashback, .savings, [class*="cashback"]').text().trim() ||
                                   $el.find('.badge, .tag').text().trim();

                    // Try multiple selectors for coupon code
                    const code = $el.find('.coupon-code-text, .code-text, .promo-code, [class*="code"]').text().trim() ||
                               $el.find('input.code-input, input[type="text"]').val() ||
                               $el.attr('data-code') ||
                               $el.find('.copy-code').attr('data-code');

                    // Try multiple selectors for description
                    const desc = $el.find('.coupon-description, .description, .details, [class*="desc"]').text().trim() ||
                               $el.find('p').text().trim();

                    // Try multiple selectors for link
                    const link = $el.find('a.get-deal, a.coupon-link, a').attr('href') || 
                               $el.attr('href') ||
                               this.baseUrl + page.path;

                    if (title && title.length > 3) {
                        allCoupons.push({
                            brandName: page.brand,
                            couponTitle: title,
                            description: desc || title,
                            couponCode: code || null,
                            discountType: this.inferDiscountType(title + ' ' + discount),
                            discountValue: discount || this.extractDiscountValue(title),
                            category: page.category,
                            couponLink: link.startsWith('http') ? link : this.baseUrl + link,
                        });
                        brandCoupons++;
                    }
                });

                logger.info(`CashkaroAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`CashkaroAdapter Error for ${page.brand}: ${errorMsg}`);
                // Continue with next brand even if one fails
            }
        }

        return allCoupons;
    }

    inferDiscountType(text) {
        text = text.toLowerCase();
        if (text.includes('%') || text.includes('percent')) return 'percentage';
        if (text.includes('₹') || text.includes('rs') || text.includes('off')) return 'flat';
        if (text.includes('cashback')) return 'cashback';
        if (text.includes('free')) return 'freebie';
        return 'unknown';
    }

    extractDiscountValue(text) {
        const match = text.match(/(\d+%\s*OFF|\d+\s*%)/i) || text.match(/(₹|Rs\.?)\s*\d+/i);
        return match ? match[0] : null;
    }
}

module.exports = CashkaroAdapter;

