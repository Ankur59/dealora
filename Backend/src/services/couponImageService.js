const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');

let browser = null;

const initBrowser = async () => {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return browser;
};

const generateCouponImage = async (couponData) => {
    try {
        const templatePath = path.join(__dirname, '../templates/coupon.ejs');
        const html = await ejs.renderFile(templatePath, {
            couponName: couponData.couponName,
            description: couponData.description,
            categoryLabel: couponData.categoryLabel,
            daysUntilExpiry: couponData.display.daysUntilExpiry,
            initial: couponData.display.initial
        });

        const browserInstance = await initBrowser();
        const page = await browserInstance.newPage();

        // Set viewport to capture full coupon with edges
        await page.setViewport({
            width: 1500,
            height: 750,
            deviceScaleFactor: 2  // High quality
        });

        await page.setContent(html, { waitUntil: 'networkidle0' });

        const screenshot = await page.screenshot({
            type: 'png',
            encoding: 'base64',
            fullPage: true
        });

        await page.close();

        return screenshot;
    } catch (error) {
        console.error('Image generation error:', error);
        throw error;
    }
};

module.exports = { generateCouponImage };