const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class PaisaWapasAdapter extends GenericAdapter {
    constructor() {
        super('PaisaWapas', 'https://www.paisawapas.com');
    }

    async scrape() {
        const pages = [
            // ===== ACTIVE BRANDS - Only scraping these essential brands =====
            // Food Delivery Apps
            { brand: 'Zomato', path: '/zomato-sale-offers', category: 'Food' },
            { brand: 'Swiggy', path: '/swiggy-sale-offers', category: 'Food' },
            { brand: 'Box8', path: '/box8-sale-offers', category: 'Food' },
            { brand: 'Eatsure', path: '/eatsure-sale-offers', category: 'Food' },
            { brand: 'Freshmenu', path: '/freshmenu-sale-offers', category: 'Food' },
            
            // E-commerce & Shopping
            { brand: 'Amazon', path: '/amazon-sale-offers', category: 'Grocery' },
            { brand: 'Flipkart', path: '/flipkart-sale-offers', category: 'Grocery' },
            { brand: 'Snapdeal', path: '/snapdeal-sale-offers', category: 'Grocery' },
            
            // Wallet & Payment Apps
            { brand: 'PhonePe', path: '/phonepe-sale-offers', category: 'Wallet Rewards' },
            { brand: 'Paytm', path: '/paytm-sale-offers', category: 'Wallet Rewards' },
            { brand: 'Cred', path: '/cred-sale-offers', category: 'Wallet Rewards' },
            { brand: 'Dhani', path: '/dhani-sale-offers', category: 'Wallet Rewards' },
            { brand: 'Freo', path: '/freo-sale-offers', category: 'Wallet Rewards' },
            
            // Grocery & Daily Needs
            { brand: 'Blinkit', path: '/blinkit-sale-offers', category: 'Grocery' },
            { brand: 'BigBasket', path: '/bigbasket-sale-offers', category: 'Grocery' },
            
            // Beauty & Fashion
            { brand: 'Nykaa', path: '/nykaa-sale-offers', category: 'Beauty' },
            { brand: 'Myntra', path: '/myntra-sale-offers', category: 'Fashion' },
            
            // Travel
            { brand: 'MakeMyTrip', path: '/makemytrip-sale-offers', category: 'Travel' },
            
            // ===== COMMENTED OUT - Not needed currently =====
            // { brand: 'TWID', path: '/twid-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'Pop', path: '/pop-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'NPCL', path: '/npcl-sale-offers', category: 'All' },
            // { brand: 'Kiwi', path: '/kiwi-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'Payzapp', path: '/payzapp-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'Freecharge', path: '/freecharge-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'BharatNxt', path: '/bharatnxt-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'Sarvatra tech', path: '/sarvatra-sale-offers', category: 'All' },
            // { brand: 'Payworld', path: '/payworld-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'Rio Money', path: '/rio-money-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'Payinstacard', path: '/payinstacard-sale-offers', category: 'Wallet Rewards' },
            // { brand: 'nearwala', path: '/nearwala-sale-offers', category: 'Grocery' },
            // { brand: 'Limeroad', path: '/limeroad-sale-offers', category: 'Grocery' },
            // { brand: 'Shopclues', path: '/shopclues-sale-offers', category: 'Grocery' },
            // { brand: 'Rebel foods', path: '/rebel-foods-sale-offers', category: 'Food' },
            // { brand: 'Fassos', path: '/fassos-sale-offers', category: 'Food' },
            // { brand: 'Zingbus', path: '/zingbus-sale-offers', category: 'Travel' },
            // { brand: 'Satvacart', path: '/satvacart-sale-offers', category: 'Grocery' },
            // { brand: 'Dealshare', path: '/dealshare-sale-offers', category: 'Grocery' },
            // { brand: 'Salon Nayana', path: '/salon-nayana-sale-offers', category: 'Beauty' },
            // { brand: 'HR Wellness', path: '/hr-wellness-sale-offers', category: 'Beauty' },
        ];

        let allCoupons = [];

        for (const page of pages) {
            try {
                logger.info(`PaisaWapasAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                
                // Skip if page not found (404)
                if (!html) {
                    logger.warn(`PaisaWapasAdapter: Skipping ${page.brand} - page not found`);
                    continue;
                }
                
                const $ = cheerio.load(html);
                let brandCoupons = 0;

                // PaisaWapas specific selectors - adjust based on website structure
                $('.offer, .deal, [class*="offer"], [class*="deal"], .coupon-item, .deal-item').each((i, el) => {
                    const title = $(el).find('h3, h4, h5, .title, [class*="title"]').first().text().trim();
                    const discount = $(el).find('.discount, .off, [class*="discount"], [class*="off"]').text().trim();
                    const desc = $(el).find('p, .description, [class*="desc"]').text().trim();

                    if (title) {
                        // Get the actual brand website URL instead of source website
                        const brandUrl = this.getBrandUrl(page.brand) || 'https://www.example.com'; // Fallback if brand not found
                        
                        allCoupons.push({
                            brandName: page.brand,
                            couponTitle: title,
                            description: desc || title,
                            couponCode: null,
                            discountType: this.inferDiscountType(title + discount),
                            discountValue: discount || this.extractDiscountValue(title),
                            category: page.category,
                            couponLink: brandUrl,
                        });
                        brandCoupons++;
                    }
                });

                logger.info(`PaisaWapasAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`PaisaWapasAdapter Error for ${page.brand}: ${errorMsg}`);
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

module.exports = PaisaWapasAdapter;
