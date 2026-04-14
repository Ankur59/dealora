# AI Validator — Coupon Verification Dashboard

This is the admin dashboard for Dealora's coupon validation system. It lets you manage merchants/partners, store their login credentials, queue up coupon codes for testing, and see the results after the AI agent finishes its runs.

The backend (in `ai-coupon-engine`) does the heavy lifting — it spins up a headless browser using Playwright, logs into merchant sites with the credentials you provide, adds stuff to cart based on the offer conditions, and tries applying the coupon code at checkout. Gemini Flash handles the decision-making (figuring out which buttons to click, where to type, etc).

The whole thing runs automatically every 12 hours via a cron job, but you can also trigger a run manually from the dashboard.

---

## Prerequisites

- **Node.js** v18 or newer
- **MongoDB** running somewhere (local or Atlas, doesn't matter)
- A **Google Gemini API key** (for the AI agent brain)
- Playwright browsers installed (one-time setup, see below)

## Getting started

### 1. Backend setup (ai-coupon-engine)

Go to the `ai-coupon-engine` folder and install deps:

```bash
cd ai-coupon-engine
npm install
```

Install the Playwright browsers — you only need to do this once:

```bash
npx playwright install chromium
```

Create a `.env` file in `ai-coupon-engine/`:

```env
PORT=8000
MONGODB_URI=mongodb://localhost:27017/dealora
CORS_ORIGIN=http://localhost:5173

GEMINI_API_KEY=your_gemini_api_key_here

ADMIN_USERNAME=pick_something_really_hard_to_guess
ADMIN_PASSWORD=same_here_make_it_strong
```

The `ADMIN_USERNAME` and `ADMIN_PASSWORD` are what you'll use to log into the dashboard. Pick something that isn't easy to brute-force — this is the only thing standing between the dashboard and the outside world.

Start the backend:

```bash
npm run dev
```

### 2. Frontend setup (ai_validator)

In a separate terminal, go to the `ai_validator` folder:

```bash
cd ai_validator
npm install
```

If your backend isn't running on `localhost:8000`, create a `.env` file here too:

```env
VITE_API_URL=http://localhost:8000/api/v1/validator
```

(If you skip this, it defaults to `http://localhost:8000/api/v1/validator` anyway.)

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. You'll see a login page — use the username and password you set in the backend `.env`.

---

## How it all works

### The flow

1. You add a **Partner** (like "Amazon", "Flipkart", whatever) with their website URL
2. You add **Credentials** for that partner — the login email/password that the bot will use on the merchant's site
3. You add **Offers** — the actual coupon codes you want to test, along with the URL to visit and some conditions the AI should follow (like "add a shirt to cart first")
4. Every 12 hours the cron kicks in, or you hit "Run Validation Now" on the dashboard
5. For each offer, the AI agent:
   - Opens the offer URL in a headless Chromium browser
   - If credentials exist for that partner, it navigates to the login page and signs in
   - Goes back to the offer page, browses around to meet the offer conditions (adding items to cart, etc)
   - Finds the coupon code input at checkout, types in the code, hits Apply
   - Checks if the discount went through or if it got an error
6. Results get saved to the database with full step-by-step logs

### The partner_name link

Everything is tied together by `partnerName`. When you create a partner called "Amazon", then add credentials for "Amazon" and offers for "Amazon", the validator knows which login to use for which offers. Keep the names consistent.

### About the offer URL

The `offerUrl` field doesn't have to be a direct product link. You can just put the homepage of the merchant and the AI will try to navigate from there. It reads the page content, figures out what's interactive, and works its way to checkout. That said, giving it a more specific URL (like a product page) will obviously make things faster and more reliable.

### About the terms and conditions field

This is basically your instruction to the AI. Tell it what to do before applying the coupon — something like "add any electronics item over $50 to cart" or "select the monthly subscription plan". The more specific you are, the better the results.

---

## Dashboard pages

- **Overview** — quick stats: how many partners, total offers, how many are verified valid vs invalid, success rate
- **Partners** — add/remove merchant partners and their site URLs
- **Credentials** — store login details per partner (passwords are stored as-is since the bot needs to actually type them)
- **Offers** — manage coupon codes to test, each linked to a partner
- **Results** — see the full audit log of every validation run with step-by-step AI execution logs

---

## Gotchas / things worth knowing

- The AI agent has a 12-step limit per action (login, cart, coupon). If the site is too complex or has captchas, it might fail. That's expected.
- Playwright runs in headless mode by default. If you want to watch what the bot is doing for debugging, change `headless: true` to `headless: false` in `validator.service.js`.
- Credentials are stored in plaintext in MongoDB because the bot literally needs to type them into form fields. Don't use this on a publicly exposed database without proper access controls.
- The cron runs at minute 0 of every 12th hour (midnight and noon basically). If you restart the server, the timer resets from that point.
- If the `GEMINI_API_KEY` isn't set, the validator just skips the run and logs a warning. It won't crash.

---

## Building for production

```bash
cd ai_validator
npm run build
```

The built files end up in `dist/`. Serve them however you like (nginx, express static, etc). Just make sure the API URL env var points to your production backend.
