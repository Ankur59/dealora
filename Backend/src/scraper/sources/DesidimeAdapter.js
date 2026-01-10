const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class DesidimeAdapter extends GenericAdapter {
    constructor() {
        super('Desidime', 'https://www.desidime.com');
    }

    async scrape() {
        const pages = [
            // Desidime uses /stores/{brand} path (not /stores/{brand}/coupons - redirects)
            // Target Apps from the list
            { brand: 'TWID', path: '/stores/twid', category: 'Wallet Rewards' },
            { brand: 'Pop', path: '/stores/pop', category: 'Wallet Rewards' },
            { brand: 'NPCL', path: '/stores/npcl', category: 'All' },
            { brand: 'Dhani', path: '/stores/dhani', category: 'Wallet Rewards' },
            { brand: 'Kiwi', path: '/stores/kiwi', category: 'Wallet Rewards' },
            { brand: 'Payzapp', path: '/stores/payzapp', category: 'Wallet Rewards' },
            { brand: 'Freo', path: '/stores/freo', category: 'Wallet Rewards' },
            { brand: 'Freecharge', path: '/stores/freecharge', category: 'Wallet Rewards' },
            { brand: 'BharatNxt', path: '/stores/bharatnxt', category: 'Wallet Rewards' },
            { brand: 'Sarvatra tech', path: '/stores/sarvatra', category: 'All' },
            { brand: 'Payworld', path: '/stores/payworld', category: 'Wallet Rewards' },
            { brand: 'Rio Money', path: '/stores/rio-money', category: 'Wallet Rewards' },
            { brand: 'Payinstacard', path: '/stores/payinstacard', category: 'Wallet Rewards' },
            { brand: 'nearwala', path: '/stores/nearwala', category: 'Grocery' },
            { brand: 'Limeroad', path: '/stores/limeroad', category: 'Grocery' },
            { brand: 'Shopclues', path: '/stores/shopclues', category: 'Grocery' },
            { brand: 'Snapdeal', path: '/stores/snapdeal', category: 'Grocery' },
            { brand: 'Eatsure', path: '/stores/eatsure', category: 'Food' },
            { brand: 'Box8', path: '/stores/box8', category: 'Food' },
            { brand: 'Rebel foods', path: '/stores/rebel-foods', category: 'Food' },
            { brand: 'Fassos', path: '/stores/fassos', category: 'Food' },
            { brand: 'Zingbus', path: '/stores/zingbus', category: 'Travel' },
            { brand: 'Satvacart', path: '/stores/satvacart', category: 'Grocery' },
            { brand: 'Dealshare', path: '/stores/dealshare', category: 'Grocery' },
            { brand: 'Salon Nayana', path: '/stores/salon-nayana', category: 'Beauty' },
            { brand: 'HR Wellness', path: '/stores/hr-wellness', category: 'Beauty' },
            { brand: 'Freshmenu', path: '/stores/freshmenu', category: 'Food' },
            // Popular brands (keeping for coverage)
            { brand: 'Zomato', path: '/stores/zomato', category: 'Food' },
            { brand: 'Swiggy', path: '/stores/swiggy', category: 'Food' },
            { brand: 'Amazon', path: '/stores/amazon', category: 'Grocery' },
            { brand: 'Flipkart', path: '/stores/flipkart', category: 'Grocery' },
            { brand: 'Myntra', path: '/stores/myntra', category: 'Fashion' },
            { brand: 'Nykaa', path: '/stores/nykaa', category: 'Beauty' },
            { brand: 'MakeMyTrip', path: '/stores/makemytrip', category: 'Travel' },
            { brand: 'Paytm', path: '/stores/paytm', category: 'Wallet Rewards' }
        ];

        let allCoupons = [];

        for (const page of pages) {
            try {
                logger.info(`DesidimeAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                
                // Skip if page not found (404)
                if (!html) {
                    logger.warn(`DesidimeAdapter: Skipping ${page.brand} - page not found`);
                    continue;
                }
                
                const $ = cheerio.load(html);
                let brandCoupons = 0;

                // Log first few lines of HTML to debug
                if (brandCoupons === 0 && html.length > 0) {
                    logger.debug(`DesidimeAdapter: HTML received for ${page.brand}, length: ${html.length}`);
                }

                // Desidime specific selectors - try multiple common patterns
                // Desidime uses various class names, try them all
                const selectors = [
                    '.deal-item', 
                    '.coupon-item', 
                    '.offer-box', 
                    '[data-deal-id]', 
                    '.deal-card',
                    '.deals-list-item',
                    '.store-deal',
                    '.deal',
                    'article.deal',
                    '[class*="deal"]',
                    '[class*="coupon"]'
                ];
                
                // Try to find any deals/coupons
                let foundElements = 0;
                selectors.forEach(selector => {
                    const elements = $(selector);
                    if (elements.length > 0) {
                        foundElements += elements.length;
                        logger.debug(`DesidimeAdapter: Found ${elements.length} elements with selector: ${selector} for ${page.brand}`);
                    }
                });
                
                if (foundElements === 0) {
                    logger.warn(`DesidimeAdapter: No coupon/deal elements found for ${page.brand} using standard selectors.`);
                    logger.warn(`DesidimeAdapter: This may mean: 1) Website structure changed, 2) Content is JavaScript-rendered (cheerio can't parse), 3) Website is blocking scrapers`);
                }

                // Try the most common selectors
                $('.deal-item, .coupon-item, .offer-box, [data-deal-id], .deal-card, .deals-list-item, .store-deal, article.deal').each((i, el) => {
                    const $el = $(el);
                    
                    // Try multiple selectors for title
                    const title = $el.find('.deal-title, .title, h2, h3, h4, [class*="title"]').first().text().trim() ||
                                 $el.find('a.deal-link, a').first().text().trim() ||
                                 $el.text().split('\n')[0].trim();

                    // Try multiple selectors for discount
                    const discount = $el.find('.deal-discount, .discount, .savings, [class*="discount"]').text().trim() ||
                                   $el.find('.badge, .tag, .label, [class*="badge"]').text().trim();

                    // Try multiple selectors for coupon code
                    const code = $el.find('.coupon-code, .code, .promo-code, [class*="code"]').text().trim() ||
                               $el.find('input.code-input, input[type="text"]').val() ||
                               $el.attr('data-code') ||
                               $el.attr('data-coupon-code');

                    // Try multiple selectors for description
                    const desc = $el.find('.deal-description, .description, .details, [class*="desc"]').text().trim() ||
                               $el.find('p').text().trim();

                    // Try multiple selectors for link
                    const link = $el.find('a.deal-link, a').attr('href') || 
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

                logger.info(`DesidimeAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`DesidimeAdapter Error for ${page.brand}: ${errorMsg}`);
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

module.exports = DesidimeAdapter;

