/**
* Comprehensive stealth patches for Playwright to evade bot detection.
* Injected via context.addInitScript() BEFORE any page scripts run.
*
* Targets: Akamai Bot Manager, Cloudflare, PerimeterX, DataDome, etc.
*/
export function getStealthScript() {
  return `
    // ── 1. navigator.webdriver ──────────────────────────────────────────
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // ── 2. Chrome runtime & APIs ────────────────────────────────────────
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        connect: function() {},
        sendMessage: function() {},
        id: undefined,
        onMessage: { addListener: function() {}, removeListener: function() {} },
        onConnect: { addListener: function() {}, removeListener: function() {} },
      };
    }
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = function() {
        return {
          commitLoadTime: Date.now() / 1000,
          connectionInfo: 'http/1.1',
          finishDocumentLoadTime: Date.now() / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: Date.now() / 1000,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'unknown',
          requestTime: Date.now() / 1000 - 0.3,
          startLoadTime: Date.now() / 1000 - 0.5,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
        };
      };
    }
    if (!window.chrome.csi) {
      window.chrome.csi = function() {
        return { onloadT: Date.now(), pageT: Date.now() / 1000, startE: Date.now(), tran: 15 };
      };
    }
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
      };
    }

    // ── 3. Permissions API ──────────────────────────────────────────────
    if (navigator.permissions) {
      const origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (params) => {
        if (params.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return origQuery(params);
      };
    }

    // ── 4. Plugins & MimeTypes (real Chrome always has these) ───────────
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
        ];
        arr.item = (i) => arr[i];
        arr.namedItem = (n) => arr.find(p => p.name === n);
        arr.refresh = () => {};
        return arr;
      },
    });

    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => {
        const arr = [
          { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        ];
        arr.item = (i) => arr[i];
        arr.namedItem = (t) => arr.find(m => m.type === t);
        arr.refresh = () => {};
        return arr;
      },
    });

    // ── 5. Languages ────────────────────────────────────────────────────
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

    // ── 6. Hardware fingerprint (realistic values) ──────────────────────
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    if (!navigator.connection) {
      Object.defineProperty(navigator, 'connection', {
        get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false }),
      });
    }

    // ── 7. WebGL vendor/renderer spoofing ───────────────────────────────
    const patchWebGL = (proto) => {
      const orig = proto.getParameter;
      proto.getParameter = function(param) {
        if (param === 37445) return 'Intel Inc.';                          // UNMASKED_VENDOR
        if (param === 37446) return 'Intel(R) Iris(TM) Plus Graphics 640'; // UNMASKED_RENDERER
        return orig.apply(this, arguments);
      };
    };
    patchWebGL(WebGLRenderingContext.prototype);
    if (typeof WebGL2RenderingContext !== 'undefined') {
      patchWebGL(WebGL2RenderingContext.prototype);
    }

    // ── 8. Remove Playwright-specific globals ───────────────────────────
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__PW_inspect;

    // ── 9. Screen dimensions (ensure realistic even in headless) ────────
    if (screen.width === 0 || screen.height === 0) {
      Object.defineProperty(screen, 'width', { get: () => 1920 });
      Object.defineProperty(screen, 'height', { get: () => 1080 });
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    }

    // ── 10. Patch Function.prototype.toString for patched functions ─────
    // Some detectors call .toString() on native functions to verify they're real
    const nativeToString = Function.prototype.toString;
    const customToString = function() {
      if (this === navigator.permissions.query) return 'function query() { [native code] }';
      if (this === WebGLRenderingContext.prototype.getParameter) return 'function getParameter() { [native code] }';
      return nativeToString.call(this);
    };
    Function.prototype.toString = customToString;
  `;
}
