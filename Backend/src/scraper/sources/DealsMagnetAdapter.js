const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class DealsMagnetAdapter extends GenericAdapter {
    constructor() {
        super('DealsMagnet', 'https://www.dealsmagnet.com');
    }

    async scrape() {
        const pages = [
            // Target Apps from the list
            { brand: 'TWID', path: '/coupons/twid', category: 'Wallet Rewards' },
            { brand: 'Pop', path: '/coupons/pop', category: 'Wallet Rewards' },
            { brand: 'NPCL', path: '/coupons/npcl', category: 'All' },
            { brand: 'Dhani', path: '/coupons/dhani', category: 'Wallet Rewards' },
            { brand: 'Kiwi', path: '/coupons/kiwi', category: 'Wallet Rewards' },
            { brand: 'Payzapp', path: '/coupons/payzapp', category: 'Wallet Rewards' },
            { brand: 'Freo', path: '/coupons/freo', category: 'Wallet Rewards' },
            { brand: 'Freecharge', path: '/coupons/freecharge', category: 'Wallet Rewards' },
            { brand: 'BharatNxt', path: '/coupons/bharatnxt', category: 'Wallet Rewards' },
            { brand: 'Sarvatra tech', path: '/coupons/sarvatra', category: 'All' },
            { brand: 'Payworld', path: '/coupons/payworld', category: 'Wallet Rewards' },
            { brand: 'Rio Money', path: '/coupons/rio-money', category: 'Wallet Rewards' },
            { brand: 'Payinstacard', path: '/coupons/payinstacard', category: 'Wallet Rewards' },
            { brand: 'nearwala', path: '/coupons/nearwala', category: 'Grocery' },
            { brand: 'Limeroad', path: '/coupons/limeroad', category: 'Grocery' },
            { brand: 'Shopclues', path: '/coupons/shopclues', category: 'Grocery' },
            { brand: 'Snapdeal', path: '/coupons/snapdeal', category: 'Grocery' },
            { brand: 'Eatsure', path: '/coupons/eatsure', category: 'Food' },
            { brand: 'Box8', path: '/coupons/box8', category: 'Food' },
            { brand: 'Rebel foods', path: '/coupons/rebel-foods', category: 'Food' },
            { brand: 'Fassos', path: '/coupons/fassos', category: 'Food' },
            { brand: 'Zingbus', path: '/coupons/zingbus', category: 'Travel' },
            { brand: 'Satvacart', path: '/coupons/satvacart', category: 'Grocery' },
            { brand: 'Dealshare', path: '/coupons/dealshare', category: 'Grocery' },
            { brand: 'Salon Nayana', path: '/coupons/salon-nayana', category: 'Beauty' },
            { brand: 'HR Wellness', path: '/coupons/hr-wellness', category: 'Beauty' },
            { brand: 'Freshmenu', path: '/coupons/freshmenu', category: 'Food' },
            // Popular brands (keeping for coverage)
            { brand: 'Zomato', path: '/coupons/zomato', category: 'Food' },
            { brand: 'Swiggy', path: '/coupons/swiggy', category: 'Food' },
            { brand: 'Amazon', path: '/coupons/amazon', category: 'Grocery' },
            { brand: 'Flipkart', path: '/coupons/flipkart', category: 'Grocery' },
            { brand: 'Myntra', path: '/coupons/myntra', category: 'Fashion' },
            { brand: 'Nykaa', path: '/coupons/nykaa', category: 'Beauty' },
            { brand: 'MakeMyTrip', path: '/coupons/makemytrip', category: 'Travel' },
            { brand: 'Paytm', path: '/coupons/paytm', category: 'Wallet Rewards' }
        ];

        let allCoupons = [];

        for (const page of pages) {
            try {
                logger.info(`DealsMagnetAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                
                // Skip if page not found (404)
                if (!html) {
                    logger.warn(`DealsMagnetAdapter: Skipping ${page.brand} - page not found`);
                    continue;
                }
                
                const $ = cheerio.load(html);
                let brandCoupons = 0;

                // DealsMagnet specific selectors - based on website structure
                $('.coupon-item, .deal-item, [class*="coupon"], article, .card').each((i, el) => {
                    const title = $(el).find('h3, h4, h5, .title, [class*="title"]').first().text().trim();
                    const discount = $(el).find('.discount, .off, [class*="discount"], [class*="off"], .badge').text().trim();
                    const code = $(el).find('.coupon-code, .code, [class*="code"]').text().trim() ||
                                $(el).find('input').val() ||
                                null;
                    const desc = $(el).find('p, .description, [class*="desc"]').text().trim();
                    
                    // Try to extract expiry from "Valid Till" or similar
                    const validTill = $(el).find('[class*="valid"], [class*="expiry"], [class*="till"]').text().trim();

                    if (title && title.length > 5) {
                        // Get the actual brand website URL instead of source website
                        const brandUrl = this.getBrandUrl(page.brand) || this.baseUrl + page.path;
                        
                        allCoupons.push({
                            brandName: page.brand,
                            couponTitle: title,
                            description: desc || title,
                            couponCode: code || null,
                            discountType: this.inferDiscountType(title + discount),
                            discountValue: discount || this.extractDiscountValue(title),
                            category: page.category,
                            couponLink: brandUrl,
                        });
                        brandCoupons++;
                    }
                });

                logger.info(`DealsMagnetAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`DealsMagnetAdapter Error for ${page.brand}: ${errorMsg}`);
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

module.exports = DealsMagnetAdapter;
