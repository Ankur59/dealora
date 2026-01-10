const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class CouponDekhoAdapter extends GenericAdapter {
    constructor() {
        super('CouponDekho', 'https://www.coupondekho.co.in');
    }

    async scrape() {
        const pages = [
            // Target Apps from the list
            { brand: 'TWID', path: '/store/twid-coupons/', category: 'Wallet Rewards' },
            { brand: 'Pop', path: '/store/pop-coupons/', category: 'Wallet Rewards' },
            { brand: 'NPCL', path: '/store/npcl-coupons/', category: 'All' },
            { brand: 'Dhani', path: '/store/dhani-coupons/', category: 'Wallet Rewards' },
            { brand: 'Kiwi', path: '/store/kiwi-coupons/', category: 'Wallet Rewards' },
            { brand: 'Payzapp', path: '/store/payzapp-coupons/', category: 'Wallet Rewards' },
            { brand: 'Freo', path: '/store/freo-coupons/', category: 'Wallet Rewards' },
            { brand: 'Freecharge', path: '/store/freecharge-coupons/', category: 'Wallet Rewards' },
            { brand: 'BharatNxt', path: '/store/bharatnxt-coupons/', category: 'Wallet Rewards' },
            { brand: 'Sarvatra tech', path: '/store/sarvatra-coupons/', category: 'All' },
            { brand: 'Payworld', path: '/store/payworld-coupons/', category: 'Wallet Rewards' },
            { brand: 'Rio Money', path: '/store/rio-money-coupons/', category: 'Wallet Rewards' },
            { brand: 'Payinstacard', path: '/store/payinstacard-coupons/', category: 'Wallet Rewards' },
            { brand: 'nearwala', path: '/store/nearwala-coupons/', category: 'Grocery' },
            { brand: 'Limeroad', path: '/store/limeroad-coupons/', category: 'Grocery' },
            { brand: 'Shopclues', path: '/store/shopclues-coupons/', category: 'Grocery' },
            { brand: 'Snapdeal', path: '/store/snapdeal-coupons/', category: 'Grocery' },
            { brand: 'Eatsure', path: '/store/eatsure-coupons/', category: 'Food' },
            { brand: 'Box8', path: '/store/box8-coupons/', category: 'Food' },
            { brand: 'Rebel foods', path: '/store/rebel-foods-coupons/', category: 'Food' },
            { brand: 'Fassos', path: '/store/fassos-coupons/', category: 'Food' },
            { brand: 'Zingbus', path: '/store/zingbus-coupons/', category: 'Travel' },
            { brand: 'Satvacart', path: '/store/satvacart-coupons/', category: 'Grocery' },
            { brand: 'Dealshare', path: '/store/dealshare-coupons/', category: 'Grocery' },
            { brand: 'Salon Nayana', path: '/store/salon-nayana-coupons/', category: 'Beauty' },
            { brand: 'HR Wellness', path: '/store/hr-wellness-coupons/', category: 'Beauty' },
            { brand: 'Freshmenu', path: '/store/freshmenu-coupons/', category: 'Food' },
            // Popular brands (keeping for coverage)
            { brand: 'Zomato', path: '/store/zomato/', category: 'Food' },
            { brand: 'Swiggy', path: '/store/swiggy/', category: 'Food' },
            { brand: 'Amazon', path: '/store/amazon-coupons/', category: 'Grocery' },
            { brand: 'Flipkart', path: '/store/flipkart-coupons/', category: 'Grocery' },
            { brand: 'Myntra', path: '/store/myntra-coupons/', category: 'Fashion' },
            { brand: 'Nykaa', path: '/store/nykaa-coupons/', category: 'Beauty' },
            { brand: 'MakeMyTrip', path: '/store/makemytrip-coupons/', category: 'Travel' },
            { brand: 'Paytm', path: '/store/paytm-coupons/', category: 'Wallet Rewards' }
        ];

        let allCoupons = [];

        for (const page of pages) {
            try {
                logger.info(`CouponDekhoAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                
                // Skip if page not found (404)
                if (!html) {
                    logger.warn(`CouponDekhoAdapter: Skipping ${page.brand} - page not found`);
                    continue;
                }
                
                const $ = cheerio.load(html);
                let brandCoupons = 0;

                // CouponDekho uses .offer class for coupon items
                $('.offer').each((i, el) => {
                    const title = $(el).find('h3, h4, h5').first().text().trim();
                    const discount = $(el).find('.discount, .off, [class*="off"]').text().trim();
                    const desc = $(el).find('p').text().trim();

                    if (title) {
                        allCoupons.push({
                            brandName: page.brand,
                            couponTitle: title,
                            description: desc || title,
                            couponCode: null,
                            discountType: this.inferDiscountType(title + discount),
                            discountValue: discount || this.extractDiscountValue(title),
                            category: page.category,
                            couponLink: this.baseUrl + page.path,
                        });
                        brandCoupons++;
                    }
                });

                logger.info(`CouponDekhoAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`CouponDekhoAdapter Error for ${page.brand}: ${errorMsg}`);
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

module.exports = CouponDekhoAdapter;
