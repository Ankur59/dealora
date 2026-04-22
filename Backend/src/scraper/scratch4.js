const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  const res = await axios.get('https://www.coupondunia.in/amazon', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const $ = cheerio.load(res.data);
  const card = $('.ofr-card-wrap').first();
  console.log('USED BY:', card.find('.used-tag, .offer-tag-block .used-tag').text().trim());
  console.log('SUCCESS TEXT:', card.find('.success-counter [class*="success-percent"], .success-block [class*="success-percent"]').text().trim());
  console.log('VERIFIED:', card.find('.text-div.verified-div, .verified-tag, .offer-tag-block .verified-tag').text().trim());

  let code = null;
  const offerValue = card.find('[data-offer-key="couponCode"]').attr('data-offer-value');
  if (offerValue && offerValue.trim() && !offerValue.includes('& GET CODE')) code = offerValue.trim();
  if (!code) {
      const p1Text = card.find('.p1-code').text().trim();
      if (p1Text && !p1Text.includes('& GET CODE')) code = p1Text;
  }
  console.log('CODE:', code);
})();
