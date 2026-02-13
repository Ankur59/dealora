const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');
const browserManager = require('../browserManager');

class DealivoreAdapter extends GenericAdapter {
    constructor() {
        super('Dealivore', 'https://www.dealivore.in');
        this.enableDeepScraping = true; // Enable deep scraping for codes
        this.maxDetailPagesPerBrand = 5; // Limit detail page visits per brand
    }

    /**
     * Convert brand name to URL-friendly slug
     * Example: "Amazon" -> "amazon-coupons", "Rebel foods" -> "rebel-foods-coupons"
     */
    brandToSlug(brand) {
        return brand.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') + '-coupons';
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

        // Convert to pages with correct URL format: /store/brand-coupons (e.g., /store/amazon-coupons)
        const pages = brands.map(b => ({
            brand: b.brand,
            path: `/store/${this.brandToSlug(b.brand)}`,
            category: b.category
        }));

        let allCoupons = [];

        // Initialize browser if deep scraping is enabled
        if (this.enableDeepScraping) {
            try {
                await browserManager.initialize();
            } catch (error) {
                logger.error(`DealivoreAdapter: Failed to initialize browser, falling back to basic scraping - ${error.message}`);
                this.enableDeepScraping = false;
            }
        }

        for (const page of pages) {
            try {
                logger.info(`DealivoreAdapter: Scraping ${page.brand} from ${page.path}`);
                const html = await this.fetchHtml(page.path);
                
                // Skip if page not found (404)
                if (!html) {
                    logger.warn(`DealivoreAdapter: Skipping ${page.brand} - page not found (404). Path may be incorrect: ${this.baseUrl}${page.path}`);
                    logger.warn(`DealivoreAdapter: Note - Dealivore website structure may have changed. These paths may not exist.`);
                    continue;
                }
                
                const $ = cheerio.load(html);
                let brandCoupons = 0;
                const couponDataList = [];

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
                    const link = $el.find('a.deal-link, a.coupon-link, a').first().attr('href') || 
                               $el.attr('href') ||
                               page.path;

                    // Extract detail page URL (if link goes to /coupon-codes/XXX)
                    let detailUrl = null;
                    if (link && link.includes('/coupon-codes/')) {
                        detailUrl = link.startsWith('http') ? link : this.baseUrl + link;
                    }

                    if (title && title.length > 3) {
                        couponDataList.push({
                            brandName: page.brand,
                            couponTitle: title,
                            description: desc || title,
                            couponCode: code || null,
                            discountType: this.inferDiscountType(title + ' ' + discount),
                            discountValue: discount || this.extractDiscountValue(title),
                            category: page.category,
                            couponLink: link.startsWith('http') ? link : this.baseUrl + link,
                            detailUrl: detailUrl
                        });
                        brandCoupons++;
                    }
                });

                logger.info(`DealivoreAdapter: Found ${couponDataList.length} coupons for ${page.brand}`);

                // Deep scraping: Visit detail pages to get codes
                if (this.enableDeepScraping && couponDataList.length > 0) {
                    const detailsToFetch = couponDataList
                        .filter(c => c.detailUrl && !c.couponCode)
                        .slice(0, this.maxDetailPagesPerBrand);

                    if (detailsToFetch.length > 0) {
                        logger.info(`DealivoreAdapter: Deep scraping ${detailsToFetch.length} detail pages for ${page.brand}`);

                        for (const [i, coupon] of detailsToFetch.entries()) {
                            try {
                                const browserPage = await browserManager.browser.newPage();
                                await browserPage.goto(coupon.detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });

                                // Wait for code element
                                await browserPage.waitForSelector('p.code, .coupondetails', { timeout: 5000 });

                                // Extract the code AND terms
                                const extractedData = await browserPage.evaluate(() => {
                                    // Extract code
                                    let code = null;
                                    const codeEl = document.querySelector('p.code');
                                    if (codeEl) {
                                        let text = codeEl.textContent.trim();
                                        // Remove SVG CSS junk and clean
                                        text = text.replace(/svg \{[^}]+\}/g, '').replace(/Copy|SMS/gi, '').trim();
                                        code = text.length > 2 && text.length < 30 ? text : null;
                                    }

                                    // Extract terms from <li> elements
                                    let terms = null;
                                    const termsList = [];
                                    const liElements = document.querySelectorAll('li');
                                    liElements.forEach(li => {
                                        const text = li.textContent.trim();
                                        // Filter valid terms (longer than 20 chars, not navigation)
                                        if (text.length > 20 && 
                                            !text.match(/Home|About|Contact|Categories|Stores|Blogs|Login|Sign/i)) {
                                            termsList.push(text);
                                        }
                                    });
                                    
                                    if (termsList.length > 0) {
                                        terms = termsList.join('\n').substring(0, 2000);
                                    }

                                    return { code, terms };
                                });

                                await browserPage.close();

                                if (extractedData.code) {
                                    coupon.couponCode = extractedData.code;
                                    logger.info(`DealivoreAdapter: [${i + 1}/${detailsToFetch.length}] Extracted CODE for ${page.brand}: ${extractedData.code}`);
                                }
                                
                                if (extractedData.terms) {
                                    coupon.terms = extractedData.terms;
                                    logger.info(`DealivoreAdapter: [${i + 1}/${detailsToFetch.length}] Extracted TERMS for ${page.brand} (${extractedData.terms.length} chars)`);
                                }

                                // Rate limiting
                                await new Promise(resolve => setTimeout(resolve, 1500));

                            } catch (error) {
                                logger.error(`DealivoreAdapter: Error fetching details from ${coupon.detailUrl} - ${error.message}`);
                            }
                        }
                    }
                }

                // Remove detailUrl field and add to results
                couponDataList.forEach(coupon => {
                    delete coupon.detailUrl;
                    allCoupons.push(coupon);
                });

                logger.info(`DealivoreAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`DealivoreAdapter Error for ${page.brand}: ${errorMsg}`);
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

module.exports = DealivoreAdapter;

