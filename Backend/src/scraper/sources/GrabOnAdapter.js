const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');
const browserManager = require('../browserManager');

class GrabOnAdapter extends GenericAdapter {
    constructor() {
        super('GrabOn', 'https://www.grabon.in');
        this.enableDeepScraping = true; // Enable deep scraping for codes and terms
        this.maxDetailPagesPerBrand = 10; // Limit detail page visits per brand
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

        // Initialize browser if deep scraping is enabled
        if (this.enableDeepScraping) {
            try {
                await browserManager.initialize();
            } catch (error) {
                logger.error(`GrabOnAdapter: Failed to initialize browser, falling back to basic scraping - ${error.message}`);
                this.enableDeepScraping = false;
            }
        }

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
                
                // Extract coupon IDs and basic info from listing page
                const couponDataList = [];
                $('div.gc-box').each((i, el) => {
                    const title = $(el).find('p').first().text().trim();
                    if (!title) return;

                    const discount = $(el).find('.bm, .txt').text().trim();
                    const dataCid = $(el).attr('data-cid');
                    const dataType = $(el).attr('data-type');
                    const desc = $(el).find('p').text().trim();
                    
                    // Extract basic coupon code from listing (if visible)
                    let couponCode = $(el).find('.go-cpn-show').text().trim();
                    const buttonTexts = [
                        'SHOW COUPON CODE', 'GET CODE', 'REVEAL CODE', 'COPY CODE',
                        'ACTIVATE OFFER', 'GET DEAL', 'SHOP NOW', 'CLICK HERE',
                        'VIEW OFFER', 'GRAB OFFER', 'REDEEM NOW', 'UNLOCK COUPON CODE'
                    ];
                    if (couponCode && (buttonTexts.some(btn => couponCode.toUpperCase().includes(btn)) || couponCode.length > 20)) {
                        couponCode = null;
                    }

                    const verified = $(el).find('.verified').text().trim();
                    const usesToday = $(el).find('.usr .bold-me').text().trim();

                    couponDataList.push({
                        brandName: page.brand,
                        couponTitle: title,
                        description: desc,
                        couponCode: couponCode || null,
                        discountType: this.inferDiscountType(title + discount),
                        discountValue: discount || title,
                        category: page.category,
                        couponLink: this.baseUrl + page.path,
                        terms: null, // Will be populated by deep scraping
                        dataCid: dataCid,
                        likelyHasCode: dataType === 'cc_c' // cc_c = coupon code, dl = deal
                    });
                });

                logger.info(`GrabOnAdapter: Found ${couponDataList.length} coupons for ${page.brand}`);

                // Deep scraping: Visit detail pages to get codes and terms
                if (this.enableDeepScraping && couponDataList.length > 0) {
                    const detailsToFetch = couponDataList
                        .filter(c => c.dataCid)
                        .slice(0, this.maxDetailPagesPerBrand);

                    logger.info(`GrabOnAdapter: Deep scraping ${detailsToFetch.length} detail pages for ${page.brand}`);

                    for (let i = 0; i < detailsToFetch.length; i++) {
                        const couponData = detailsToFetch[i];
                        const detailUrl = `${this.baseUrl}/coupon-codes/${couponData.dataCid}/`;

                        try {
                            const details = await browserManager.extractCouponDetails(detailUrl);
                            
                            if (details) {
                                // Update with detailed information
                                if (details.couponCode) {
                                    couponData.couponCode = details.couponCode;
                                }
                                if (details.termsAndConditions) {
                                    couponData.terms = details.termsAndConditions;
                                }
                                if (details.title && couponData.couponTitle === couponData.description) {
                                    couponData.couponTitle = details.title;
                                }
                                if (details.description && details.description.length > couponData.description.length) {
                                    couponData.description = details.description;
                                }
                                
                                logger.info(`GrabOnAdapter: [${i + 1}/${detailsToFetch.length}] Extracted ${details.couponCode ? 'CODE' : 'DEAL'} for ${page.brand}`);
                            }

                            // Rate limiting between detail page requests
                            await new Promise(resolve => setTimeout(resolve, 1500));

                        } catch (error) {
                            logger.error(`GrabOnAdapter: Error fetching details from ${detailUrl} - ${error.message}`);
                        }
                    }
                }

                // Remove temporary fields and add to results
                couponDataList.forEach(coupon => {
                    delete coupon.dataCid;
                    delete coupon.likelyHasCode;
                    allCoupons.push(coupon);
                });

                logger.info(`GrabOnAdapter: Completed ${page.brand} - ${couponDataList.length} coupons`);
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`GrabOnAdapter Error for ${page.brand}: ${errorMsg}`);
                // Continue with next brand even if one fails
            }
        }

        // Close browser when done
        if (this.enableDeepScraping) {
            await browserManager.close();
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
