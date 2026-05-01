const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
    try {
        const res = await axios.get('https://www.coupondunia.in/amazon', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const $ = cheerio.load(res.data);
        const card = $('.ofr-card-wrap').first();
        
        // Emulate the CouponDuniyaAdapter logic
        const $usedByEl = card.find('.used-tag, .offer-tag-block .used-tag').first().clone();
        $usedByEl.find('style, script, svg').remove();
        const usedByText = $usedByEl.text().trim();
        
        const $successEl = card.find('[class*="success-percent"]').first().clone();
        $successEl.find('style, script').remove();
        const successPercentText = $successEl.text().trim();

        console.log('--- TEST RESULTS ---');
        console.log('Cleaned Used By Text:', usedByText);
        console.log('Cleaned Success Percent Text:', successPercentText);
        
        // Verify parsing logic
        const parseCount = (v) => {
            if (!v) return null;
            const m = v.match(/(\d[\d,]*)/);
            return m ? parseInt(m[1].replace(/,/g, '')) : null;
        };

        console.log('Parsed Used By:', parseCount(usedByText));
        console.log('Parsed Trustscore:', parseCount(successPercentText));

    } catch (e) {
        console.error(e);
    }
})();
