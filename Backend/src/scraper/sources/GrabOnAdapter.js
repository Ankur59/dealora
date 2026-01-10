const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class GrabOnAdapter extends GenericAdapter {
    constructor() {
        super('GrabOn', 'https://www.grabon.in');
    }

    async scrape() {
        const pages = [
            // Target Apps from the list
            { brand: 'TWID', path: '/twid-coupons/', category: 'Wallet Rewards' },
            { brand: 'Pop', path: '/pop-coupons/', category: 'Wallet Rewards' },
            { brand: 'NPCL', path: '/npcl-coupons/', category: 'All' },
            { brand: 'Dhani', path: '/dhani-coupons/', category: 'Wallet Rewards' },
            { brand: 'Kiwi', path: '/kiwi-coupons/', category: 'Wallet Rewards' },
            { brand: 'Payzapp', path: '/payzapp-coupons/', category: 'Wallet Rewards' },
            { brand: 'Freo', path: '/freo-coupons/', category: 'Wallet Rewards' },
            { brand: 'Freecharge', path: '/freecharge-coupons/', category: 'Wallet Rewards' },
            { brand: 'BharatNxt', path: '/bharatnxt-coupons/', category: 'Wallet Rewards' },
            { brand: 'Sarvatra tech', path: '/sarvatra-coupons/', category: 'All' },
            { brand: 'Payworld', path: '/payworld-coupons/', category: 'Wallet Rewards' },
            { brand: 'Rio Money', path: '/rio-money-coupons/', category: 'Wallet Rewards' },
            { brand: 'Payinstacard', path: '/payinstacard-coupons/', category: 'Wallet Rewards' },
            { brand: 'nearwala', path: '/nearwala-coupons/', category: 'Grocery' },
            { brand: 'Limeroad', path: '/limeroad-coupons/', category: 'Grocery' },
            { brand: 'Shopclues', path: '/shopclues-coupons/', category: 'Grocery' },
            { brand: 'Snapdeal', path: '/snapdeal-coupons/', category: 'Grocery' },
            { brand: 'Eatsure', path: '/eatsure-coupons/', category: 'Food' },
            { brand: 'Box8', path: '/box8-coupons/', category: 'Food' },
            { brand: 'Rebel foods', path: '/rebel-foods-coupons/', category: 'Food' },
            { brand: 'Fassos', path: '/fassos-coupons/', category: 'Food' },
            { brand: 'Zingbus', path: '/zingbus-coupons/', category: 'Travel' },
            { brand: 'Satvacart', path: '/satvacart-coupons/', category: 'Grocery' },
            { brand: 'Dealshare', path: '/dealshare-coupons/', category: 'Grocery' },
            { brand: 'Salon Nayana', path: '/salon-nayana-coupons/', category: 'Beauty' },
            { brand: 'HR Wellness', path: '/hr-wellness-coupons/', category: 'Beauty' },
            { brand: 'Freshmenu', path: '/freshmenu-coupons/', category: 'Food' },
            // Popular brands (keeping for coverage)
            { brand: 'Zomato', path: '/zomato-coupons/', category: 'Food' },
            { brand: 'Swiggy', path: '/swiggy-coupons/', category: 'Food' },
            { brand: 'Amazon', path: '/amazon-coupons/', category: 'Grocery' },
            { brand: 'Flipkart', path: '/flipkart-coupons/', category: 'Grocery' }
        ];

        let allCoupons = [];

        for (const page of pages) {
            try {
                logger.info(`GrabOnAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                
                // Skip if page not found (404)
                if (!html) {
                    logger.warn(`GrabOnAdapter: Skipping ${page.brand} - page not found`);
                    continue;
                }
                
                const $ = cheerio.load(html);
                let brandCoupons = 0;

                $('div.gc-box').each((i, el) => {
                    const title = $(el).find('p').first().text().trim();
                    const discount = $(el).find('.bm, .txt').text().trim();
                    const code = $(el).attr('data-couponid');
                    const desc = $(el).find('p').text().trim();
                    
                    // Extract coupon code more carefully - only get actual code text, not button text
                    let couponCode = $(el).find('.go-cpn-show').text().trim();
                    
                    // Common button text that should NOT be treated as coupon codes
                    const buttonTexts = [
                        'SHOW COUPON CODE', 'GET CODE', 'REVEAL CODE', 'COPY CODE',
                        'ACTIVATE OFFER', 'GET DEAL', 'SHOP NOW', 'CLICK HERE',
                        'VIEW OFFER', 'GRAB OFFER', 'REDEEM NOW'
                    ];
                    
                    // If the extracted "code" is actually button text or too long, it's not a real code
                    if (couponCode && (buttonTexts.some(btn => couponCode.toUpperCase().includes(btn)) || couponCode.length > 20)) {
                        couponCode = null; // Not a real coupon code, just button text
                    }

                    if (title) {
                        allCoupons.push({
                            brandName: page.brand,
                            couponTitle: title,
                            description: desc,
                            couponCode: couponCode || null,
                            discountType: this.inferDiscountType(title + discount),
                            discountValue: discount || title,
                            category: page.category,
                            couponLink: this.baseUrl + page.path,
                        });
                        brandCoupons++;
                    }
                });

                logger.info(`GrabOnAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`GrabOnAdapter Error for ${page.brand}: ${errorMsg}`);
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

module.exports = GrabOnAdapter;
