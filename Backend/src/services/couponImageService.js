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

// const generateCouponImage = async (couponData) => {
//     try {
//         const templatePath = path.join(__dirname, '../templates/coupon.ejs');
//         const html = await ejs.renderFile(templatePath, {
//             couponName: couponData.couponName,
//             description: couponData.description,
//             categoryLabel: couponData.categoryLabel,
//             daysUntilExpiry: couponData.display.daysUntilExpiry,
//             initial: couponData.display.initial,
//             addedMethod: couponData.addedMethod || 'manual'
//         });

//         const browserInstance = await initBrowser();
//         const page = await browserInstance.newPage();

//         await page.setViewport({
//             width: 1500,
//             height: 750,
//             deviceScaleFactor: 2  
//         });

//         await page.setContent(html, {
//             waitUntil: 'domcontentloaded',
//             timeout: 60000
//         });

//         const screenshot = await page.screenshot({
//             type: 'png',
//             encoding: 'base64',
//             fullPage: true
//         });

//         await page.close();

//         return screenshot;
//     } catch (error) {
//         console.error('Image generation error:', error);
//         throw error;
//     }
// };

// TEMPORARY: Return a static placeholder to bypass Puppeteer/Chrome requirements on AWS
const generateCouponImage = async (couponData) => {
    // 1x1 Pixel Transparent PNG base64
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
};

module.exports = { generateCouponImage };