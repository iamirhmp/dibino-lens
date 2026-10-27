/* Dibino Lens – privacy mode.
 * Replaces every word with a same-length placeholder (so layout stays almost identical),
 * masks long digit sequences and clears form values. Returns a function that restores everything.
 */
(() => {
  const DL = (globalThis.DL = globalThis.DL || {});

  const LATIN = 'loremipsumdolorsitametconsecteturadipiscingelit';
  const ARABIC = 'لورمایپسومدولورسیتامتکانسکتتورادیپیسینگالیت';
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const ATTRS = ['alt', 'title', 'placeholder', 'aria-label'];

  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  function maskWord(w) {
    const pool = /[؀-ۿ]/.test(w) ? ARABIC : LATIN;
    const len = Array.from(w).length;
    const off = hash(w) % pool.length;
    let out = '';
    for (let i = 0; i < len; i++) out += pool[(off + i) % pool.length];
    return out;
  }

  DL.maskText = (t) => String(t)
    .replace(/[\p{L}\p{M}]+/gu, maskWord)
    .replace(/[0-9۰-۹٠-٩]{4,}/g, (m) => '0'.repeat(m.length));

  DL.anonymize = function anonymize(doc) {
    const undo = [];
    const body = doc.body;
    if (!body) return () => {};

    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const p = n.parentElement;
      if (!p || SKIP.has(p.tagName)) continue;
      const v = n.nodeValue;
      if (!v || !v.trim()) continue;
      undo.push(() => { n.nodeValue = v; });
      n.nodeValue = DL.maskText(v);
    }

    const sel = ATTRS.map((a) => '[' + a + ']').join(',');
    for (const el of body.querySelectorAll(sel)) {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v) { undo.push(() => el.setAttribute(a, v)); el.setAttribute(a, DL.maskText(v)); }
      }
    }

    for (const el of body.querySelectorAll('input, textarea, select')) {
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (['checkbox', 'radio', 'hidden', 'submit', 'button', 'reset', 'image', 'file', 'range', 'color'].includes(type)) continue;
      if (el.tagName === 'SELECT') continue;
      const prop = el.value;
      const attr = el.getAttribute('value');
      if (prop) { undo.push(() => { el.value = prop; }); el.value = ''; }
      if (attr) { undo.push(() => el.setAttribute('value', attr)); el.removeAttribute('value'); }
    }

    return function restore() {
      for (let i = undo.length - 1; i >= 0; i--) { try { undo[i](); } catch (e) { /* node removed */ } }
    };
  };
})();
