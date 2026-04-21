const cheerio = require('cheerio');
const GenericAdapter = require('./GenericAdapter');
const logger = require('../../utils/logger');

class CouponDuniyaAdapter extends GenericAdapter {
  constructor() {
    super('CouponDuniya', 'https://www.coupondunia.in');
  }

  /**
   * Convert brand name to URL-friendly slug
   * Example: "Flipkart" -> "flipkart", "Rebel foods" -> "rebel-foods"
   */
  brandToSlug(brand) {
    return brand
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  async scrape() {
    const brands = [
      // ===== ACTIVE BRANDS - Only scraping these essential brands =====
      // Food Delivery Apps
      // { brand: 'Zomato', category: 'Food' },
      // { brand: 'Swiggy', category: 'Food' },
      // { brand: 'Box8', category: 'Food' },
      // { brand: 'Eatsure', category: 'Food' },
      // { brand: 'Freshmenu', category: 'Food' },

      // // E-commerce & Shopping
      { brand: 'Amazon', category: 'Grocery' },
      // { brand: 'Flipkart', category: 'Grocery' },
      // { brand: 'Snapdeal', category: 'Grocery' },

      // // Wallet & Payment Apps
      // { brand: 'PhonePe', category: 'Wallet Rewards' },
      // { brand: 'Paytm', category: 'Wallet Rewards' },
      // { brand: 'Cred', category: 'Wallet Rewards' },
      // { brand: 'Dhani', category: 'Wallet Rewards' },
      // { brand: 'Freo', category: 'Wallet Rewards' },

      // Grocery & Daily Needs
      // { brand: 'Blinkit', category: 'Grocery' },
      // { brand: 'BigBasket', category: 'Grocery' },

      // // Beauty & Fashion
      // { brand: 'Nykaa', category: 'Beauty' },
      // { brand: 'Myntra', category: 'Fashion' },

      // // Travel
      // { brand: 'MakeMyTrip', category: 'Travel' },

      // ===== COMMENTED OUT - Not needed currently =====
      // { brand: 'TWID', category: 'Wallet Rewards' },
      // { brand: 'Pop', category: 'Wallet Rewards' },
      // { brand: 'NPCL', category: 'All' },
      // { brand: 'Kiwi', category: 'Wallet Rewards' },
      // { brand: 'Payzapp', category: 'Wallet Rewards' },
      // { brand: 'Freecharge', category: 'Wallet Rewards' },
      // { brand: 'BharatNxt', category: 'Wallet Rewards' },
      // { brand: 'Sarvatra tech', category: 'All' },
      // { brand: 'Payworld', category: 'Wallet Rewards' },
      // { brand: 'Rio Money', category: 'Wallet Rewards' },
      // { brand: 'Payinstacard', category: 'Wallet Rewards' },
      // { brand: 'nearwala', category: 'Grocery' },
      // { brand: 'Limeroad', category: 'Grocery' },
      // { brand: 'Shopclues', category: 'Grocery' },
      // { brand: 'Rebel foods', category: 'Food' },
      // { brand: 'Fassos', category: 'Food' },
      // { brand: 'Zingbus', category: 'Travel' },
      // { brand: 'Satvacart', category: 'Grocery' },
      // { brand: 'Dealshare', category: 'Grocery' },
      // { brand: 'Salon Nayana', category: 'Beauty' },
      // { brand: 'HR Wellness', category: 'Beauty' },
    ];

    // Convert to pages with correct URL format: /brand (e.g., /flipkart)
    const pages = brands.map((b) => ({
      brand: b.brand,
      path: `/${this.brandToSlug(b.brand)}`,
      category: b.category,
    }));

    let allCoupons = [];

    for (const page of pages) {
      try {
        logger.info(`CouponDuniyaAdapter: Scraping ${page.brand} from ${page.path}`);
        const html = await this.fetchHtml(page.path);

        // Skip if page not found (404)
        if (!html) {
          logger.warn(
            `CouponDuniyaAdapter: Skipping ${page.brand} - page not found (404). Path may be incorrect: ${this.baseUrl}${page.path}`
          );
          logger.warn(
            `CouponDuniyaAdapter: Note - CouponDuniya website structure may have changed. These paths may not exist.`
          );
          continue;
        }

        const $ = cheerio.load(html);
        let brandCoupons = 0;

        // Extract terms from the entire page (not per-coupon)
        // CouponDuniya shows all T&C in .more-desc-text sections and span elements
        const pageTermsElements = $(
          '.desc-txt.more-desc span, .more-desc-text span, .more-desc-text, .desc-txt.more-desc li'
        );
        const pageTerms = [];
        pageTermsElements.each((idx, termEl) => {
          const termText = $(termEl).text().trim();
          // Filter out short items, navigation, and junk text
          if (
            termText.length > 20 &&
            !termText.match(
              /^(Home|About|Contact|Categories|Login|Sign up|COPY CODE|Visit|registered users|Hide Details|Show Details)/i
            ) &&
            !termText.includes('Something went wrong') &&
            !termText.includes('verified today') &&
            !termText.includes('email')
          ) {
            // Avoid duplicates
            if (!pageTerms.includes(termText)) {
              pageTerms.push(termText);
            }
          }
        });
        const combinedPageTerms = pageTerms.length > 0 ? pageTerms.join('\n').substring(0, 2000) : null;

        // CouponDuniya: target the actual offer card wrapper to avoid capturing
        // nested fragments like "Show Details/Hide Details", "Get Coupon", etc.
        $(
          // Primary card wrapper(s) seen in current CouponDuniya UI
          '.ofr-card-wrap.revert, .ofr-card-wrap, .offer-card-ctr.offer-card-v2, .offer-card-main'
        ).each((i, el) => {
          const $el = $(el);

          // Try multiple selectors for title
          const title =
            $el
              .find('.store-title-block .long-title, .store-title-block .short-title, .coupon-title, .deal-title, .offer-title, h3, h4, h2, .title, [class*="title"]')
              .first()
              .text()
              .trim() ||
            $el.find('a').first().text().trim() ||
            $el.text().split('\n')[0].trim();

          // Try multiple selectors for discount
          const discount =
            $el.find('.discount, .offer, .savings, [class*="discount"], [class*="offer"]').text().trim() ||
            $el.find('.badge, .tag, [class*="badge"]').text().trim();

          // Try multiple selectors for coupon code
          const code =
            $el.find('.coupon-code, .code, .promo-code, [class*="code"]').text().trim() ||
            $el.find('input[type="text"]').val() ||
            $el.attr('data-code');

          // Try multiple selectors for description
          const desc =
            $el.find('.description, .details, .terms, [class*="desc"], [class*="detail"]').text().trim() ||
            $el.find('p').text().trim();

          // CouponDuniya tags (current UI)
          // - usedBy: <div class="used-tag">"50 People Used Today"</div> (may be missing on some cards)
          // - verified: <div class="text-div verified-div">"Verified today"</div>
          // - trustscore: <span class="...success-percent">100%</span> inside .success-counter (can be hidden until "See details" but present in HTML)
          const usedByText = $el.find('.offer-tag-block .used-tag, .used-tag').first().text().trim();

          const verifiedText = $el.find('.text-div.verified-div, .verified-tag, .offer-tag-block .verified-tag').first().text().trim();
          const isVerifiedPresent = $el.find('.text-div.verified-div, .verified-tag, .offer-tag-block .verified-tag').length > 0;

          const successPercentText = $el
            .find('.success-block .success-counter [class*="success-percent"], .success-counter [class*="success-percent"], [class*="success-percent"]')
            .first()
            .text()
            .trim();

          // Try multiple selectors for link
          const link = $el.find('a').attr('href') || $el.attr('href') || this.baseUrl + page.path;

          const isJunkTitle =
            !title ||
            title.length <= 3 ||
            /show details|hide details|get coupon|success/i.test(title) ||
            title.includes('deals from') ||
            title.includes('email');

          if (!isJunkTitle) {
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
              terms: combinedPageTerms, // Use page-level terms for all coupons from this brand
              trustscore: this.parseCountFromText(successPercentText),
              usedBy: this.parseCountFromText(usedByText) ?? 0,
              verified: isVerifiedPresent ? (this.parseVerifiedFlag(verifiedText) ?? true) : null,
            });
            brandCoupons++;
          }
        });

        logger.info(`CouponDuniyaAdapter: Scraped ${brandCoupons} coupons for ${page.brand}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = error.message || String(error);
        logger.error(`CouponDuniyaAdapter Error for ${page.brand}: ${errorMsg}`);
        // Continue with next brand even if one fails
      }
    }
    // Use project logger (more reliable than console.log in some runtimes)
    logger.info(
      `CouponDuniyaAdapter: Total scraped coupons=${allCoupons.length}. Sample=${JSON.stringify(allCoupons.slice(0, 3))}`
    );
    console.log(allCoupons,"hereehehehe");
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

module.exports = CouponDuniyaAdapter;
