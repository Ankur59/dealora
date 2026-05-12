/**
 * Test script to validate GrabOn deep scraping integration
 * Tests: listing scraping → detail page scraping → database saving
 */
require('dotenv').config();
const mongoose = require('mongoose');
const GrabOnAdapter = require('./src/scraper/sources/GrabOnAdapter');
const ScraperEngine = require('./src/scraper/engine');
const logger = require('./src/utils/logger');
const Coupon = require('./src/models/Coupon');

async function testGrabOnIntegration() {
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║   GrabOn Deep Scraping Integration Test                         ║');
    console.log('║   Testing: Listing → Detail Pages → Database                    ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    try {
        // Connect to database
        console.log('📦 Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Database connected\n');

        // Limit scraper to just 2 brands for testing
        const grabon = new GrabOnAdapter();
        grabon.maxDetailPagesPerBrand = 3; // Limit to 3 detail pages per brand
        
        // Override scrape to test only first 2 brands (faster testing)
        const originalScrape = grabon.scrape.bind(grabon);
        grabon.scrape = async function() {
            const allPages = [
                // Popular brands (more likely to have active coupons with codes)
                { brand: 'Zomato', path: '/zomato-coupons/', category: 'Food' },
                { brand: 'Amazon', path: '/amazon-coupons/', category: 'Grocery' },
            ];
            
            let allCoupons = [];

            // Initialize browser if deep scraping is enabled
            if (this.enableDeepScraping) {
                try {
                    const browserManager = require('./src/scraper/browserManager');
                    await browserManager.initialize();
                } catch (error) {
                    logger.error(`GrabOnAdapter: Failed to initialize browser - ${error.message}`);
                    this.enableDeepScraping = false;
                }
            }

            for (const page of allPages) {
                try {
                    logger.info(`GrabOnAdapter: Scraping ${page.brand} from ${page.path}`);
                    const html = await this.fetchHtml(page.path);
                    
                    if (!html) {
                        logger.warn(`GrabOnAdapter: Skipping ${page.brand} - page not found`);
                        continue;
                    }
                    
                    const cheerio = require('cheerio');
                    const $ = cheerio.load(html);
                    
                    // Extract coupon IDs and basic info
                    const couponDataList = [];
                    $('div.gc-box').each((i, el) => {
                        const title = $(el).find('p').first().text().trim();
                        if (!title) return;

                        const discount = $(el).find('.bm, .txt').text().trim();
                        const dataCid = $(el).attr('data-cid');
                        const dataType = $(el).attr('data-type');
                        const desc = $(el).find('p').text().trim();
                        
                        let couponCode = $(el).find('.go-cpn-show').text().trim();
                        const buttonTexts = [
                            'SHOW COUPON CODE', 'GET CODE', 'REVEAL CODE', 'COPY CODE',
                            'ACTIVATE OFFER', 'GET DEAL', 'SHOP NOW', 'CLICK HERE',
                            'VIEW OFFER', 'GRAB OFFER', 'REDEEM NOW', 'UNLOCK COUPON CODE'
                        ];
                        if (couponCode && (buttonTexts.some(btn => couponCode.toUpperCase().includes(btn)) || couponCode.length > 20)) {
                            couponCode = null;
                        }

                        couponDataList.push({
                            brandName: page.brand,
                            couponTitle: title,
                            description: desc,
                            couponCode: couponCode || null,
                            discountType: this.inferDiscountType(title + discount),
                            discountValue: discount || title,
                            category: page.category,
                            couponLink: this.baseUrl + page.path,
                            terms: null,
                            dataCid: dataCid,
                            likelyHasCode: dataType === 'cc_c'
                        });
                    });

                    logger.info(`GrabOnAdapter: Found ${couponDataList.length} coupons for ${page.brand}`);

                    // Deep scraping
                    if (this.enableDeepScraping && couponDataList.length > 0) {
                        const browserManager = require('./src/scraper/browserManager');
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

                                await new Promise(resolve => setTimeout(resolve, 1500));

                            } catch (error) {
                                logger.error(`GrabOnAdapter: Error fetching details - ${error.message}`);
                            }
                        }
                    }

                    // Remove temporary fields
                    couponDataList.forEach(coupon => {
                        delete coupon.dataCid;
                        delete coupon.likelyHasCode;
                        allCoupons.push(coupon);
                    });

                    logger.info(`GrabOnAdapter: Completed ${page.brand}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    logger.error(`GrabOnAdapter Error for ${page.brand}: ${error.message}`);
                }
            }

            // Close browser
            if (this.enableDeepScraping) {
                const browserManager = require('./src/scraper/browserManager');
                await browserManager.close();
            }

            return allCoupons;
        };

        console.log('🔍 Starting GrabOn scraper (testing 2 brands: Zomato, Amazon)...\n');
        
        const engine = new ScraperEngine([grabon]);
        const results = await engine.runAll();

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 INTEGRATION TEST RESULTS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Query database to verify saves
        const savedCoupons = await Coupon.find({ 
            source: 'GrabOn',
            createdAt: { $gte: new Date(Date.now() - 60000) } // Last 1 minute
        }).sort({ createdAt: -1 });

        console.log(`\n✅ Total coupons saved: ${savedCoupons.length}`);
        
        if (savedCoupons.length > 0) {
            console.log('\n📋 Sample of saved coupons:\n');
            
            const withCode = savedCoupons.filter(c => c.couponCode);
            const withTerms = savedCoupons.filter(c => c.terms);
            
            console.log(`   • Coupons with CODE: ${withCode.length}/${savedCoupons.length} (${Math.round(withCode.length / savedCoupons.length * 100)}%)`);
            console.log(`   • Coupons with TERMS: ${withTerms.length}/${savedCoupons.length} (${Math.round(withTerms.length / savedCoupons.length * 100)}%)`);
            
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📝 SAMPLE COUPON DETAILS (First 3):');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            savedCoupons.slice(0, 3).forEach((coupon, idx) => {
                console.log(`${idx + 1}. Brand: ${coupon.brandName}`);
                console.log(`   Title: ${coupon.couponTitle}`);
                console.log(`   Code: ${coupon.couponCode || '❌ No code (Deal)'}`);
                console.log(`   Terms: ${coupon.terms ? '✅ Present (' + coupon.terms.split('\n').length + ' lines)' : '❌ Not found'}`);
                console.log(`   Source: ${coupon.source}`);
                console.log(`   Category: ${coupon.categoryLabel}`);
                console.log();
            });

            // Show detailed view of one coupon with code and terms
            const couponWithCode = savedCoupons.find(c => c.couponCode && c.terms);
            if (couponWithCode) {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🎯 DETAILED VIEW - COUPON WITH CODE & TERMS:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                console.log(`Brand: ${couponWithCode.brandName}`);
                console.log(`Title: ${couponWithCode.couponTitle}`);
                console.log(`Code: ${couponWithCode.couponCode}`);
                console.log(`\nTerms & Conditions:`);
                console.log(couponWithCode.terms.substring(0, 500));
                if (couponWithCode.terms.length > 500) console.log('...');
                console.log();
            }
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('✅ Integration test completed successfully!\n');

    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('📦 Database connection closed\n');
    }
}

// Run test
testGrabOnIntegration();
