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

            // Navigate to detail page
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for dynamic content
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Extract data using browser JavaScript
            const pageData = await page.evaluate(() => {
                const data = {};
                
                // Extract coupon code - CORRECT SELECTOR: p.code
                const codeElement = document.querySelector('p.code');
                if (codeElement && codeElement.textContent.trim()) {
                    data.code = codeElement.textContent.trim();
                }
                
                // Fallback: Try data-clipboard-text from copy button
                if (!data.code) {
                    const copyButton = document.querySelector('#copyCode, [data-clipboard-text]');
                    if (copyButton) {
                        data.code = copyButton.getAttribute('data-clipboard-text');
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
                
                // Extract expiry
                const expiryEl = document.querySelector('.expiry, .valid-till, [class*="expire"]');
                if (expiryEl) data.expiry = expiryEl.textContent.trim();
                
                return data;
            });

            return {
                couponCode: pageData.code || null,
                termsAndConditions: pageData.terms || null,
                title: pageData.title || null,
                description: pageData.description || null,
                expiryInfo: pageData.expiry || null
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

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            logger.info('BrowserManager: Browser closed');
        }
    }
}

module.exports = new BrowserManager();
