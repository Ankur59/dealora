const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class GrabOnAdapter extends GenericAdapter {
    constructor() {
        super('GrabOn', 'https://www.grabon.in');
    }

    async scrape() {
        const pages = [
            { brand: 'Zomato', path: '/zomato-coupons/', category: 'Food' },
            { brand: 'Swiggy', path: '/swiggy-coupons/', category: 'Food' },
            { brand: 'Amazon', path: '/amazon-coupons/', category: 'Electronics' },
            { brand: 'Flipkart', path: '/flipkart-coupons/', category: 'Electronics' }
        ];

        let allCoupons = [];

        for (const page of pages) {
            try {
                logger.info(`GrabOnAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                const $ = cheerio.load(html);
                let brandCoupons = 0;

                $('div.gc-box').each((i, el) => {
                    const title = $(el).find('p').first().text().trim();
                    const discount = $(el).find('.bm, .txt').text().trim();
                    const code = $(el).attr('data-couponid'); 
                    const desc = $(el).find('p').text().trim();

                    if (title) {
                        allCoupons.push({
                            brandName: page.brand,
                            couponTitle: title,
                            description: desc,
                            couponCode: $(el).find('.go-cpn-show').text().trim() || null,
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
                logger.error(`GrabOnAdapter Error for ${page.brand}:`, error.message);
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
