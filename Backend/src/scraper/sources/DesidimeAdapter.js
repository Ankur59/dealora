const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');
const browserManager = require('../browserManager');

class DesidimeAdapter extends GenericAdapter {
  constructor() {
    super('Desidime', 'https://www.desidime.com');
        this.enableJsRendering = true; // Desidime coupon cards are often JS-rendered
        this.maxCouponsPerBrand = 60; // safety limit
  }

  async scrape() {
    const pages = [
      // Desidime uses /stores/{brand} path (not /stores/{brand}/coupons - redirects)
      // ===== ACTIVE BRANDS - Only scraping these essential brands =====
      // // Food Delivery Apps
      // { brand: 'Zomato', path: '/stores/zomato', category: 'Food' },
      // { brand: 'Swiggy', path: '/stores/swiggy', category: 'Food' },
      // { brand: 'Box8', path: '/stores/box8', category: 'Food' },
      // { brand: 'Eatsure', path: '/stores/eatsure', category: 'Food' },
      // { brand: 'Freshmenu', path: '/stores/freshmenu', category: 'Food' },

      // // E-commerce & Shopping
      { brand: 'Amazon', path: '/stores/amazon-india', category: 'Grocery' },
      // { brand: 'Flipkart', path: '/stores/flipkart', category: 'Grocery' },
      // { brand: 'Snapdeal', path: '/stores/snapdeal', category: 'Grocery' },

      // // Wallet & Payment Apps
      // { brand: 'PhonePe', path: '/stores/phonepe', category: 'Wallet Rewards' },
      // { brand: 'Paytm', path: '/stores/paytm', category: 'Wallet Rewards' },
      // { brand: 'Cred', path: '/stores/cred', category: 'Wallet Rewards' },
      // { brand: 'Dhani', path: '/stores/dhani', category: 'Wallet Rewards' },
      // { brand: 'Freo', path: '/stores/freo', category: 'Wallet Rewards' },

      // // Grocery & Daily Needs
      // { brand: 'Blinkit', path: '/stores/blinkit', category: 'Grocery' },
      // { brand: 'BigBasket', path: '/stores/bigbasket', category: 'Grocery' },

      // // Beauty & Fashion
      // { brand: 'Nykaa', path: '/stores/nykaa', category: 'Beauty' },
      // { brand: 'Myntra', path: '/stores/myntra', category: 'Fashion' },

      // // Travel
      // { brand: 'MakeMyTrip', path: '/stores/makemytrip', category: 'Travel' },

      // ===== COMMENTED OUT - Not needed currently =====
      // { brand: 'TWID', path: '/stores/twid', category: 'Wallet Rewards' },
      // { brand: 'Pop', path: '/stores/pop', category: 'Wallet Rewards' },
      // { brand: 'NPCL', path: '/stores/npcl', category: 'All' },
      // { brand: 'Kiwi', path: '/stores/kiwi', category: 'Wallet Rewards' },
      // { brand: 'Payzapp', path: '/stores/payzapp', category: 'Wallet Rewards' },
      // { brand: 'Freecharge', path: '/stores/freecharge', category: 'Wallet Rewards' },
      // { brand: 'BharatNxt', path: '/stores/bharatnxt', category: 'Wallet Rewards' },
      // { brand: 'Sarvatra tech', path: '/stores/sarvatra', category: 'All' },
      // { brand: 'Payworld', path: '/stores/payworld', category: 'Wallet Rewards' },
      // { brand: 'Rio Money', path: '/stores/rio-money', category: 'Wallet Rewards' },
      // { brand: 'Payinstacard', path: '/stores/payinstacard', category: 'Wallet Rewards' },
      // { brand: 'nearwala', path: '/stores/nearwala', category: 'Grocery' },
      // { brand: 'Limeroad', path: '/stores/limeroad', category: 'Grocery' },
      // { brand: 'Shopclues', path: '/stores/shopclues', category: 'Grocery' },
      // { brand: 'Rebel foods', path: '/stores/rebel-foods', category: 'Food' },
      // { brand: 'Fassos', path: '/stores/fassos', category: 'Food' },
      // { brand: 'Zingbus', path: '/stores/zingbus', category: 'Travel' },
      // { brand: 'Satvacart', path: '/stores/satvacart', category: 'Grocery' },
      // { brand: 'Dealshare', path: '/stores/dealshare', category: 'Grocery' },
      // { brand: 'Salon Nayana', path: '/stores/salon-nayana', category: 'Beauty' },
      // { brand: 'HR Wellness', path: '/stores/hr-wellness', category: 'Beauty' },
    ];

    let allCoupons = [];
        let didUseBrowser = false;

        if (this.enableJsRendering) {
          try {
            await browserManager.initialize();
            didUseBrowser = true;
          } catch (error) {
            logger.error(`DesidimeAdapter: Failed to initialize browser, falling back to static HTML - ${error.message}`);
            this.enableJsRendering = false;
          }
        }

    for (const page of pages) {
      try {
        logger.info(`DesidimeAdapter: Scraping ${page.brand} from ${page.path}`);
        const html = await this.fetchHtml(page.path);

        // Skip if page not found (404)
        if (!html) {
          logger.warn(`DesidimeAdapter: Skipping ${page.brand} - page not found`);
          continue;
        }

                // Desidime coupon cards are JS-rendered; the raw HTML frequently contains no usable cards
                // (and may still contain the string "coupon-item" inside scripts). Prefer browser rendering.
                if (this.enableJsRendering) {
                  logger.info(`DesidimeAdapter: Using browser rendering for ${page.brand}...`);
                  const browserPage = await browserManager.createPage();
                  try {
                    const targetUrl = this.baseUrl + page.path;
                    await browserPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    await new Promise(r => setTimeout(r, 5000));

                    const landedUrl = browserPage.url();
                    const preCounts = await browserPage.evaluate(() => ({
                      couponItem: document.querySelectorAll('div.coupon-item').length,
                      dealItem: document.querySelectorAll('div.deal-item, article.deal-card, article[class*="deal-card"]').length,
                      hasStoreNotFound: /Store Not Found/i.test(document.body?.innerText || ''),
                    }));
                    logger.info(
                      `DesidimeAdapter: Render landing url=${landedUrl} couponItem=${preCounts.couponItem} dealItem=${preCounts.dealItem} storeNotFound=${preCounts.hasStoreNotFound}`
                    );

                    if (preCounts.couponItem === 0) {
                      await new Promise(r => setTimeout(r, 8000));
                    }

                    await browserPage.waitForSelector('div.coupon-item', { timeout: 20000 });

                    const renderedCoupons = await browserPage.evaluate((brand, category, maxItems) => {
                      const cards = Array.from(document.querySelectorAll('div.coupon-item'));
                      return cards.map(card => {
                        const text = (card.textContent || '').replace(/\\s+/g, ' ').trim();
                        const lowerText = text.toLowerCase();

                        // Hard-coupon filter:
                        // Keep only cards that show coupon intent (code / get coupon / reveal / copy).
                        const hardCouponSignals = [
                          'get coupon',
                          'coupon code',
                          'reveal',
                          'copy code',
                          'show code',
                          'code'
                        ];
                        const hasHardCouponSignal = hardCouponSignals.some(signal => lowerText.includes(signal));
                        if (!hasHardCouponSignal) return null;

                        const titleEl =
                          card.querySelector('[class*=\"break-words\"]') ||
                          card.querySelector('[class*=\"long-title\"]') ||
                          card.querySelector('h2, h3, h4');
                        const title = (titleEl?.textContent || text.split('  ')[0] || '').trim();

                        const usedMatch = text.match(/(\\d[\\d,]*)\\s*used\\b/i);
                        const usedBy = usedMatch ? Number(usedMatch[1].replace(/,/g, '')) : null;

                        const verified = /\\bverified\\b/i.test(text) ? true : null;

                        return {
                          brandName: brand,
                          couponTitle: title || 'Exciting Offer',
                          description: title || 'Exciting Offer',
                          couponCode: null,
                          discountType: 'unknown',
                          discountValue: null,
                          category,
                          couponLink: null, // will be overwritten by adapter normalization brand URL
                          trustscore: null,
                          usedBy,
                          verified,
                        };
                      }).filter(Boolean).slice(0, maxItems);
                    }, page.brand, page.category, this.maxCouponsPerBrand);

                    const brandUrl = this.getBrandUrl(page.brand) || 'https://www.example.com';
                    renderedCoupons.forEach(c => {
                      c.couponLink = brandUrl;
                      allCoupons.push(c);
                    });

                    logger.info(`DesidimeAdapter: Rendered ${renderedCoupons.length} coupon cards for ${page.brand}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue; // skip static parsing for this brand
                  } catch (error) {
                    logger.error(`DesidimeAdapter: Browser rendering failed for ${page.brand} - ${error.message}. Falling back to static parsing.`);
                  } finally {
                    await browserPage.close();
                  }
                }

                const $ = cheerio.load(html);
        let brandCoupons = 0;

        // Log first few lines of HTML to debug
        if (brandCoupons === 0 && html.length > 0) {
          logger.debug(`DesidimeAdapter: HTML received for ${page.brand}, length: ${html.length}`);
        }

        // Desidime: ONLY scrape coupon cards (ignore "deal" cards).
        // Coupon cards look like: <div class="coupon-item" id="deal_coupon_543863" ...>
        const selectors = ['.coupon-item', 'div.coupon-item[id^="deal_coupon_"]', 'div.coupon-item[data-gtm-coupon-id]'];

        // Try to find any deals/coupons
        let foundElements = 0;
        selectors.forEach((selector) => {
          const elements = $(selector);
          if (elements.length > 0) {
            foundElements += elements.length;
            logger.debug(
              `DesidimeAdapter: Found ${elements.length} elements with selector: ${selector} for ${page.brand}`
            );
          }
        });

        if (foundElements === 0) {
          logger.warn(`DesidimeAdapter: No coupon/deal elements found for ${page.brand} using standard selectors.`);
          logger.warn(
            `DesidimeAdapter: This may mean: 1) Website structure changed, 2) Content is JavaScript-rendered (cheerio can't parse), 3) Website is blocking scrapers`
          );
        }

        // ONLY coupon cards (ignore .deal-item / article.deal-card etc.)
        $('.coupon-item, div.coupon-item[id^="deal_coupon_"], div.coupon-item[data-gtm-coupon-id]').each((i, el) => {
          const $el = $(el);

          // Try multiple selectors for title
          const title =
            $el.find('.deal-title, .title, h2, h3, h4, [class*="title"]').first().text().trim() ||
            $el.find('a.deal-link, a').first().text().trim() ||
            $el.text().split('\n')[0].trim();

          // Try multiple selectors for discount
          const discount =
            $el.find('.deal-discount, .discount, .savings, [class*="discount"]').text().trim() ||
            $el.find('.badge, .tag, .label, [class*="badge"]').text().trim();

          // Try multiple selectors for coupon code
          const code =
            $el.find('.coupon-code, .code, .promo-code, [class*="code"]').text().trim() ||
            $el.find('input.code-input, input[type="text"]').val() ||
            $el.attr('data-code') ||
            $el.attr('data-coupon-code');

          // Try multiple selectors for description
          const desc =
            $el.find('.deal-description, .description, .details, [class*="desc"]').text().trim() ||
            $el.find('p').text().trim();

          // Desidime (current UI): fields are inside the card
          // - verified: a badge/span with text "Verified" (often near left)
          // - usedBy: a span with text like "571 Used"
          const usedByText = $el
            .find('span')
            .filter((_, s) => /used/i.test($(s).text()))
            .first()
            .text()
            .trim();

          const verifiedText = $el
            .find('span')
            .filter((_, s) => /verified/i.test($(s).text()))
            .first()
            .text()
            .trim();
          const isVerifiedPresent = $el.find('span').filter((_, s) => /verified/i.test($(s).text())).length > 0;

          // Try multiple selectors for link
          const link = $el.find('a.deal-link, a').attr('href') || $el.attr('href') || this.baseUrl + page.path;

          if (title && title.length > 3) {
            // Get the actual brand website URL instead of source website
            const brandUrl = this.getBrandUrl(page.brand) || 'https://www.example.com'; // Always use brand URL

            allCoupons.push({
              brandName: page.brand,
              couponTitle: title,
              description: desc || title,
              couponCode: code || null,
              discountType: this.inferDiscountType(title + ' ' + discount),
              discountValue: discount || this.extractDiscountValue(title),
              category: page.category,
              couponLink: brandUrl,
              trustscore: null, // Desidime doesn't expose a stable trustscore/success metric in listing HTML
              usedBy: this.parseCountFromText(usedByText),
              verified: isVerifiedPresent ? (this.parseVerifiedFlag(verifiedText) ?? true) : null,
            });
            brandCoupons++;
          }
        });

        logger.info(`DesidimeAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = error.message || String(error);
        logger.error(`DesidimeAdapter Error for ${page.brand}: ${errorMsg}`);
        // Continue with next brand even if one fails
      }
    }
    console.log(allCoupons, 'hereehehehe');
        if (didUseBrowser) {
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

module.exports = DesidimeAdapter;
