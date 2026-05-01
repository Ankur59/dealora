const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');
const browserManager = require('../browserManager');

class PaisaWapasAdapter extends GenericAdapter {
    constructor() {
        super('PaisaWapas', 'https://www.paisawapas.com');
        this.enableJsRendering = true;
        this.maxCouponsPerBrand = 80;
    }

    async scrape() {
        const pages = [
            // ===== ACTIVE BRANDS - Only scraping these essential brands =====
            // Food Delivery Apps
            // { brand: 'Zomato', path: '/zomato-offers', category: 'Food' },
            // { brand: 'Swiggy', path: '/swiggy-offers', category: 'Food' },
            // { brand: 'Box8', path: '/box8-offers', category: 'Food' },
            // { brand: 'Eatsure', path: '/eatsure-offers', category: 'Food' },
            // { brand: 'Freshmenu', path: '/freshmenu-offers', category: 'Food' },
            
            // E-commerce & Shopping
            { brand: 'Ajio', path: '/ajio-sale-coupons', category: 'Fashion' },
            // { brand: 'Amazon', path: '/amazon-offers', category: 'Grocery' },
            // { brand: 'Flipkart', path: '/flipkart-offers', category: 'Grocery' },
            // { brand: 'Snapdeal', path: '/snapdeal-offers', category: 'Grocery' },
            
            // Wallet & Payment Apps
            // { brand: 'PhonePe', path: '/phonepe-offers', category: 'Wallet Rewards' },
            // { brand: 'Paytm', path: '/paytm-offers', category: 'Wallet Rewards' },
            // { brand: 'Cred', path: '/cred-offers', category: 'Wallet Rewards' },
            // { brand: 'Dhani', path: '/dhani-offers', category: 'Wallet Rewards' },
            // { brand: 'Freo', path: '/freo-offers', category: 'Wallet Rewards' },
            
            // Grocery & Daily Needs
            // { brand: 'Blinkit', path: '/blinkit-offers', category: 'Grocery' },
            // { brand: 'BigBasket', path: '/bigbasket-offers', category: 'Grocery' },
            
            // Beauty & Fashion
            // { brand: 'Nykaa', path: '/nykaa-offers', category: 'Beauty' },
            // { brand: 'Myntra', path: '/myntra-offers', category: 'Fashion' },
            
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

        // Optional single-brand filter for adapter-level testing
        const brandFilter = (process.env.SCRAPER_BRAND || '').trim().toLowerCase();
        const targetPages = brandFilter ? pages.filter(p => p.brand.toLowerCase() === brandFilter) : pages;
        if (brandFilter) {
            logger.info(`PaisaWapasAdapter: Brand filter enabled -> ${brandFilter}`);
        }

        let allCoupons = [];
        let didUseBrowser = false;

        if (this.enableJsRendering) {
            try {
                await browserManager.initialize();
                didUseBrowser = true;
            } catch (error) {
                logger.error(`PaisaWapasAdapter: Failed to initialize browser, falling back to static HTML - ${error.message}`);
                this.enableJsRendering = false;
            }
        }

        for (const page of targetPages) {
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

                if (this.enableJsRendering) {
                    const browserPage = await browserManager.createPage();
                    try {
                        const targetUrl = this.baseUrl + page.path;
                        await browserPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        await new Promise(resolve => setTimeout(resolve, 4000));

                        // Navigate to Coupons tab explicitly (ignore default All/Deals tab)
                        await browserPage.evaluate(() => {
                            const couponTab =
                                document.querySelector('li.coupons-navigation-tab[data-rel="OFFER_COUPONS"]') ||
                                document.querySelector('li.coupons-navigation-tab[data-rel="OFFER COUPONS"]') ||
                                Array.from(document.querySelectorAll('li.coupons-navigation-tab, li.filter.coupons-navigation-tab'))
                                    .find(li => /coupon/i.test((li.textContent || '').trim()));
                            if (couponTab) couponTab.click();
                        });
                        await new Promise(resolve => setTimeout(resolve, 3000));

                        const renderedCoupons = await browserPage.evaluate((brand, category, maxItems) => {
                            const rowNodes = Array.from(
                                document.querySelectorAll('.coupons-main-section .row.coupon-head-row, .coupon-section .row.coupon-head-row')
                            );

                            const items = rowNodes.map(row => {
                                const text = (row.textContent || '').replace(/\s+/g, ' ').trim();

                                const titleEl =
                                    row.querySelector('a[class*="title"]') ||
                                    row.querySelector('h3, h4, h5, .title');
                                const title = (titleEl?.textContent || '').trim();
                                if (!title) return null;

                                const cta = row.querySelector('a.showSingupPopup, a.showSignupPopup');
                                const dataType = (cta?.getAttribute('data-type') || '').trim();
                                const dataTab = (cta?.getAttribute('data-tab') || '').trim();

                                // Hard coupon preference: prioritize OFFER_COUPON / COUPON markers
                                const isCouponLike =
                                    /offer_coupon/i.test(dataTab) ||
                                    /coupon/i.test(dataType) ||
                                    /click to reveal|coupon/i.test(text);
                                if (!isCouponLike) return null;

                                const descEl =
                                    row.querySelector('.offer-desc') ||
                                    row.querySelector('.wlt_shortcode_excerpt') ||
                                    row.querySelector('p');
                                const desc = (descEl?.textContent || title).trim();

                                const discountEl =
                                    row.querySelector('.discount, .off, [class*="discount"], [class*="off"], .ups');
                                const discount = (discountEl?.textContent || '').trim();

                                const usedEl = row.querySelector('.user-count .count, .user-count .count-text, .user-count, [class*="user-count"], [class*="times-used"]');
                                const usedByText = (usedEl?.textContent || '').trim();

                                // PaisaWapas shows patterns like "123 Times Used" or "123 used"
                                const usedMatch = usedByText.match(/(\d[\d,]*)\s*(times?\s*used|used)/i) ||
                                                  usedByText.match(/(\d[\d,]*)/);
                                const usedBy = usedMatch ? Number(usedMatch[1].replace(/,/g, '')) : null;

                                // Verified: check DOM badge first, then text
                                const verifiedEl =
                                  row.querySelector('.verification, .verified, .verified-badge, .verified-image, [class*="verified"]');
                                const verificationText = (verifiedEl?.textContent || '').trim();
                                const verified = /verified/i.test(verificationText) ? true : null;

                                return {
                                    brandName: brand,
                                    couponTitle: title,
                                    description: desc,
                                    couponCode: null,
                                    discountType: null,
                                    discountValue: discount || null,
                                    category,
                                    couponLink: null,
                                    trustscore: null,
                                    usedBy,
                                    verified,
                                };
                            }).filter(Boolean).slice(0, maxItems);

                            return items;
                        }, page.brand, page.category, this.maxCouponsPerBrand);

                        const brandUrl = this.getBrandUrl(page.brand) || 'https://www.example.com';
                        renderedCoupons.forEach(coupon => {
                            coupon.couponLink = brandUrl;
                            coupon.discountType = this.inferDiscountType((coupon.couponTitle || '') + ' ' + (coupon.discountValue || ''));
                            allCoupons.push(coupon);
                        });
                        brandCoupons = renderedCoupons.length;
                    } catch (error) {
                        logger.error(`PaisaWapasAdapter: Browser extraction failed for ${page.brand} - ${error.message}`);
                    } finally {
                        await browserPage.close();
                    }

                    logger.info(`PaisaWapasAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                // PaisaWapas: keep only explicit OFFER_COUPON cards.
                // Example from DOM:
                // <a class="showSignupPopup ..." data-tab="...&type=OFFER_COUPON&..." data-type="COUPON" ...>
                const couponAnchors = $('.showSignupPopup[data-tab*="OFFER_COUPON"], .showSignupPopup[data-type="COUPON"]');

                couponAnchors.each((i, anchorEl) => {
                    const $anchor = $(anchorEl);
                    const dataTab = ($anchor.attr('data-tab') || '').trim();
                    const dataType = ($anchor.attr('data-type') || '').trim();
                    const isCouponCard = /offer_coupon/i.test(dataTab) || /coupon/i.test(dataType);
                    if (!isCouponCard) return;

                    const $card = $anchor.closest('.row.coupon-head-row, .coupon-section');
                    if (!$card || $card.length === 0) return;

                    const title = $card.find('a[class*="title"], h3, h4, h5, .title, [class*="title"]').first().text().trim()
                        || ($anchor.attr('data-title') || '').trim();
                    const discount = $card.find('.discount, .off, [class*="discount"], [class*="off"], .ups').first().text().trim();
                    const desc = $card.find('.offer-desc, .wlt_shortcode_excerpt, p, .description, [class*="desc"]').first().text().trim()
                        || ($anchor.attr('data-title') || '').trim();
                    const usedByText = $card.find('.user-count .count, .user-count .count-text, .user-count, [class*="user-count"], [class*="used"]').first().text().trim();
                    const verifiedText = $card.find('.verification, .verified, .verified-image, [class*="verification"], [class*="verified"]').first().text().trim();

                    if (!title) return;

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
                        trustscore: null, // PaisaWapas trust score not available in coupon cards
                        usedBy: this.parseCountFromText(usedByText),
                        verified: this.parseVerifiedFlag(verifiedText),
                    });
                    brandCoupons++;
                });

                logger.info(`PaisaWapasAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMsg = error.message || String(error);
                logger.error(`PaisaWapasAdapter Error for ${page.brand}: ${errorMsg}`);
                // Continue with next brand even if one fails
            }
        }

        if (didUseBrowser) {
            await browserManager.close();
        }

        console.log(allCoupons, 'PaisaWapasAdapter allCoupons');
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
