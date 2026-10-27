/* Dibino Lens – service worker
 * Responsibilities: inject the panel on click, take tab screenshots (rate limited),
 * fetch cross-origin files when the user granted access, and detect page libraries.
 */
const SRC = [
  'src/i18n.js', 'src/zip.js', 'src/privacy.js', 'src/extract.js',
  'src/assets.js', 'src/capture.js', 'src/report.js', 'src/ui.js', 'src/main.js'
];

async function openOnTab(tab) {
  if (!tab || !tab.id) return;
  const tabId = tab.id;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!globalThis.__dibinoLens
    });
    if (res && res.result) {
      await chrome.tabs.sendMessage(tabId, { type: 'toggle' });
      return;
    }
    await chrome.scripting.executeScript({ target: { tabId }, files: SRC });
  } catch (e) {
    // chrome://, Web Store, PDF viewer, etc.
    try {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#0A0A0A' });
      await chrome.action.setBadgeText({ tabId, text: '!' });
      await chrome.action.setTitle({ tabId, title: chrome.i18n.getMessage('restricted') });
      setTimeout(() => {
        chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
        chrome.action.setTitle({ tabId, title: chrome.i18n.getMessage('actionTitle') }).catch(() => {});
      }, 4000);
    } catch (_) { /* tab closed */ }
  }
}
chrome.action.onClicked.addListener(openOnTab);

/* ---------- messages from the content script ---------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (e) =>
    sendResponse({ ok: false, error: String((e && e.message) || e) })
  );
  return true;
});

async function handle(msg, sender) {
  const tab = sender.tab;
  switch (msg && msg.type) {
    case 'capture':     return capture(tab);
    case 'main-detect': return mainDetect(tab.id);
    case 'fetch':       return fetchAsset(msg.url, msg.maxBytes || 8e6, !!msg.asText);
    case 'make-frame':  return makeFrame(tab.id, msg);
    case 'perm-check':  return { ok: true, granted: await chrome.permissions.contains({ origins: msg.origins }) };
    case 'perm-open':   return openGrant(tab.id, msg.origins);
    default:            return { ok: false, error: 'unknown message' };
  }
}

/* chrome.tabs.captureVisibleTab is limited to ~2 calls per second */
let lastCapture = 0;
async function capture(tab) {
  const wait = 620 - (Date.now() - lastCapture);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCapture = Date.now();
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 92 });
  return { ok: true, dataUrl };
}

/* libraries are only visible from the page's own JS world */
async function mainDetect(tabId) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: detectLibsMain });
  return { ok: true, libs: (r && r.result) || [] };
}
function detectLibsMain() {
  const w = window, libs = [];
  const add = (name, cond) => { try { if (cond) libs.push(name); } catch (e) { /* ignore */ } };
  add('jQuery ' + (w.jQuery && w.jQuery.fn && w.jQuery.fn.jquery), w.jQuery);
  add('Elementor', w.elementorFrontend || document.querySelector('[data-elementor-type]'));
  add('Woodmart theme', (document.body.className || '').includes('woodmart') || w.woodmart_settings);
  add('Flatsome theme', (document.body.className || '').includes('flatsome') || w.flatsomeVars);
  add('WooCommerce', (document.body.className || '').includes('woocommerce'));
  add('WordPress', document.querySelector('link[href*="wp-content"], script[src*="wp-content"]'));
  add('Swiper', w.Swiper || document.querySelector('.swiper'));
  add('Slick', w.jQuery && w.jQuery.fn && w.jQuery.fn.slick);
  add('Owl Carousel', w.jQuery && w.jQuery.fn && w.jQuery.fn.owlCarousel);
  add('AOS', w.AOS);
  add('GSAP', w.gsap);
  add('Lenis / smooth scroll', w.Lenis || document.documentElement.classList.contains('lenis'));
  add('React', document.querySelector('[data-reactroot], #__next, #root'));
  add('Next.js', w.__NEXT_DATA__ || document.getElementById('__next'));
  add('Vue', w.__VUE__ || document.querySelector('[data-v-app]'));
  add('Alpine.js', w.Alpine);
  add('Bootstrap', document.querySelector('.container .row, .btn-primary, [data-bs-toggle]'));
  add('Tailwind (guess)', /\b(flex|grid|px-\d|py-\d|text-(?:\w+-)?\d00)\b/.test(document.body.innerHTML.slice(0, 20000)));
  return libs;
}

/* ---------- cross-origin fetch (only for origins the user allowed) ---------- */
async function fetchAsset(url, maxBytes, asText) {
  let u;
  try { u = new URL(url); } catch (e) { return { ok: false, reason: 'bad-url' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, reason: 'bad-url' };
  const origin = u.origin + '/*';
  if (!(await chrome.permissions.contains({ origins: [origin] }))) {
    return { ok: false, reason: 'permission', origin };
  }
  const res = await fetch(url, { credentials: 'omit', redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: 'http', status: res.status };
  const len = Number(res.headers.get('content-length') || 0);
  if (len > maxBytes) return { ok: false, reason: 'too-large' };
  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes) return { ok: false, reason: 'too-large' };
  const type = res.headers.get('content-type') || '';
  if (asText) return { ok: true, type, text: new TextDecoder().decode(buf) };
  return { ok: true, type, b64: toB64(buf) };
}
function toB64(buf) {
  const u8 = new Uint8Array(buf);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

/* permission requests need a user gesture inside an extension page */
async function openGrant(tabId, origins) {
  const url = chrome.runtime.getURL('grant.html') + '?tab=' + tabId + '&o=' + encodeURIComponent(JSON.stringify(origins || []));
  await chrome.windows.create({ url, type: 'popup', width: 460, height: 460 });
  return { ok: true };
}


/* builds the responsive-view overlay + iframe inside the page itself (see capture.js) */
function mkFrameMain(width, left, height, src) {
  const doc = document;
  const overlay = doc.createElement('div');
  overlay.setAttribute('data-dibino-lens-overlay', '');
  overlay.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;background:#262626;display:block;';
  const iframe = doc.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts'); // no top navigation, no popups
  iframe.style.cssText = 'all:initial;position:absolute;top:0;left:' + left + 'px;width:' + width + 'px;height:' + height + 'px;border:0;background:#fff;display:block;';
  overlay.appendChild(iframe);
  (doc.body || doc.documentElement).appendChild(overlay);
  iframe.src = src;
  return true;
}
async function makeFrame(tabId, m) {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: mkFrameMain, args: [m.width, m.left, m.height, m.src]
  });
  return { ok: !!(r && r.result) };
}
