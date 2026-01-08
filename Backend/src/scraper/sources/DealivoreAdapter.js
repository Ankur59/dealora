const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class DealivoreAdapter extends GenericAdapter {
    constructor() {
        super('Dealivore', 'https://www.dealivore.com');
    }

    async scrape() {
        const pages = [
            // Target Apps from the list
            { brand: 'TWID', path: '/twid-coupons', category: 'Wallet Rewards' },
            { brand: 'Pop', path: '/pop-coupons', category: 'Wallet Rewards' },
            { brand: 'NPCL', path: '/npcl-coupons', category: 'All' },
            { brand: 'Dhani', path: '/dhani-coupons', category: 'Wallet Rewards' },
            { brand: 'Kiwi', path: '/kiwi-coupons', category: 'Wallet Rewards' },
            { brand: 'Payzapp', path: '/payzapp-coupons', category: 'Wallet Rewards' },
            { brand: 'Freo', path: '/freo-coupons', category: 'Wallet Rewards' },
            { brand: 'Freecharge', path: '/freecharge-coupons', category: 'Wallet Rewards' },
            { brand: 'BharatNxt', path: '/bharatnxt-coupons', category: 'Wallet Rewards' },
            { brand: 'Sarvatra tech', path: '/sarvatra-coupons', category: 'All' },
            { brand: 'Payworld', path: '/payworld-coupons', category: 'Wallet Rewards' },
            { brand: 'Rio Money', path: '/rio-money-coupons', category: 'Wallet Rewards' },
            { brand: 'Payinstacard', path: '/payinstacard-coupons', category: 'Wallet Rewards' },
            { brand: 'nearwala', path: '/nearwala-coupons', category: 'Grocery' },
            { brand: 'Limeroad', path: '/limeroad-coupons', category: 'Grocery' },
            { brand: 'Shopclues', path: '/shopclues-coupons', category: 'Grocery' },
            { brand: 'Snapdeal', path: '/snapdeal-coupons', category: 'Grocery' },
            { brand: 'Eatsure', path: '/eatsure-coupons', category: 'Food' },
            { brand: 'Box8', path: '/box8-coupons', category: 'Food' },
            { brand: 'Rebel foods', path: '/rebel-foods-coupons', category: 'Food' },
            { brand: 'Fassos', path: '/fassos-coupons', category: 'Food' },
            { brand: 'Zingbus', path: '/zingbus-coupons', category: 'Travel' },
            { brand: 'Satvacart', path: '/satvacart-coupons', category: 'Grocery' },
            { brand: 'Dealshare', path: '/dealshare-coupons', category: 'Grocery' },
            { brand: 'Salon Nayana', path: '/salon-nayana-coupons', category: 'Beauty' },
            { brand: 'HR Wellness', path: '/hr-wellness-coupons', category: 'Beauty' },
            { brand: 'Freshmenu', path: '/freshmenu-coupons', category: 'Food' },
            // Popular brands (keeping for coverage)
            { brand: 'Zomato', path: '/zomato-coupons', category: 'Food' },
            { brand: 'Swiggy', path: '/swiggy-coupons', category: 'Food' },
            { brand: 'Amazon', path: '/amazon-coupons', category: 'Grocery' },
            { brand: 'Flipkart', path: '/flipkart-coupons', category: 'Grocery' },
            { brand: 'Myntra', path: '/myntra-coupons', category: 'Fashion' },
            { brand: 'Nykaa', path: '/nykaa-coupons', category: 'Beauty' },
            { brand: 'MakeMyTrip', path: '/makemytrip-coupons', category: 'Travel' },
            { brand: 'Paytm', path: '/paytm-coupons', category: 'Wallet Rewards' }
        ];

        let allCoupons = [];

        for (const page of pages) {
            try {
                logger.info(`DealivoreAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                
                // Skip if page not found (404)
                if (!html) {
                    logger.warn(`DealivoreAdapter: Skipping ${page.brand} - page not found`);
                    continue;
                }
                
                const $ = cheerio.load(html);
                let brandCoupons = 0;

                // Dealivore specific selectors
                $('.deal-item, .coupon-item, .offer-item, [class*="deal"], [class*="coupon"]').each((i, el) => {
                    const $el = $(el);
                    
                    // Try multiple selectors for title
                    const title = $el.find('.deal-title, .coupon-title, .offer-title, h2, h3, h4, .title').first().text().trim() ||
                                 $el.find('a').first().text().trim() ||
                                 $el.text().split('\n')[0].trim();

                    // Try multiple selectors for discount
                    const discount = $el.find('.deal-discount, .discount, .offer-discount, [class*="discount"]').text().trim() ||
                                   $el.find('.savings, .offer-amount, [class*="savings"]').text().trim() ||
                                   $el.find('.badge, .tag, .label').text().trim();

                    // Try multiple selectors for coupon code
                    const code = $el.find('.coupon-code, .code, .promo-code, [class*="code"]').text().trim() ||
                               $el.find('input[type="text"], input.code-input').val() ||
                               $el.attr('data-code') ||
                               $el.attr('data-coupon');

                    // Try multiple selectors for description
                    const desc = $el.find('.deal-description, .description, .details, [class*="desc"]').text().trim() ||
                               $el.find('p').text().trim();

                    // Try multiple selectors for link
                    const link = $el.find('a.deal-link, a.coupon-link, a').attr('href') || 
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

                logger.info(`DealivoreAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`DealivoreAdapter Error for ${page.brand}: ${errorMsg}`);
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

module.exports = DealivoreAdapter;

