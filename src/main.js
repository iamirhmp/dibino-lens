/* Dibino Lens – orchestrator: runs the steps in order and builds the download */
(() => {
  const DL = globalThis.DL;
  if (globalThis.__dibinoLens) return;
  globalThis.__dibinoLens = true;

  const UI = DL.ui, C = DL.capture, E = DL.extract, R = DL.report;
  const t = (k, v) => DL.t(k, v);
  const state = { cancelled: false, running: false, needPerm: new Set() };

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'toggle') UI.toggle();
    if (msg.type === 'perm-granted') UI.permGranted();
  });

  /* ------------------------------------------------------------------ fetching */
  const b64ToU8 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  /* page-context fetch first (same-origin / CORS-enabled), then the service worker if the user allowed that domain */
  async function fetchResource(url, o) {
    o = o || {};
    const maxBytes = o.maxBytes || 8e6;
    let sameOrigin = false;
    try { sameOrigin = new URL(url, location.href).origin === location.origin; } catch (e) { /* ignore */ }
    try {
      const res = await fetch(url, { credentials: sameOrigin ? 'same-origin' : 'omit' });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > maxBytes) return { ok: false, reason: 'too-large' };
        const type = res.headers.get('content-type') || '';
        return o.asText ? { ok: true, type, text: new TextDecoder().decode(buf) } : { ok: true, type, data: new Uint8Array(buf) };
      }
      if (sameOrigin) return { ok: false, reason: 'http ' + res.status };
    } catch (e) { /* CORS or network – try the service worker */ }
    let r;
    try { r = await chrome.runtime.sendMessage({ type: 'fetch', url, asText: !!o.asText, maxBytes }); } catch (e) { r = null; }
    if (r && r.ok) return o.asText ? r : { ok: true, type: r.type, data: b64ToU8(r.b64) };
    if (r && r.reason === 'permission' && r.origin) state.needPerm.add(r.origin);
    return r || { ok: false, reason: 'error' };
  }

  /* ------------------------------------------------------------------ helpers */
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.style.display = 'none';
    document.documentElement.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 4000);
  }

  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

  function elementRegion(el, win) {
    const r = el.getBoundingClientRect();
    return { x: r.left + win.scrollX, y: r.top + win.scrollY, w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  /* ------------------------------------------------------------------ main run */
  async function run() {
    if (state.running) return;
    const opts = Object.assign({}, UI.opts);
    const warnings = [];
    state.cancelled = false; state.running = true; state.needPerm = new Set();
    const isCancelled = () => state.cancelled;
    const check = () => { if (state.cancelled) throw new Error('__cancelled__'); };

    let rootEl = null;
    if (opts.scope === 'pick') {
      rootEl = UI.state.picked;
      if (!rootEl || !rootEl.isConnected) { state.running = false; UI.setStatus('<div class="box">' + t('errPick') + '</div>'); return; }
    }

    const needFull = opts.shotDesktop || opts.shotSections;
    const W = {
      privacy: opts.privacy ? 2 : 0, scroll: 8, extract: 20,
      desktop: needFull ? 26 : 0, mobile: opts.shotMobile ? 15 : 0, tablet: opts.shotTablet ? 12 : 0,
      assets: opts.assetsImg || opts.assetsFonts ? 10 : 0, zip: 7
    };
    const totalW = Object.values(W).reduce((a, b) => a + b, 0);
    const offs = {}; let acc = 0;
    for (const k of Object.keys(W)) { offs[k] = acc / totalW; acc += W[k]; }
    const P = (name) => (frac, text) => UI.progress(text, offs[name] + Math.min(1, frac) * (W[name] / totalW));

    UI.setRunning(true);
    let restorePrivacy = null;
    const files = [];
    const topShots = [];   // [{ name, blob }]
    const frames = [];

    try {
      if (opts.privacy) { P('privacy')(0, t('st_privacy')); restorePrivacy = DL.anonymize(document); P('privacy')(1); }
      check();

      /* 1 ── scroll so lazy content loads */
      P('scroll')(0, t('st_scroll'));
      await C.prepareScroll(window, (f) => P('scroll')(f, t('st_scroll')), isCancelled);
      check();

      /* 2 ── libraries + analysis */
      P('extract')(0.02, t('st_libs'));
      let libs = [];
      try { const r = await chrome.runtime.sendMessage({ type: 'main-detect' }); if (r && r.ok) libs = r.libs; } catch (e) { /* ignore */ }
      P('extract')(0.1, t('st_extract'));
      const data = await E.run({
        doc: document, win: window, root: rootEl, usedOnly: opts.cssUsed, privacy: opts.privacy, libs,
        fetchResource,
        onStatus: (k) => P('extract')(k === 'css' ? 0.2 : 0.4, k === 'css' ? t('st_css') : t('st_extract'))
      });
      check();
      if (data.css.unreadable.length) warnings.push('CSS files that could not be read (' + data.css.unreadable.length + '): ' + data.css.unreadable.slice(0, 5).join(', '));
      if (data.html.length > 1.5e6) warnings.push(t('bigHtml', { size: R.kb(data.html.length) }));
      P('extract')(1);

      /* 3 ── desktop screenshot + sections */
      const sectionShots = new Map();
      if (needFull) {
        const target = C.mainTarget(window);
        const region = rootEl ? elementRegion(rootEl, window)
          : { x: 0, y: 0, w: document.documentElement.clientWidth, h: target.docHeight() };
        const p = P('desktop');
        p(0, t('st_shot', { name: t('nameDesktop'), i: 1, n: '…' }));
        const cap = await C.region(target, region, {
          scaleMax: 1, maxCssH: 16000, isCancelled,
          beforeSnap: UI.hideForSnap, afterSnap: UI.showAfterSnap,
          onFrame: (i, n) => p(i / n * 0.9, t('st_shot', { name: t('nameDesktop'), i, n }))
        });
        if (cap.truncated) warnings.push(t('truncated', { h: 16000 }));
        if (opts.shotDesktop) topShots.push({ name: 'desktop-full', blob: await C.toJpeg(cap.canvas, 0.82, 1600) });
        if (opts.shotSections) {
          p(0.92, t('st_sections'));
          for (const s of data.sections) {
            const c = C.crop(cap, s.rect);
            if (c) sectionShots.set(s.slug, await C.toJpeg(c, 0.84, 1400));
          }
        }
        p(1);
      }
      check();

      /* 4 ── mobile / tablet through a real-width frame */
      async function frameShot(width, label, key) {
        const p = P(key);
        p(0, t('st_frame', { w: width }));
        let f;
        try { f = await C.openFrame(window, width); } catch (e) { f = { ok: false, reason: 'blocked' }; }
        if (!f.ok) { warnings.push(f.reason === 'narrow' ? t('narrow', { w: width }) : t('mobileFail', { w: width })); p(1); return; }
        try {
          if (opts.privacy) DL.anonymize(f.doc);
          await C.prepareScroll(f.win, null, isCancelled);
          const target = C.frameTarget(f.iframe);
          let region = { x: 0, y: 0, w: f.doc.documentElement.clientWidth, h: target.docHeight() };
          let scope = f.doc.body;
          if (rootEl) {
            let el = null;
            try { el = f.doc.querySelector(E.pathSelector(rootEl)); } catch (e) { el = null; }
            if (el) { region = elementRegion(el, f.win); scope = el; }
          }
          const outline = E.outline(f.doc, f.win, scope);
          const cap = await C.region(target, region, {
            scaleMax: 2, maxCssH: 9000, isCancelled,
            beforeSnap: UI.hideForSnap, afterSnap: UI.showAfterSnap,
            onFrame: (i, n) => p(0.2 + i / n * 0.75, t('st_shot', { name: label, i, n }))
          });
          if (cap.truncated) warnings.push(t('truncated', { h: 9000 }));
          topShots.push({ name: key === 'mobile' ? 'mobile-' + width : 'tablet-' + width, blob: await C.toJpeg(cap.canvas, 0.84) });
          frames.push({ width, name: key, outline });
        } finally { f.close(); }
        p(1);
      }
      if (opts.shotMobile) { await frameShot(390, t('nameMobile'), 'mobile'); check(); }
      if (opts.shotTablet) { await frameShot(768, t('nameTablet'), 'tablet'); check(); }

      /* 5 ── optional assets */
      let assetManifest = [];
      const assetFiles = [];
      if (opts.assetsImg || opts.assetsFonts) {
        const p = P('assets');
        p(0, t('st_assets', { i: 0, n: '…' }));
        const list = E.collectAssets(document, rootEl || document.body, data.stats.bgImages, data.css.fontFaces, { images: opts.assetsImg, fonts: opts.assetsFonts });
        const res = await DL.assets.download(list, {
          fetchResource, isCancelled,
          onProgress: (i, n) => p(i / Math.max(1, n), t('st_assets', { i, n }))
        });
        assetFiles.push(...res.files);
        assetManifest = res.manifest.filter(Boolean);
        const failed = assetManifest.filter((a) => a.status !== 'ok').length;
        if (failed) warnings.push(failed + ' of ' + assetManifest.length + ' asset files could not be downloaded (see assets/_manifest.json).');
        p(1);
      }
      check();

      /* 6 ── build the package */
      P('zip')(0.05, t('st_zip'));
      const meta = data.meta;
      files.push({ name: 'report.md', data: R.buildReport(data, { opts, frames, warnings, assetManifest }) });
      files.push({ name: 'page.html', data: '<!-- Dibino Lens · ' + meta.url + ' · ' + meta.capturedAt + ' -->\n' + (rootEl ? '' : '<!DOCTYPE html>\n') + data.html });
      files.push({ name: 'styles.css', data: '/* Dibino Lens · ' + meta.url + ' · ' + (opts.cssUsed ? 'rules matching the scope' : 'all rules') + ' */\n' + data.css.css });
      files.push({ name: 'tokens.json', data: JSON.stringify(R.buildTokens(data), null, 2) });
      files.push({ name: 'tailwind-theme.css', data: R.buildTailwindV4(data) });
      files.push({ name: 'tailwind.config.snippet.js', data: R.buildTailwindV3(data) });
      for (const s of topShots) files.push({ name: 'screenshots/' + s.name + '.jpg', data: s.blob, store: true });
      if (opts.shotSections) {
        for (const s of data.sections) {
          files.push({ name: 'sections/' + s.slug + '.html', data: '<!-- ' + s.label + ' | ' + s.selector + ' -->\n' + s.html });
          const b = sectionShots.get(s.slug);
          if (b) files.push({ name: 'sections/' + s.slug + '.jpg', data: b, store: true });
        }
      }
      data.svgSink.forEach((svg, i) => files.push({ name: 'assets/svg/inline-' + String(i + 1).padStart(3, '0') + '.svg', data: svg }));
      assetFiles.forEach((f) => files.push(f));
      if (assetManifest.length) files.push({ name: 'assets/_manifest.json', data: JSON.stringify(assetManifest, null, 2) });

      const startMd = R.buildStart(data, files, opts);
      const base = 'dibino-lens_' + (slug(location.hostname.replace(/^www\./, '')) || 'page') + (rootEl ? '_' + (slug(E.labelOf(rootEl)) || 'element') : '') + '_' + stamp();
      let summary;

      if (opts.format === 'md') {
        P('zip')(0.6, t('st_save'));
        const md = R.buildSingleMarkdown(data, startMd, files.find((f) => f.name === 'report.md').data);
        download(new Blob([md], { type: 'text/markdown' }), base + '.md');
        for (const s of topShots) { await C.sleep(250); download(s.blob, base + '_' + s.name + '.jpg'); }
        summary = { n: 1 + topShots.length, bytes: md.length + topShots.reduce((a, s) => a + s.blob.size, 0) };
      } else {
        files.unshift({ name: '00-START-HERE.md', data: startMd });
        const blob = await DL.zip(files, (f) => P('zip')(0.1 + f * 0.8, t('st_zip')));
        P('zip')(0.95, t('st_save'));
        download(blob, base + '.zip');
        summary = { n: files.length, bytes: blob.size };
      }
      P('zip')(1);

      /* 7 ── result */
      let html = '<p class="ptext">' + t('doneSub') + '<br>' + t('doneFiles', { n: summary.n, size: R.kb(summary.bytes) }) + '</p>';
      if (warnings.length) html += '<div class="box"><b>' + t('warnTitle') + '</b><ul>' + warnings.map((w) => '<li>' + UI.esc(w) + '</li>').join('') + '</ul></div>';
      if (state.needPerm.size) {
        html += '<div class="box">' + t('permNeed', { n: state.needPerm.size }) +
          '<ul style="direction:ltr;text-align:left">' + [...state.needPerm].map((o) => '<li>' + UI.esc(o.replace('/*', '')) + '</li>').join('') + '</ul>' +
          '<div class="row" style="margin-top:8px"><button class="sm" data-act="perm">' + t('permBtn') + '</button></div></div>';
      }
      UI.finish(html, 'ok');
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (msg === '__cancelled__') UI.finish('', 'cancel');
      else UI.finish('<p class="ptext">' + UI.esc(msg) + '</p>', 'error');
    } finally {
      state.running = false;
      try { if (restorePrivacy) restorePrivacy(); } catch (e) { /* ignore */ }
      document.querySelectorAll('[data-dibino-lens-overlay]').forEach((n) => n.remove());
      UI.showAfterSnap();
    }
  }

  UI.bind({
    run,
    cancel: () => { state.cancelled = true; UI.progress(t('cancelling')); },
    perm: () => { try { chrome.runtime.sendMessage({ type: 'perm-open', origins: [...state.needPerm] }); } catch (e) { /* ignore */ } }
  });

  DL.run = run;
  UI.mount().then(() => UI.show());
})();
