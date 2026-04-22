const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  const res = await axios.get('https://www.coupondunia.in/amazon', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const $ = cheerio.load(res.data);
  const card = $('.ofr-card-wrap').first();
  console.log('HTML of first card:');
  console.log(card.html().substring(0, 1000));
  
  // also dump one card that has a "Coupon Activated" text
  $('.ofr-card-wrap').each((i, el) => {
    if ($(el).text().includes('Coupon Activated')) {
      console.log(`\n\nCard [${i}] with Coupon Activated HTML:`);
      console.log($(el).html().substring(0, 1000));
      return false; // break loop
    }
  });
})();
