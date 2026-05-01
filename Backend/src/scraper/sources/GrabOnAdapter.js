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
            // ===== ACTIVE BRANDS - Only scraping these essential brands =====
            // Food Delivery Apps
            { brand: 'Zomato', path: '/zomato-coupons/', category: 'Food' },
            { brand: 'Swiggy', path: '/swiggy-coupons/', category: 'Food' },
            // { brand: 'Box8', path: '/box8-coupons/', category: 'Food' },
            // { brand: 'Eatsure', path: '/eatsure-coupons/', category: 'Food' },
            // { brand: 'Freshmenu', path: '/freshmenu-coupons/', category: 'Food' },
            
            // E-commerce & Shopping
            // { brand: 'Amazon', path: '/amazon-coupons/', category: 'Grocery' },
            // { brand: 'Flipkart', path: '/flipkart-coupons/', category: 'Grocery' },
            // { brand: 'Snapdeal', path: '/snapdeal-coupons/', category: 'Grocery' },
            
            // // Wallet & Payment Apps
            // { brand: 'PhonePe', path: '/phonepe-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Paytm', path: '/paytm-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Cred', path: '/cred-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Dhani', path: '/dhani-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Freo', path: '/freo-coupons/', category: 'Wallet Rewards' },
            
            // // Grocery & Daily Needs
            // { brand: 'Blinkit', path: '/blinkit-coupons/', category: 'Grocery' },
            // { brand: 'BigBasket', path: '/bigbasket-coupons/', category: 'Grocery' },
            
            // // Beauty & Fashion
            // { brand: 'Nykaa', path: '/nykaa-coupons/', category: 'Beauty' },
            // { brand: 'Myntra', path: '/myntra-coupons/', category: 'Fashion' },
            
            // // Travel
            // { brand: 'MakeMyTrip', path: '/makemytrip-coupons/', category: 'Travel' },
            
            // ===== COMMENTED OUT - Not needed currently =====
            // { brand: 'TWID', path: '/twid-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Pop', path: '/pop-coupons/', category: 'Wallet Rewards' },
            // { brand: 'NPCL', path: '/npcl-coupons/', category: 'All' },
            // { brand: 'Kiwi', path: '/kiwi-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Payzapp', path: '/payzapp-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Freecharge', path: '/freecharge-coupons/', category: 'Wallet Rewards' },
            // { brand: 'BharatNxt', path: '/bharatnxt-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Sarvatra tech', path: '/sarvatra-coupons/', category: 'All' },
            // { brand: 'Payworld', path: '/payworld-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Rio Money', path: '/rio-money-coupons/', category: 'Wallet Rewards' },
            // { brand: 'Payinstacard', path: '/payinstacard-coupons/', category: 'Wallet Rewards' },
            // { brand: 'nearwala', path: '/nearwala-coupons/', category: 'Grocery' },
            // { brand: 'Limeroad', path: '/limeroad-coupons/', category: 'Grocery' },
            // { brand: 'Shopclues', path: '/shopclues-coupons/', category: 'Grocery' },
            // { brand: 'Rebel foods', path: '/rebel-foods-coupons/', category: 'Food' },
            // { brand: 'Fassos', path: '/fassos-coupons/', category: 'Food' },
            // { brand: 'Zingbus', path: '/zingbus-coupons/', category: 'Travel' },
            // { brand: 'Satvacart', path: '/satvacart-coupons/', category: 'Grocery' },
            // { brand: 'Dealshare', path: '/dealshare-coupons/', category: 'Grocery' },
            // { brand: 'Salon Nayana', path: '/salon-nayana-coupons/', category: 'Beauty' },
            // { brand: 'HR Wellness', path: '/hr-wellness-coupons/', category: 'Beauty' },
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
                
                // ── Store-level trust score ────────────────────────────────────
                // GrabOn exposes a star rating at the top of every brand page,
                // e.g. "4 / 5 (692 Votes)". We normalise this to 0-100.
                const pageTrustScore = this.parseStoreTrustScore($('body').text());

                // Extract coupon IDs and basic info from listing page
                const couponDataList = [];
                $('div.gc-box').each((i, el) => {
                    const title = $(el).find('p').first().text().trim();
                    if (!title) return;

                    const discount = $(el).find('.bm, .txt').text().trim();
                    const dataCid = $(el).attr('data-cid');
                    const dataType = $(el).attr('data-type');
                    const desc = $(el).find('p').text().trim();

                    // ── Coupon code: read directly from data attributes in the listing HTML ────
                    // The code is embedded in the static HTML — NO button click needed.
                    //
                    // Observed GrabOn HTML structure (from DevTools):
                    //   div.gc-box
                    //     div.gcbr.go-cpn-show[data-code="CITI150"]  ← data-code
                    //       div[data-inner-text="CITI150"]            ← data-inner-text
                    //         span[data-type="cpn-code-text"]CITI150  ← text content
                    let couponCode =
                        $(el).find('.go-cpn-show[data-code]').attr('data-code')
                        || $(el).find('[data-inner-text]').attr('data-inner-text')
                        || $(el).find('span[data-type="cpn-code-text"]').text().trim()
                        || null;

                    // Sanitise: reject short/long values or known button-label garbage
                    if (couponCode) {
                        const upper = couponCode.trim().toUpperCase();
                        const isLabel = [
                            'SHOW COUPON', 'GET CODE', 'REVEAL', 'COPY CODE',
                            'UNLOCK', 'ACTIVATE', 'COLLECT',
                        ].some(t => upper.includes(t));
                        couponCode = (!isLabel && upper.length >= 3 && upper.length <= 20)
                            ? upper
                            : null;
                    }

                    // ── Platform verified: read from data-cpn-verified attribute ──────────
                    // GrabOn sets data-cpn-verified="True" / "False" on every gc-box div.
                    // This is more reliable than hunting for a span[data-type="verified"].
                    const cpnVerifiedAttr = $(el).attr('data-cpn-verified');
                    const platformVerified =
                        cpnVerifiedAttr === 'True'  ? true  :
                        cpnVerifiedAttr === 'False' ? false :
                        null;

                    // ── Uses Today ─────────────────────────────────────────────
                    // GrabOn exposes: <span data-type="views" data-uses="600">600 Uses Today</span>
                    const usesEl = $(el).find('span[data-type="views"]').first();
                    const usesAttr = usesEl.attr('data-uses');
                    const usesText = usesEl.text().trim();
                    const usedByValue = this.parseCountFromText(usesAttr ?? usesText);

                    // ── Coupon visiting link ────────────────────────────────────
                    // Priority: GrabOn detail URL (specific) > brand homepage (generic)
                    // The detail URL is the SPECIFIC page for this coupon — users
                    // can click through to reveal and redeem it even without a code.
                    const grabOnDetailUrl = dataCid
                        ? `${this.baseUrl}/coupon-codes/${dataCid}/`
                        : null;
                    const brandFallbackUrl = this.getBrandUrl(page.brand);
                    // couponLink = specific GrabOn coupon page (preferred) OR brand homepage
                    const couponLink = grabOnDetailUrl || brandFallbackUrl || null;

                    // ── Terms & Minimum Order (from listing HTML) ───────────────
                    const termsArray = [];
                    let minimumOrder = null;

                    // GrabOn often hides terms in this specific structure (as seen in screenshot)
                    $(el).find('.cpn-det-v2 div[data-type="desc-div"] ul li, .cpn-det-v2 div[data-type="desc-div"] p').each((_, item) => {
                        let liText = $(item).text().trim();
                        // Clean up zero-width spaces (&ZeroWidthSpace; / \u200B) and multiple whitespaces
                        liText = liText.replace(/[\u200B-\u200D\uFEFF]/g, '');
                        liText = liText.replace(/\s+/g, ' ').trim();

                        if (liText) {
                            termsArray.push(liText);
                            // Detect minimum order (e.g., "Minimum cart value should be Rs 999")
                            const minMatch = liText.match(/minimum.*(?:rs\.?|₹|inr)\s*(\d+(?:,\d+)?)/i);
                            if (minMatch) {
                                minimumOrder = minMatch[0]; 
                            }
                        }
                    });

                    const terms = termsArray.length > 0 ? termsArray.join('\n') : null;

                    // ── Expiry Date ───────────────────────────────────────────
                    // From DOM: <span aria-label="Expiry"> Valid Till: Apr 30, 2026 (THU) </span>
                    const expiryEl = $(el).find('span[aria-label="Expiry"]').first();
                    const expiryText = expiryEl.text().trim();
                    let expiryDate = this.parseExpiryDate(expiryText);

                    // Fallback to one month from now if expiry date is missing
                    if (!expiryDate) {
                        const defaultDate = new Date();
                        defaultDate.setMonth(defaultDate.getMonth() + 1);
                        expiryDate = defaultDate;
                    }

                    couponDataList.push({
                        // ── Core fields ───────────────────────────────────────
                        brandName:              this.normalizeBrand(page.brand),
                        couponTitle:            title,
                        description:            desc,
                        couponCode:             couponCode || null,
                        discountType:           this.inferDiscountType(title + discount),
                        discountValue:          discount || title,
                        // category is now explicitly passed from the brand configuration
                        category:               page.category,
                        couponLink:             couponLink,
                        terms:                  terms, // Pre-filled from listing page
                        minimumOrder:           minimumOrder,

                        // ── Scraped signal fields ─────────────────────────────
                        trustscore:             pageTrustScore,   // store-level, 0-100
                        usedBy:                 usedByValue,      // uses reported today
                        platformVerified:       platformVerified, // per-coupon badge (explicit only)
                        verified:               platformVerified, // backward compat
                        expiryDate:             expiryDate,
                        liveSuccessRate:        null,  // GrabOn: not exposed per coupon

                        // ── Source credibility (static per adapter) ───────────
                        sourceCredibilityScore: null, // User requested null

                        // ── Computed later by AI / user-feedback pipeline ─────
                        recencyScore:           null, // derived from scrapedAt by engine
                        failureRate:            null, // populated from user feedback
                        confidenceScore:        null, // f(trust, failure, verified, recency)
                        trendVelocity:          null, // computed across scrape runs

                        // ── Internal scraping helpers (deleted before save) ───
                        dataCid:                dataCid,
                        likelyHasCode:          dataType === 'cc_c',
                    });
                });

                logger.info(`GrabOnAdapter: Found ${couponDataList.length} coupons for ${page.brand}`);
          
                // Deep scraping: Visit detail pages to get codes and terms
                if (this.enableDeepScraping && couponDataList.length > 0) {
                    // ── Budget allocation strategy ────────────────────────────────
                    // GrabOn marks cc_c = coupon with code, dl = deal (no code).
                    // Prioritise cc_c coupons so the page budget is spent on coupons
                    // that actually have codes to extract. Remaining slots go to deals
                    // (we still visit them for expiry dates).
                    const withCid = couponDataList.filter(c => c.dataCid);
                    const codeCoupons = withCid.filter(c => c.likelyHasCode);
                    const dealCoupons = withCid.filter(c => !c.likelyHasCode);

                    const codeSlots = Math.min(codeCoupons.length, this.maxDetailPagesPerBrand);
                    const dealSlots = Math.min(dealCoupons.length, this.maxDetailPagesPerBrand - codeSlots);

                    const detailsToFetch = [
                        ...codeCoupons.slice(0, codeSlots),   // codes first
                        ...dealCoupons.slice(0, dealSlots),   // deals fill remaining
                    ];

                    logger.info(
                        `GrabOnAdapter: Deep scraping budget: ${codeSlots} code-coupons + ` +
                        `${dealSlots} deal-coupons = ${detailsToFetch.length} pages for ${page.brand}`
                    );

                    logger.info(`GrabOnAdapter: Deep scraping ${detailsToFetch.length} detail pages for ${page.brand}`);

                    for (let i = 0; i < detailsToFetch.length; i++) {
                        const couponData = detailsToFetch[i];
                        const detailUrl = `${this.baseUrl}/coupon-codes/${couponData.dataCid}/`;

                        try {
                            const details = await browserManager.extractCouponDetails(detailUrl);
                            
                            if (details) {
                                // Coupon code
                                if (details.couponCode) {
                                    couponData.couponCode = details.couponCode;
                                }
                                // Terms & conditions
                                if (details.termsAndConditions) {
                                    couponData.terms = details.termsAndConditions;
                                }
                                // Expiry date — "Valid Till: Apr 30, 2026 (THU)"
                                if (details.expiryDate) {
                                    couponData.expiryDate = details.expiryDate;
                                }
                                // Richer title / description from detail page
                                if (details.title && couponData.couponTitle === couponData.description) {
                                    couponData.couponTitle = details.title;
                                }
                                if (details.description && details.description.length > couponData.description.length) {
                                    couponData.description = details.description;
                                }

                                logger.info(
                                    `GrabOnAdapter: [${i + 1}/${detailsToFetch.length}] ` +
                                    `${details.couponCode ? 'CODE' : 'DEAL'} | ` +
                                    `expiry: ${details.expiryDate ? details.expiryDate.toISOString().slice(0,10) : 'n/a'} | ` +
                                    `${page.brand}`
                                );
                            }

                            // Rate limiting between detail page requests
                            await new Promise(resolve => setTimeout(resolve, 1500));

                        } catch (error) {
                            logger.error(`GrabOnAdapter: Error fetching details from ${detailUrl} - ${error.message}`);
                        }
                    }
                }
console.log(couponDataList);
                // ── Quality filter & cleanup ────────────────────────────────────
                // A usable coupon must have EITHER a coupon code OR a specific
                // coupon-page link (not just a generic brand homepage).
                // Coupons missing both are discarded before MongoDB write.
                let dropped = 0;
                let noExpiry = 0;
                const validCoupons = [];

                couponDataList.forEach(coupon => {
                    const hasCode = !!coupon.couponCode;
                    // couponLink is already the specific GrabOn detail URL if dataCid existed
                    const hasSpecificLink = !!coupon.dataCid; // dataCid → specific URL was built

                    if (!hasCode && !hasSpecificLink) {
                        dropped++;
                        logger.warn(
                            `GrabOnAdapter: DROPPED "${coupon.couponTitle}" — ` +
                            `no coupon code and no specific link (dataCid missing)`
                        );
                        return; // skip
                    }

                    if (!coupon.expiryDate) {
                        noExpiry++;
                        // Warn but keep — AI engine will decide during validation
                        logger.warn(
                            `GrabOnAdapter: NO EXPIRY for "${coupon.couponTitle}" (${page.brand}) — ` +
                            `kept but flagged for AI review`
                        );
                    }

                    // Clean up internal helpers before pushing
                    delete coupon.dataCid;
                    delete coupon.likelyHasCode;
                    validCoupons.push(coupon);
                });

                if (dropped > 0) {
                    logger.warn(`GrabOnAdapter: Dropped ${dropped} unusable coupons for ${page.brand}`);
                }
                if (noExpiry > 0) {
                    logger.warn(`GrabOnAdapter: ${noExpiry} coupons for ${page.brand} have no expiry date`);
                }

                validCoupons.forEach(c => allCoupons.push(c));
                logger.info(`GrabOnAdapter: Completed ${page.brand} — ${validCoupons.length} valid (${dropped} dropped)`);
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

    /**
     * Parses the store-level GrabOn star rating into a 0-100 score.
     * Looks for patterns like "4 / 5 (692 Votes)" or "4.2 / 5 (100 Votes)".
     * Returns null if no rating found.
     */
    parseStoreTrustScore(pageText) {
        const match = pageText.match(/(\d+(?:\.\d+)?)\s*\/\s*5\s*\(\s*(\d+)\s*[Vv]otes?\s*\)/);
        if (!match) return null;
        const rating = parseFloat(match[1]);
        if (isNaN(rating) || rating < 0 || rating > 5) return null;
        return Math.round((rating / 5) * 100);
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

    /**
     * Parses GrabOn's expiry date text into a Date object.
     * Example: "Valid Till: Apr 30, 2026 (THU)"
     */
    parseExpiryDate(text) {
        if (!text) return null;
        try {
            // Remove labels and handle whitespace
            const cleaned = text.replace(/Valid Till:|Expiry:|:/gi, '').trim();
            // Remove day suffix like (THU)
            const dateString = cleaned.replace(/\s*\(\w+\)\s*$/, '').trim();
            const parsedDate = new Date(dateString);
            return isNaN(parsedDate.getTime()) ? null : parsedDate;
        } catch (e) {
            return null;
        }
    }
}

module.exports = GrabOnAdapter;
