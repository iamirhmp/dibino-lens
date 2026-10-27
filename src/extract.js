/* Dibino Lens – page analysis (runs in the content-script world, all work stays on the device) */
(() => {
  const DL = (globalThis.DL = globalThis.DL || {});
  const E = (DL.extract = {});

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'META', 'TEMPLATE', 'HEAD', 'TITLE', 'BASE']);
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const RAW_TEXT = new Set(['pre', 'textarea', 'code']);

  /* ------------------------------------------------------------------ helpers */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const toAbs = (u, base) => { try { return new URL(u, base).href; } catch (e) { return u; } };

  function absCssUrls(css, base) {
    return css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']*))\s*\)/g, (m, a, b, c) => {
      const v = String(a != null ? a : b != null ? b : c != null ? c : '').trim();
      if (!v || v.startsWith('data:') || v.startsWith('#') || /^https?:/i.test(v)) return m;
      return 'url("' + toAbs(v, base) + '")';
    });
  }
  E.absCssUrls = absCssUrls;

  function colorHex(c) {
    if (!c || c === 'transparent') return null;
    const m = c.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return /^(color\(|oklch|oklab|lab|lch|hsl|hwb)/.test(c) ? c : null;
    const tok = m[1].split(/[\s,\/]+/).filter(Boolean);
    const rgb = tok.slice(0, 3).map(parseFloat);
    if (rgb.length < 3 || rgb.some(isNaN)) return null;
    let a = 1;
    if (tok[3] != null) a = tok[3].endsWith('%') ? parseFloat(tok[3]) / 100 : parseFloat(tok[3]);
    if (a === 0) return null;
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + h(rgb[0]) + h(rgb[1]) + h(rgb[2]) + (a < 1 ? h(a * 255) : '');
  }
  E.colorHex = colorHex;

  function hsl(hex) {
    if (!/^#[0-9a-f]{6}/i.test(hex)) return null;
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { s, l };
  }

  const inc = (map, k, by = 1) => { if (k != null && k !== '') map[k] = (map[k] || 0) + by; };
  const top = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);

  function splitSel(s) {
    const out = []; let d = 0, cur = '', q = '';
    for (const ch of s) {
      if (q) { cur += ch; if (ch === q) q = ''; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === '(' || ch === '[') d++;
      else if (ch === ')' || ch === ']') d--;
      if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  const labelOf = (el) => {
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    return el.localName + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '');
  };
  E.labelOf = labelOf;

  /* a selector that finds the same element again (also inside another document) */
  E.pathSelector = function (el) {
    const doc = el.ownerDocument;
    if (el === doc.documentElement) return 'html';
    if (el === doc.body) return 'body';
    const parts = [];
    let cur = el;
    while (cur && cur !== doc.body && cur !== doc.documentElement) {
      if (cur.id && doc.querySelectorAll('#' + CSS.escape(cur.id)).length === 1) { parts.unshift('#' + CSS.escape(cur.id)); return parts.join(' > '); }
      let i = 1, sib = cur;
      while ((sib = sib.previousElementSibling)) if (sib.localName === cur.localName) i++;
      parts.unshift(cur.localName + ':nth-of-type(' + i + ')');
      cur = cur.parentElement;
    }
    parts.unshift('body');
    return parts.join(' > ');
  };

  /* ------------------------------------------------------------------ CSS */
  function makeUsedChecker(doc, root, deadlineAt) {
    const cache = new Map();
    const strip = (s) => s
      .replace(/::?(?:before|after|first-line|first-letter|selection|placeholder|backdrop|marker|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+|-ms-[\w-]+)(?:\([^)]*\))?/g, '')
      .replace(/:(?:hover|focus|focus-within|focus-visible|active|visited|link|any-link|target|checked|indeterminate|fullscreen|open|playing|paused)\b/g, '');
    const full = root === doc.documentElement;
    return function used(sel) {
      if (cache.has(sel)) return cache.get(sel);
      if (performance.now() > deadlineAt) return true;
      let s = strip(sel).trim();
      if (!s) s = '*';
      if (/[>+~]$/.test(s)) s += '*';
      if (/^[>+~]/.test(s)) s = '*' + s;
      let ok = true;
      try {
        if (full) ok = !!doc.querySelector(s);
        else {
          ok = false;
          for (const el of doc.querySelectorAll(s)) {
            if (root.contains(el) || el.contains(root)) { ok = true; break; }
          }
        }
      } catch (e) { ok = true; }
      cache.set(sel, ok);
      return ok;
    };
  }

  E.collectCss = async function (ctx) {
    const { doc, win, root, usedOnly, fetchResource, onStatus } = ctx;
    const t0 = performance.now();
    const used = makeUsedChecker(doc, root, t0 + 15000);
    const sheets = [];
    const blocked = [];
    const failed = [];

    const addSheet = (sh, label, base) => {
      try {
        if (sh.disabled) return;
        const media = sh.media && sh.media.mediaText;
        if (media && /^print$/i.test(media.trim())) return;
        sheets.push({ label, base, rules: Array.from(sh.cssRules) });
      } catch (e) { if (sh.href) blocked.push(sh.href); }
    };
    for (const sh of Array.from(doc.styleSheets)) addSheet(sh, sh.href || 'inline <style>', sh.href || doc.baseURI);
    try { (doc.adoptedStyleSheets || []).forEach((sh, i) => addSheet(sh, 'adoptedStyleSheet #' + (i + 1), doc.baseURI)); } catch (e) { /* cross-realm */ }

    // cross-origin sheets that the page itself may not read: fetch them as text
    for (const href of [...new Set(blocked)]) {
      if (onStatus) onStatus('css', href);
      const r = await fetchResource(href, { asText: true, maxBytes: 4e6 });
      if (r && r.ok) {
        try {
          const s = new win.CSSStyleSheet();
          s.replaceSync(r.text);
          sheets.push({ label: href + ' (downloaded)', base: href, rules: Array.from(s.cssRules) });
        } catch (e) { failed.push(href); }
      } else failed.push(href);
    }

    const fontFaces = [];
    const faceSeen = new Set();
    const keyframes = {};
    const vars = {};
    const bodyOrRoot = (sel) => {
      try { return doc.documentElement.matches(sel) || (doc.body && doc.body.matches(sel)); } catch (e) { return false; }
    };
    let counter = 0;

    async function proc(rules, base, inCond) {
      const out = [];
      for (const r of rules) {
        if (++counter % 250 === 0) await tick();
        try {
          if (r.type === 3) { // @import
            if (r.styleSheet) {
              try { out.push(...(await proc(Array.from(r.styleSheet.cssRules), r.styleSheet.href || base, inCond))); }
              catch (e) { if (r.href) failed.push(toAbs(r.href, base)); }
            }
            continue;
          }
          if (r.type === 5) { // @font-face
            const txt = absCssUrls(r.cssText, base);
            if (!faceSeen.has(txt)) {
              faceSeen.add(txt);
              const src = r.style.getPropertyValue('src') || '';
              const urls = [];
              src.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']*))\s*\)/g, (m, a, b, c) => { urls.push(toAbs(String(a || b || c || ''), base)); return m; });
              fontFaces.push({
                family: (r.style.getPropertyValue('font-family') || '').replace(/["']/g, '').trim(),
                weight: r.style.getPropertyValue('font-weight') || '400',
                style: r.style.getPropertyValue('font-style') || 'normal',
                urls, css: txt
              });
            }
            continue;
          }
          if (r.type === 7) { keyframes[r.name] = absCssUrls(r.cssText, base); continue; } // @keyframes
          if (r.type === 1) { // style rule
            const sel = r.selectorText;
            if (!inCond && r.cssText.includes('--') && bodyOrRoot(sel)) {
              for (let i = 0; i < r.style.length; i++) {
                const n = r.style[i];
                if (n.startsWith('--')) vars[n] = r.style.getPropertyValue(n).trim();
              }
            }
            if (!usedOnly || splitSel(sel).some(used)) out.push(absCssUrls(r.cssText, base));
            continue;
          }
          if (r.cssRules) { // @media / @supports / @layer / @container …
            const isCond = /^@(media|supports|container)/i.test(r.cssText);
            const inner = await proc(Array.from(r.cssRules), base, inCond || isCond);
            if (inner.length) out.push(r.cssText.slice(0, r.cssText.indexOf('{')).trim() + ' {\n' + inner.join('\n') + '\n}');
            continue;
          }
          out.push(absCssUrls(r.cssText, base));
        } catch (e) { /* unreadable rule */ }
      }
      return out;
    }

    let css = '';
    for (const sh of sheets) {
      const part = await proc(sh.rules, sh.base, false);
      if (part.length) css += '/* ===== ' + sh.label + ' ===== */\n' + part.join('\n') + '\n\n';
    }
    const usedKf = Object.entries(keyframes).filter(([n]) => css.includes(n)).map((e) => e[1]);
    css = '/* ===== @font-face ===== */\n' + fontFaces.map((f) => f.css).join('\n') + '\n\n' + css +
      (usedKf.length ? '/* ===== @keyframes ===== */\n' + usedKf.join('\n') + '\n' : '');

    const mediaRaw = (css.match(/@media[^{]+/g) || []).map((s) => s.trim());
    const breakpoints = [...new Set(mediaRaw)].slice(0, 40);
    const widths = {};
    for (const m of mediaRaw) {
      m.replace(/\(\s*(min|max)-width\s*:\s*([\d.]+)(px|em|rem)\s*\)/g, (x, kind, v, unit) => {
        const px = Math.round(parseFloat(v) * (unit === 'px' ? 1 : 16));
        inc(widths, kind + ':' + px);
        return x;
      });
    }

    // resolved values of the CSS variables (what the browser really uses)
    const resolved = {};
    try {
      const cs = win.getComputedStyle(doc.body || doc.documentElement);
      for (const n of Object.keys(vars).slice(0, 300)) resolved[n] = cs.getPropertyValue(n).trim() || vars[n];
    } catch (e) { /* ignore */ }

    return { css, vars, resolved, fontFaces, breakpoints, widthStats: widths, unreadable: [...new Set(failed)], ms: Math.round(performance.now() - t0) };
  };

  /* ------------------------------------------------------------------ clean HTML */
  E.cleanHtml = function (srcEl, opt) {
    const { doc, privacy, svgSink } = opt;
    const base = doc.baseURI;
    const clone = srcEl.cloneNode(true);

    // use what the browser actually loaded for <img> (handles lazy-load + srcset)
    const liveImgs = srcEl.querySelectorAll('img');
    const cloneImgs = clone.querySelectorAll('img');
    liveImgs.forEach((li, i) => {
      const ci = cloneImgs[i];
      if (!ci) return;
      const lazy = li.getAttribute('data-src') || li.getAttribute('data-lazy-src') || li.getAttribute('data-original');
      const cur = li.currentSrc || li.getAttribute('src') || '';
      const pick = cur && !cur.startsWith('data:') ? cur : (lazy || cur);
      if (pick) ci.setAttribute('src', pick);
      ci.removeAttribute('srcset'); ci.removeAttribute('sizes');
    });

    clone.querySelectorAll('script,noscript,style,link,template').forEach((n) => n.remove());
    clone.querySelectorAll('iframe').forEach((n) => {
      const p = doc.createElement('div');
      p.setAttribute('data-iframe-src', toAbs(n.getAttribute('src') || '', base));
      p.setAttribute('style', 'width:' + (n.getAttribute('width') || 'auto') + ';height:' + (n.getAttribute('height') || 'auto'));
      n.replaceWith(p);
    });

    clone.querySelectorAll('svg').forEach((s) => {
      const markup = s.outerHTML;
      if (markup.length > 1500 && svgSink) {
        svgSink.push(markup);
        while (s.firstChild) s.removeChild(s.firstChild);
        s.setAttribute('data-svg-asset', 'assets/svg/inline-' + String(svgSink.length).padStart(3, '0') + '.svg');
      }
    });

    const els = [clone, ...clone.querySelectorAll('*')];
    for (const el of els) {
      for (const a of Array.from(el.attributes)) {
        const n = a.name, v = a.value;
        if (/^on/i.test(n) || n === 'nonce') { el.removeAttribute(n); continue; }
        if (n === 'value' && el.tagName === 'INPUT' && /^(hidden|password)$/i.test(el.getAttribute('type') || '')) { el.setAttribute('value', ''); continue; }
        if (v.startsWith('data:')) { el.setAttribute(n, 'data:…trimmed'); continue; }
        if ((n === 'src' || n === 'href' || n === 'poster' || n === 'data-src' || n === 'data-bg' || n === 'data-background') &&
            v && !v.startsWith('#') && !/^(javascript|mailto|tel):/i.test(v)) {
          el.setAttribute(n, toAbs(v, base));
        }
        if (n === 'style') { if (!v.trim()) el.removeAttribute('style'); else el.setAttribute('style', absCssUrls(v, base)); }
        if (privacy && n === 'href' && /^(mailto|tel):/i.test(v)) el.setAttribute('href', v.startsWith('mailto') ? 'mailto:name@example.com' : 'tel:0000000000');
        if (n === 'srcset' || n === 'sizes') el.removeAttribute(n);
        else if (n !== 'class' && n !== 'style' && v.length > 300) el.setAttribute(n, '…trimmed');
      }
    }

    // readable serialisation
    const out = [];
    const ser = (node, depth, raw) => {
      const pad = '  '.repeat(depth);
      if (node.nodeType === 3) {
        const t = raw ? node.nodeValue : node.nodeValue.replace(/\s+/g, ' ').trim();
        if (t && t.trim()) out.push(raw ? t : pad + esc(t));
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.localName;
      let attrs = '';
      for (const a of node.attributes) attrs += ' ' + a.name + '="' + escAttr(a.value) + '"';
      if (VOID.has(tag)) { out.push(pad + '<' + tag + attrs + '>'); return; }
      const kids = Array.from(node.childNodes).filter((n) => n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim()));
      if (!kids.length) { out.push(pad + '<' + tag + attrs + '></' + tag + '>'); return; }
      if (RAW_TEXT.has(tag)) { out.push(pad + '<' + tag + attrs + '>' + esc(node.textContent) + '</' + tag + '>'); return; }
      if (kids.length === 1 && kids[0].nodeType === 3) {
        const t = kids[0].nodeValue.replace(/\s+/g, ' ').trim();
        if (t.length <= 110) { out.push(pad + '<' + tag + attrs + '>' + esc(t) + '</' + tag + '>'); return; }
      }
      out.push(pad + '<' + tag + attrs + '>');
      for (const k of kids) ser(k, depth + 1, false);
      out.push(pad + '</' + tag + '>');
    };
    if (clone === srcEl.ownerDocument.documentElement || clone.localName === 'html') {
      // keep a minimal <head> with title and meta only
      const head = doc.createElement('head');
      const t = doc.createElement('title'); t.textContent = privacy ? '[hidden]' : doc.title;
      head.appendChild(t);
      const oldHead = clone.querySelector('head');
      if (oldHead) oldHead.replaceWith(head); else clone.insertBefore(head, clone.firstChild);
    }
    ser(clone, 0, false);
    return out.join('\n');
  };

  /* ------------------------------------------------------------------ statistics / tokens */
  E.analyze = async function (doc, win, scope) {
    const els = [scope, ...Array.from(scope.querySelectorAll('*')).slice(0, 4000)];
    const text = {}, bg = {}, border = {}, fam = {}, size = {}, weight = {}, lh = {}, radius = {}, shadow = {};
    const spacing = {}, trans = {}, anim = {}, famWeights = {};
    const bgImages = new Set();
    const fixed = [];
    let n = 0;
    for (const el of els) {
      if (++n % 400 === 0) await tick();
      if (SKIP_TAGS.has(el.tagName)) continue;
      const cs = win.getComputedStyle(el);
      if (cs.display === 'none') continue;
      inc(text, colorHex(cs.color));
      inc(bg, colorHex(cs.backgroundColor));
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') inc(border, colorHex(cs.borderTopColor));
      const f = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      inc(fam, f);
      (famWeights[f] = famWeights[f] || new Set()).add(cs.fontWeight);
      inc(size, cs.fontSize); inc(weight, cs.fontWeight);
      if (cs.lineHeight !== 'normal') inc(lh, cs.lineHeight);
      if (cs.borderRadius && cs.borderRadius !== '0px') inc(radius, cs.borderRadius);
      if (cs.boxShadow && cs.boxShadow !== 'none') inc(shadow, cs.boxShadow);
      for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
        const v = parseFloat(cs[p]);
        if (v > 0 && v <= 240) inc(spacing, Math.round(v));
      }
      if (cs.transitionDuration && cs.transitionDuration !== '0s') {
        inc(trans, cs.transitionProperty + ' ' + cs.transitionDuration + ' ' + cs.transitionTimingFunction);
      }
      if (cs.animationName && cs.animationName !== 'none') {
        inc(anim, cs.animationName + ' ' + cs.animationDuration + ' ' + cs.animationIterationCount);
      }
      if (cs.backgroundImage && cs.backgroundImage.includes('url(') && bgImages.size < 60) {
        cs.backgroundImage.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s"']*))\s*\)/g, (m, a, b, c) => {
          const u = String(a || b || c || '');
          if (u && !u.startsWith('data:')) bgImages.add(toAbs(u, doc.baseURI));
          return m;
        });
      }
      if ((cs.position === 'fixed' || cs.position === 'sticky') && fixed.length < 20) {
        const r = el.getBoundingClientRect();
        fixed.push({ el: labelOf(el), position: cs.position, size: Math.round(r.width) + 'x' + Math.round(r.height), top: cs.top, bottom: cs.bottom, zIndex: cs.zIndex });
      }
    }

    // brand / accent guess: saturated colours, weighted by where they appear
    const accent = {};
    for (const [map, k] of [[bg, 1.5], [text, 1], [border, 0.5]]) {
      for (const [c, cnt] of Object.entries(map)) {
        const h = hsl(c);
        if (h && h.s >= 0.3 && h.l > 0.12 && h.l < 0.9) inc(accent, c.slice(0, 7), cnt * k);
      }
    }

    // typography of important elements
    const typo = {};
    ['body', 'h1', 'h2', 'h3', 'h4', 'h5', 'p', 'a', 'nav a', 'button', 'input', '.button, .btn, .elementor-button, .wp-block-button__link', 'label', 'li'].forEach((sel) => {
      let el = null;
      try { el = scope.querySelector(sel) || (scope === doc.body ? null : doc.querySelector(sel)); } catch (e) { /* ignore */ }
      if (sel === 'body') el = doc.body;
      if (!el) return;
      const cs = win.getComputedStyle(el);
      const o = {};
      ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor', 'padding', 'borderRadius', 'border', 'textTransform', 'textAlign'].forEach((p) => {
        let v = cs[p];
        if (/color/i.test(p)) v = colorHex(v) || v;
        o[p] = v;
      });
      typo[sel] = o;
    });

    const sortedSpacing = Object.entries(spacing).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 16)
      .map(([px, c]) => [Number(px), c]).sort((a, b) => a[0] - b[0]);

    return {
      palette: { text: top(text, 12), background: top(bg, 12), border: top(border, 8), accent: top(accent, 5) },
      fontFamilies: top(fam, 8),
      fontWeightsByFamily: Object.fromEntries(Object.entries(famWeights).slice(0, 8).map(([k, v]) => [k, [...v].sort()])),
      fontSizes: top(size, 14),
      fontWeights: top(weight, 6),
      lineHeights: top(lh, 8),
      radius: top(radius, 8),
      shadows: top(shadow, 6),
      spacing: sortedSpacing,
      transitions: top(trans, 10),
      animations: top(anim, 8),
      fixed,
      bgImages: [...bgImages],
      typo
    };
  };

  /* ------------------------------------------------------------------ outline & sections */
  E.outline = function (doc, win, scope, maxLines = 170) {
    const lines = [];
    const hx = (c) => colorHex(c);
    const walk = (el, depth) => {
      if (depth > 4 || lines.length >= maxLines) return;
      for (const ch of el.children) {
        if (lines.length >= maxLines) return;
        if (SKIP_TAGS.has(ch.tagName)) continue;
        const r = ch.getBoundingClientRect();
        const cs = win.getComputedStyle(ch);
        if (cs.display === 'none' || r.height < 20) continue;
        const h = ch.querySelector('h1,h2,h3,h4');
        const hasBg = hx(cs.backgroundColor);
        lines.push(
          '  '.repeat(depth) + labelOf(ch) +
          ' | ' + Math.round(r.width) + 'x' + Math.round(r.height) +
          ' | ' + cs.display +
          (cs.display.includes('flex') ? ' ' + cs.flexDirection + (cs.flexWrap !== 'nowrap' ? ' wrap' : '') + ' gap:' + cs.gap + ' justify:' + cs.justifyContent + ' align:' + cs.alignItems : '') +
          (cs.display.includes('grid') ? ' cols:' + cs.gridTemplateColumns : '') +
          (cs.position !== 'static' ? ' pos:' + cs.position : '') +
          (hasBg ? ' bg:' + hasBg : '') +
          (cs.backgroundImage !== 'none' ? ' bg-image' : '') +
          (cs.paddingTop !== '0px' || cs.paddingLeft !== '0px' ? ' pad:' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft : '') +
          (h ? ' | "' + h.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) + '"' : '')
        );
        walk(ch, depth + 1);
      }
    };
    walk(scope, 0);
    return lines;
  };

  E.findSections = function (doc, win, root, max = 30) {
    const vw = win.innerWidth, vh = win.innerHeight;
    const sx = win.scrollX, sy = win.scrollY;
    const vis = (el) => {
      if (SKIP_TAGS.has(el.tagName)) return false;
      const cs = win.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const kidsOf = (el) => Array.from(el.children).filter(vis);

    let container = root || doc.body;
    for (let g = 0; g < 6; g++) {
      const k = kidsOf(container);
      if (k.length !== 1) break;
      const r0 = container.getBoundingClientRect(), r1 = k[0].getBoundingClientRect();
      if (r1.height < r0.height * 0.9) break;
      container = k[0];
    }
    let list = kidsOf(container);
    const expand = (arr, depth) => arr.flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (depth < 3 && r.height > vh * 1.6) {
        const ks = kidsOf(el);
        if (ks.length >= 2) return expand(ks, depth + 1);
      }
      return [el];
    });
    list = expand(list, 0).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height >= 40 && r.width >= Math.min(vw * 0.4, 240);
    });
    if (!list.length) list = [root || doc.body];

    const items = list.map((el) => {
      const r = el.getBoundingClientRect();
      const h = el.querySelector('h1,h2,h3,h4');
      const cs = win.getComputedStyle(el);
      return {
        el,
        label: labelOf(el),
        selector: E.pathSelector(el),
        rect: { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height },
        bg: colorHex(cs.backgroundColor),
        heading: h ? h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : ''
      };
    }).sort((a, b) => a.rect.y - b.rect.y).slice(0, max);

    items.forEach((it, i) => {
      const base = (it.el.id || (it.el.getAttribute('class') || '').split(/\s+/)[0] || it.el.localName)
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || it.el.localName;
      it.slug = String(i + 1).padStart(2, '0') + '-' + (base || 'section');
    });
    return items;
  };

  /* ------------------------------------------------------------------ images & assets */
  E.collectAssets = function (doc, scope, bgImages, fontFaces, opt) {
    const base = doc.baseURI;
    const seen = new Set();
    const list = [];
    const add = (url, kind, note) => {
      if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
      const u = toAbs(url, base);
      if (!/^https?:/i.test(u) || seen.has(u)) return;
      seen.add(u);
      list.push({ url: u, kind: /\.svg(\?|#|$)/i.test(u) ? 'svg' : kind, note: note || '' });
    };
    if (opt.images) {
      scope.querySelectorAll('img').forEach((i) => add(i.currentSrc || i.src, 'image', i.alt || ''));
      scope.querySelectorAll('video[poster]').forEach((v) => add(v.getAttribute('poster'), 'image', 'video poster'));
      scope.querySelectorAll('use').forEach((u) => {
        const h = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
        if (h && !h.startsWith('#')) add(h.split('#')[0], 'svg', 'sprite');
      });
      (bgImages || []).forEach((u) => add(u, 'image', 'css background'));
    }
    if (opt.fonts) {
      for (const f of fontFaces || []) {
        const pick = f.urls.find((u) => /\.woff2(\?|#|$)/i.test(u)) || f.urls.find((u) => /\.woff(\?|#|$)/i.test(u)) || f.urls[0];
        if (pick) add(pick, 'font', f.family + ' ' + f.weight);
      }
    }
    return list;
  };

  E.imageList = function (doc, scope) {
    return Array.from(scope.querySelectorAll('img')).slice(0, 80).map((i) =>
      (i.currentSrc || i.src) + ' | alt="' + (i.alt || '') + '" | natural ' + i.naturalWidth + 'x' + i.naturalHeight +
      ' → shown ' + Math.round(i.width) + 'x' + Math.round(i.height));
  };

  /* ------------------------------------------------------------------ main entry */
  E.run = async function (ctx) {
    const { doc, win, root, usedOnly, privacy, libs, fetchResource, onStatus } = ctx;
    const scope = root || doc.body;
    const svgSink = [];

    if (onStatus) onStatus('extract');
    const cssData = await E.collectCss({ doc, win, root: root || doc.documentElement, usedOnly, fetchResource, onStatus });
    const html = E.cleanHtml(root || doc.documentElement, { doc, privacy, svgSink });
    const stats = await E.analyze(doc, win, scope);
    const outline = E.outline(doc, win, scope);
    const sections = E.findSections(doc, win, root);

    // per-section clean html (shares the svg sink so ids stay unique)
    for (const s of sections) s.html = E.cleanHtml(s.el, { doc, privacy, svgSink });

    const dir = doc.documentElement.dir || win.getComputedStyle(doc.body).direction;
    const persianRe = /vazir|iransans|iranyekan|yekan|shabnam|sahel|samim|estedad|dana\b|peyda|kalameh|lalezar|mikhak|nazanin|noto (sans|naskh) arabic|iransansx|byekan|yekanbakh/i;
    const persianFonts = [...new Set([
      ...stats.fontFamilies.map((f) => f[0]),
      ...cssData.fontFaces.map((f) => f.family)
    ])].filter((f) => persianRe.test(f));

    const meta = {
      url: privacy ? win.location.origin + win.location.pathname : win.location.href,
      title: privacy ? '[hidden]' : doc.title,
      lang: doc.documentElement.lang || '',
      dir,
      viewportMeta: (doc.querySelector('meta[name=viewport]') || {}).content || '',
      description: privacy ? '' : ((doc.querySelector('meta[name=description]') || {}).content || ''),
      generator: (doc.querySelector('meta[name=generator]') || {}).content || '',
      themeColor: (doc.querySelector('meta[name=theme-color]') || {}).content || '',
      windowSize: win.innerWidth + 'x' + win.innerHeight,
      pageSize: doc.documentElement.scrollWidth + 'x' + doc.documentElement.scrollHeight,
      bodyClass: (doc.body.className || '').toString().slice(0, 300),
      scrollBehavior: win.getComputedStyle(doc.documentElement).scrollBehavior,
      capturedAt: new Date().toISOString(),
      scopeSelector: root ? E.pathSelector(root) : '(full page)',
      persianFonts
    };

    const scripts = Array.from(doc.scripts).map((s) => s.src).filter(Boolean).slice(0, 60);
    let hoverRules = 0;
    hoverRules = (cssData.css.match(/:hover/g) || []).length;

    return {
      meta, libs: libs || [], scripts, html, svgSink, css: cssData, stats, outline, sections,
      images: E.imageList(doc, scope), hoverRules
    };
  };
})();
