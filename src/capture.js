/* Dibino Lens – screenshots without the "debugger" permission.
 * Desktop: scroll the page and stitch chrome.tabs.captureVisibleTab frames.
 * Mobile / tablet: the same page is loaded in a sandboxed same-origin iframe of the wanted width
 * (real media queries + real JS), then captured the same way.
 */
(() => {
  const DL = (globalThis.DL = globalThis.DL || {});
  const C = (DL.capture = {});

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // never wait on rAF alone: it does not fire in background tabs
const raf2 = () => Promise.race([
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    new Promise((r) => setTimeout(r, 120))
  ]);
  const docHeightOf = (d) => Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0);
  C.sleep = sleep;

  /* ------------------------------------------------------------------ preparation */
  async function waitImages(doc, timeout) {
    const pending = Array.from(doc.images).filter((i) => !i.complete);
    if (!pending.length) return;
    await Promise.race([
      Promise.all(pending.map((i) => new Promise((r) => {
        i.addEventListener('load', r, { once: true });
        i.addEventListener('error', r, { once: true });
      }))),
      sleep(timeout)
    ]);
  }

  /* scroll through the page once so lazy images / scroll animations are triggered */
  C.prepareScroll = async function (win, onTick, isCancelled) {
    const doc = win.document, html = doc.documentElement;
    const prev = [html.style.getPropertyValue('scroll-behavior'), html.style.getPropertyPriority('scroll-behavior')];
    html.style.setProperty('scroll-behavior', 'auto', 'important');
    const x0 = win.scrollX, y0 = win.scrollY;
    const vh = win.innerHeight;
    let y = 0;
    for (let g = 0; g < 80; g++) {
      if (isCancelled && isCancelled()) break;
      const h = docHeightOf(doc);
      if (y >= h - 2) break;
      win.scrollTo(0, y);
      await sleep(150);
      if (onTick) onTick(Math.min(1, y / h));
      y += Math.round(vh * 0.85);
    }
    win.scrollTo(0, docHeightOf(doc));
    await sleep(250);
    await waitImages(doc, 3500);
    win.scrollTo(x0, y0);
    await sleep(120);
    if (prev[0]) html.style.setProperty('scroll-behavior', prev[0], prev[1]); else html.style.removeProperty('scroll-behavior');
  };

  /* ------------------------------------------------------------------ fixed / sticky handling */
  function collectFixed(doc, win) {
    const out = [];
    if (!doc.body) return out;
    let n = 0;
    for (const el of doc.body.querySelectorAll('*')) {
      if (++n > 9000) break;
      const cs = win.getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') {
        const r = el.getBoundingClientRect();
        if (cs.position === 'sticky' && r.height > 200) continue;
        // top-anchored bars (headers) may stay visible in the very first frame, everything else never
        el.__dlTop = r.top < win.innerHeight * 0.35 && r.bottom < win.innerHeight * 0.6;
        out.push(el);
      }
    }
    return out;
  }
  function setHidden(list, hidden, keepTop) {
    for (const el of list) {
      if (hidden && keepTop && el.__dlTop) continue;
      if (!el.__dlPrev) el.__dlPrev = [el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')];
      if (hidden) el.style.setProperty('visibility', 'hidden', 'important');
      else if (el.__dlPrev[0]) el.style.setProperty('visibility', el.__dlPrev[0], el.__dlPrev[1]);
      else el.style.removeProperty('visibility');
    }
  }

  /* ------------------------------------------------------------------ snapshot of the visible tab */
  async function snap() {
    const r = await chrome.runtime.sendMessage({ type: 'capture' });
    if (!r || !r.ok) throw new Error((r && r.error) || 'capture failed');
    const img = new Image();
    img.src = r.dataUrl;
    await img.decode();
    return img;
  }

  /* ------------------------------------------------------------------ targets */
  C.mainTarget = function (win) {
    const doc = win.document;
    return {
      win, doc,
      vh: () => win.innerHeight,
      scrollTo: (y) => win.scrollTo(win.scrollX, y),
      scrollY: () => win.scrollY,
      scrollX: () => win.scrollX,
      docHeight: () => docHeightOf(doc),
      crop: () => ({ x: 0, y: 0, w: win.innerWidth, h: win.innerHeight })
    };
  };

  C.frameTarget = function (iframe) {
    const w = iframe.contentWindow, d = iframe.contentDocument;
    return {
      win: w, doc: d,
      vh: () => w.innerHeight,
      scrollTo: (y) => w.scrollTo(w.scrollX, y),
      scrollY: () => w.scrollY,
      scrollX: () => w.scrollX,
      docHeight: () => docHeightOf(d),
      crop: () => { const r = iframe.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
    };
  };

  /* ------------------------------------------------------------------ region capture (scroll + stitch) */
  /* region = { x, y, w, h } in the target document's page coordinates */
  C.region = async function (target, region, opt) {
    const o = Object.assign({ scaleMax: 1, maxCssH: 16000, maxOutPx: 30000, settle: 380 }, opt || {});
    const fixed = collectFixed(target.doc, target.win);
    const html = target.doc.documentElement;
    const prev = [html.style.getPropertyValue('scroll-behavior'), html.style.getPropertyPriority('scroll-behavior')];
    html.style.setProperty('scroll-behavior', 'auto', 'important');
    const x0 = target.scrollX(), y0 = target.scrollY();

    const regionH = Math.min(region.h, o.maxCssH);
    const truncated = region.h > o.maxCssH;
    const vh = target.vh();
    const ys = [];
    for (let y = region.y; y < region.y + regionH; y += vh) ys.push(y);

    let canvas = null, ctx = null, s = 1, outScale = 1;
    try {
      for (let i = 0; i < ys.length; i++) {
        if (o.isCancelled && o.isCancelled()) throw new Error('__cancelled__');
        target.scrollTo(ys[i]);
        await sleep(o.settle);
        await raf2();
        const sy = target.scrollY(), sx = target.scrollX();
        const first = region.y <= 4 && sy <= 4;
        setHidden(fixed, false);
        setHidden(fixed, true, first);

        if (o.beforeSnap) await o.beforeSnap();
        let img;
        try { img = await snap(); } finally { if (o.afterSnap) o.afterSnap(); }

        if (!canvas) {
          s = img.naturalWidth / window.innerWidth;
          outScale = Math.min(s, o.scaleMax);
          const cw = Math.max(1, Math.round(region.w * outScale));
          const ch = Math.max(1, Math.min(Math.round(regionH * outScale), o.maxOutPx));
          canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cw, ch);
          ctx.imageSmoothingQuality = 'high';
        }
        const crop = target.crop();
        const visTop = Math.max(region.y, sy);
        const visBot = Math.min(region.y + regionH, sy + vh);
        if (visBot > visTop) {
          ctx.drawImage(
            img,
            (crop.x + (region.x - sx)) * s, (crop.y + (visTop - sy)) * s,
            region.w * s, (visBot - visTop) * s,
            0, (visTop - region.y) * outScale,
            region.w * outScale, (visBot - visTop) * outScale
          );
        }
        if (o.onFrame) o.onFrame(i + 1, ys.length);
      }
    } finally {
      setHidden(fixed, false);
      target.scrollTo(y0);
      if (prev[0]) html.style.setProperty('scroll-behavior', prev[0], prev[1]); else html.style.removeProperty('scroll-behavior');
    }
    return { canvas, outScale, region: { x: region.x, y: region.y, w: region.w, h: regionH }, truncated };
  };

  /* ------------------------------------------------------------------ canvas helpers */
  C.toJpeg = (canvas, quality = 0.82, maxW = 0) => new Promise((resolve) => {
    let c = canvas;
    if (maxW && canvas.width > maxW) {
      const k = maxW / canvas.width;
      c = document.createElement('canvas');
      c.width = maxW; c.height = Math.max(1, Math.round(canvas.height * k));
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(canvas, 0, 0, c.width, c.height);
    }
    c.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });

  C.crop = function (cap, rect) {
    const k = cap.outScale;
    const x = Math.max(0, Math.round((rect.x - cap.region.x) * k));
    const y = Math.max(0, Math.round((rect.y - cap.region.y) * k));
    const w = Math.min(cap.canvas.width - x, Math.round(rect.w * k));
    const h = Math.min(cap.canvas.height - y, Math.round(rect.h * k));
    if (w < 8 || h < 8) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(cap.canvas, x, y, w, h, 0, 0, w, h);
    return c;
  };

  /* ------------------------------------------------------------------ responsive view in an iframe */
  C.openFrame = async function (win, width) {
    const doc = win.document;
    const vw = win.innerWidth, vh = win.innerHeight;
    if (width > vw - 16) return { ok: false, reason: 'narrow' };

    // Ask the server first (same-origin, no extra permission): if the page forbids framing, do not even try –
    // it avoids "Refused to frame…" errors in the extension's error list.
    try {
      const res = await fetch(win.location.href, { credentials: 'same-origin', cache: 'force-cache' });
      const xfo = (res.headers.get('x-frame-options') || '').toLowerCase();
      const csp = res.headers.get('content-security-policy') || '';
      const fa = /(?:^|;)\s*frame-ancestors\s+([^;]*)/i.exec(csp);
      const list = fa ? fa[1].toLowerCase() : '';
      if (/\bdeny\b/.test(xfo) || (fa && (/'none'/.test(list) || !/('self'|\*)/.test(list)))) return { ok: false, reason: 'blocked' };
    } catch (e) { /* offline or blocked: just try */ }

    const mountPoint = doc.body || doc.documentElement;
    if (!mountPoint || typeof mountPoint.appendChild !== 'function' || !/html/i.test(String(doc.documentElement && doc.documentElement.namespaceURI || 'html'))) {
      return { ok: false, reason: 'unsupported' };
    }
    // The frame is created from the page's own context (background → MAIN world) so Chrome's generic
    // "allow-scripts + allow-same-origin" console notice is not filed under the extension's error list.
    // Both flags are needed here: the page must run its own JS at the narrow width and we must read it.
    let made = null;
    try {
      made = await chrome.runtime.sendMessage({
        type: 'make-frame', width, left: Math.round((vw - width) / 2), height: vh, src: win.location.href
      });
    } catch (e) { made = null; }
    if (!made || !made.ok) return { ok: false, reason: 'unsupported' };
    const overlay = doc.querySelector('[data-dibino-lens-overlay]');
    const iframe = overlay && overlay.querySelector('iframe');
    if (!iframe) return { ok: false, reason: 'unsupported' };

    const t0 = Date.now();
    for (;;) {
      let cd = null;
      try { cd = iframe.contentDocument; } catch (e) { cd = null; }
      if (cd && cd.readyState === 'complete' && cd.URL !== 'about:blank') break;
      if (Date.now() - t0 > 25000) break;
      await sleep(120);
    }

    let d = null;
    try { d = iframe.contentDocument; } catch (e) { d = null; }
    const bad = !d || !d.documentElement || !d.body || String(d.URL).startsWith('chrome-error') || d.URL === 'about:blank';
    if (bad) { overlay.remove(); return { ok: false, reason: 'blocked' }; }

    const st = d.createElement('style');
    st.textContent = 'html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}';
    d.documentElement.appendChild(st);
    await sleep(1500); // let the page's own JS settle at this width
    return { ok: true, iframe, overlay, win: iframe.contentWindow, doc: d, close: () => overlay.remove() };
  };
})();
