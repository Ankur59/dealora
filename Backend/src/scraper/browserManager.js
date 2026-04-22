/**
 * Browser Manager for Puppeteer - handles headless browser lifecycle
 * Used for deep scraping detail pages to extract hidden codes and terms
 */
const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class BrowserManager {
    constructor() {
        this.browser = null;
    }

    async initialize() {
        if (this.browser) {
            return; // Already initialized
        }

        try {
            logger.info('BrowserManager: Launching Puppeteer browser...');
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            });
            logger.info('BrowserManager: Browser launched successfully');
        } catch (error) {
            logger.error(`BrowserManager: Failed to launch browser - ${error.message}`);
            throw error;
        }
    }

    async createPage() {
        if (!this.browser) {
            await this.initialize();
        }

        const page = await this.browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        return page;
    }

    async extractCouponDetails(url) {
        let page = null;
        try {
            page = await this.createPage();

            // ── Block external redirects ──────────────────────────────────────────
            // GrabOn's "COLLECT COUPON CODE" button navigates *to the merchant site*.
            // We intercept document-type requests and abort any that leave grabon.in,
            // keeping the page in the GrabOn detail page context so we can read
            // expiry and terms without being redirected away.
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const type = req.resourceType();
                const reqUrl = req.url();
                // Only block top-level HTML navigations to external sites
                if (type === 'document' && !reqUrl.includes('grabon.in')) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // Navigate to GrabOn detail page
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Wait for page to render fully
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Extract data using browser JavaScript
            const pageData = await page.evaluate(() => {
                const data = {};
 
                // ── Coupon code: try multiple GrabOn-specific selectors ──────────
                // Order: most specific → least specific
                const codeSelectors = [
                    'p.code',              // GrabOn dedicated code element
                    '.coupon-code-text',
                    '.go-cpn-code',
                    '.go-cpn-show',
                    'input.coupon-code',   // read-only input boxes
                    'input[class*="code"][readonly]',
                    '#couponCode',
                    '#copyCode',
                ];

                for (const sel of codeSelectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const val = (el.value || el.textContent || '').trim();
                        if (val && val.length >= 3) {
                            data.code = val;
                            break;
                        }
                    }
                }

                // Fallback: any element with data-clipboard-text that looks like a code
                if (!data.code) {
                    const clipEls = document.querySelectorAll('[data-clipboard-text]');
                    for (const el of clipEls) {
                        const val = (el.getAttribute('data-clipboard-text') || '').trim();
                        if (val && val.length >= 3 && /^[A-Z0-9]{3,20}$/i.test(val)) {
                            data.code = val;
                            break;
                        }
                    }
                }
                
                // Extract title
                const titleEl = document.querySelector('h1, .offer-title, .cpn-title');
                if (titleEl) data.title = titleEl.textContent.trim();
                
                // Extract description
                const descEl = document.querySelector('.offer-description, .cpn-desc, .offer-detail p');
                if (descEl) data.description = descEl.textContent.trim();
                
                // Extract Terms & Conditions - collect relevant bullet points
                const terms = [];
                const listItems = document.querySelectorAll('ul li');
                listItems.forEach(li => {
                    const text = li.textContent.trim();
                    // Filter out navigation/footer items
                    const isNavigation = text.includes('About Us') || 
                                       text.includes('Privacy Policy') || 
                                       text.includes('Submit Coupon') ||
                                       text.includes('Deals Of The Day') ||
                                       text.includes('.st0') ||
                                       text.includes('fill:') ||
                                       text.includes('Accept cookies') ||
                                       text.includes('Necessary cookies') ||
                                       text.length > 300;
                    
                    if (text.length > 20 && text.length < 300 && !isNavigation) {
                        terms.push(text);
                    }
                });
                
                if (terms.length >= 2 && terms.length <= 20) {
                    data.terms = terms.slice(0, 10).join('\n');
                }
                
                // Extract expiry - multiple strategies
                // GrabOn detail pages show: "Valid Till: Apr 30, 2026 (THU)"
                let expiryText = null;

                // Strategy 1: known CSS classes
                const expiryEl = document.querySelector(
                    '.expiry, .valid-till, .expiry-date, .valid-date, ' +
                    '[class*="expir"], [class*="valid-date"], [class*="valid-till"]'
                );
                if (expiryEl) {
                    expiryText = expiryEl.textContent.trim();
                }

                // Strategy 2: TreeWalker text search for "Valid Till" / "Expires"
                if (!expiryText) {
                    const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    let node;
                    while ((node = walker.nextNode())) {
                        const t = node.textContent.trim();
                        if (
                            t.length > 5 && t.length < 80 &&
                            (
                                t.toLowerCase().includes('valid till') ||
                                t.toLowerCase().includes('expires on') ||
                                t.toLowerCase().includes('expiry') ||
                                t.toLowerCase().includes('valid until')
                            )
                        ) {
                            expiryText = t;
                            break;
                        }
                    }
                }

                data.expiry = expiryText;
                
                return data;
            });

            return {
                couponCode:        pageData.code || null,
                termsAndConditions: pageData.terms || null,
                title:             pageData.title || null,
                description:       pageData.description || null,
                // Parse "Valid Till: Apr 30, 2026 (THU)" → Date object
                expiryDate:        this.parseExpiryDate(pageData.expiry || null),
            };

        } catch (error) {
            logger.error(`BrowserManager: Error extracting details from ${url} - ${error.message}`);
            return null;
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    /**
     * Parses GrabOn's "Valid Till: Apr 30, 2026 (THU)" (and similar) into a Date.
     * Returns a Date object, or null if parsing fails.
     *
     * Supported patterns:
     *   "Valid Till: Apr 30, 2026 (THU)"
     *   "Expires on: 30 April 2026"
     *   "Expiry: 2026-04-30"
     */
    parseExpiryDate(rawText) {
        if (!rawText) return null;

        // Remove the label prefix ("Valid Till:", "Expires on:", etc.)
        const cleaned = rawText
            .replace(/valid\s+till\s*:?/i, '')
            .replace(/expires?\s+on\s*:?/i, '')
            .replace(/expiry\s*:?/i, '')
            .replace(/valid\s+until\s*:?/i, '')
            // Remove day-of-week suffix like "(THU)" or "(Thursday)"
            .replace(/\([A-Za-z]{2,9}\)/g, '')
            .trim();

        if (!cleaned) return null;

        const parsed = new Date(cleaned);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            logger.info('BrowserManager: Browser closed');
        }
    }
}

module.exports = new BrowserManager();
