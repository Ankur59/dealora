/**
 * ProxyManager — Smart scrape.do proxy integration.
 *
 * Philosophy: Default = direct connection (no proxy).
 * Proxy activates ONLY when block/captcha/403 detected for a domain.
 * Block state has a TTL (30 min) so we retry direct after cooldown.
 */

const SCRAPE_DO_TOKEN = process.env.SCRAPE_DO_API_KEY || 'e0405003b66b4ce0a54e4681cc1368cb0761a6b31b2';
const SCRAPE_DO_HOST  = 'proxy.scrape.do';
const SCRAPE_DO_PORT  = 8080;

// How long a domain stays "blocked" before we try direct again (ms)
const BLOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

class ProxyManagerService {
  constructor() {
    /**
     * Map<domain, { blockedAt: Date, blockCount: number }>
     * Tracks which domains have been detected as blocking us.
     */
    this._blockedDomains = new Map();

    /**
     * Running count of proxy API calls for monitoring.
     */
    this.proxyCallCount = 0;
  }

  /**
   * Extract domain from a URL string.
   */
  _extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  /**
   * Check if a domain is currently marked as blocked (needs proxy).
   */
  isDomainBlocked(urlOrDomain) {
    const domain = this._extractDomain(urlOrDomain);
    const entry = this._blockedDomains.get(domain);
    if (!entry) return false;

    // Check TTL — if expired, remove and return false
    if (Date.now() - entry.blockedAt > BLOCK_TTL_MS) {
      console.log(`[Proxy] 🔓 Block TTL expired for ${domain}. Trying direct again.`);
      this._blockedDomains.delete(domain);
      return false;
    }
    return true;
  }

  /**
   * Mark a domain as blocked. Called when 403/captcha/IP block detected.
   */
  markBlocked(urlOrDomain) {
    const domain = this._extractDomain(urlOrDomain);
    const existing = this._blockedDomains.get(domain);
    const blockCount = existing ? existing.blockCount + 1 : 1;
    this._blockedDomains.set(domain, {
      blockedAt: Date.now(),
      blockCount,
    });
    console.log(`[Proxy] 🚫 Marked ${domain} as blocked (count: ${blockCount}). Proxy will be used.`);
  }

  /**
   * Clear block status for a domain (e.g., after successful direct access).
   */
  clearBlock(urlOrDomain) {
    const domain = this._extractDomain(urlOrDomain);
    if (this._blockedDomains.has(domain)) {
      this._blockedDomains.delete(domain);
      console.log(`[Proxy] ✅ Cleared block status for ${domain}.`);
    }
  }

  /**
   * Determine if proxy should be used for a given URL.
   * Returns true ONLY if the domain is currently blocked.
   */
  shouldUseProxy(url) {
    return this.isDomainBlocked(url);
  }

  /**
   * Get Playwright-compatible proxy config for scrape.do.
   * Returns null if proxy not needed for the given URL.
   */
  getProxyConfig(url) {
    if (!this.shouldUseProxy(url)) {
      return null;
    }

    this.proxyCallCount++;
    console.log(`[Proxy] 🌐 Using scrape.do proxy for ${this._extractDomain(url)} (total calls: ${this.proxyCallCount})`);

    return {
      server: `http://${SCRAPE_DO_HOST}:${SCRAPE_DO_PORT}`,
      username: 'render',
      password: SCRAPE_DO_TOKEN,
    };
  }

  /**
   * Get proxy config forced (bypass shouldUseProxy check).
   * Used when explicitly retrying with proxy after block detection.
   */
  getProxyConfigForced() {
    this.proxyCallCount++;
    console.log(`[Proxy] 🌐 Forced proxy usage (total calls: ${this.proxyCallCount})`);

    return {
      server: `http://${SCRAPE_DO_HOST}:${SCRAPE_DO_PORT}`,
      username: 'render',
      password: SCRAPE_DO_TOKEN,
    };
  }

  /**
   * Detect if a page response indicates an IP block / bot detection.
   * Call this after page navigation.
   * @param {import('playwright').Page} page
   * @returns {{ blocked: boolean, reason: string }}
   */
  async detectBlock(page) {
    try {
      if (!page || page.isClosed()) {
        return { blocked: false, reason: '' };
      }

      const result = await page.evaluate(() => {
        const title = document.title?.toLowerCase() || '';
        const bodyText = (document.body?.innerText || '').toLowerCase().slice(0, 3000);
        const statusMeta = document.querySelector('meta[http-equiv="status"]');

        const blockIndicators = [
          // HTTP status indicators
          bodyText.includes('403 forbidden'),
          bodyText.includes('access denied'),
          bodyText.includes('access blocked'),
          bodyText.includes('ip has been blocked'),
          bodyText.includes('your ip'),
          bodyText.includes('ip address has been'),
          bodyText.includes('temporarily blocked'),
          bodyText.includes('rate limit'),
          bodyText.includes('too many requests'),

          // Bot detection indicators
          bodyText.includes('captcha'),
          bodyText.includes('are you a robot'),
          bodyText.includes('prove you are human'),
          bodyText.includes('human verification'),
          bodyText.includes('bot detection'),
          bodyText.includes('automated access'),
          bodyText.includes('suspicious activity'),

          // Cloudflare / WAF
          title.includes('just a moment'),
          title.includes('attention required'),
          bodyText.includes('checking your browser'),
          bodyText.includes('ray id'),
          bodyText.includes('cloudflare'),
          bodyText.includes('ddos protection'),

          // PerimeterX / DataDome
          bodyText.includes('perimeterx'),
          bodyText.includes('datadome'),
          bodyText.includes('blocked by'),
        ];

        const isBlocked = blockIndicators.some(Boolean);
        let reason = '';
        if (isBlocked) {
          if (bodyText.includes('403') || bodyText.includes('forbidden')) reason = '403_forbidden';
          else if (bodyText.includes('captcha') || bodyText.includes('robot')) reason = 'captcha_challenge';
          else if (bodyText.includes('rate limit') || bodyText.includes('too many')) reason = 'rate_limited';
          else if (bodyText.includes('cloudflare') || title.includes('just a moment')) reason = 'cloudflare_challenge';
          else reason = 'generic_block';
        }

        return { blocked: isBlocked, reason };
      });

      return result;
    } catch {
      return { blocked: false, reason: '' };
    }
  }

  /**
   * Get stats for monitoring/logging.
   */
  getStats() {
    return {
      totalProxyCalls: this.proxyCallCount,
      blockedDomains: Array.from(this._blockedDomains.entries()).map(([domain, info]) => ({
        domain,
        blockedAt: new Date(info.blockedAt).toISOString(),
        blockCount: info.blockCount,
        ttlRemainingMs: BLOCK_TTL_MS - (Date.now() - info.blockedAt),
      })),
    };
  }
}

export default new ProxyManagerService();
