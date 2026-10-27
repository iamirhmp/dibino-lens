/* Dibino Lens – floating panel (Shadow DOM, so the page's CSS can't touch it) + element picker */
(() => {
  const DL = (globalThis.DL = globalThis.DL || {});
  const UI = (DL.ui = {});

  const LOGO = '<svg viewBox="0 0 128 128" width="30" height="30" fill="none" aria-hidden="true">' +
    '<rect width="128" height="128" rx="30" fill="#0A0A0A"/>' +
    '<g stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M30 48V38a8 8 0 0 1 8-8h10"/><path d="M80 30h10a8 8 0 0 1 8 8v10"/>' +
    '<path d="M98 80v10a8 8 0 0 1-8 8H80"/><path d="M48 98H38a8 8 0 0 1-8-8V80"/></g>' +
    '<circle cx="64" cy="64" r="19" stroke="#fff" stroke-width="7"/>' +
    '<path d="M57 54h4a10 10 0 0 1 0 20h-4z" fill="#fff"/></svg>';

  const CSS = `
:host{all:initial}
*,*::before,*::after{box-sizing:border-box}
.panel{--font:system-ui,-apple-system,"Segoe UI",Tahoma,"Noto Sans Arabic","Noto Sans",Arial,sans-serif;
  position:absolute;top:16px;right:16px;width:376px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;
  background:#fff;color:#0a0a0a;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden;pointer-events:auto;
  box-shadow:0 18px 50px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.08);font:14px/1.6 var(--font);text-align:start}
.panel[hidden]{display:none}
button,select,input{font:inherit;color:inherit}
.hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #efefef;cursor:grab;user-select:none;touch-action:none}
.hdr:active{cursor:grabbing}
.brand{display:flex;align-items:center;gap:10px;min-width:0}
.brand b{display:block;font-size:15px;line-height:1.2}
.brand small{display:block;color:#737373;font-size:12px;line-height:1.3}
.hb{display:flex;gap:6px}
.ib{width:32px;height:32px;display:grid;place-items:center;border:1px solid #e5e5e5;background:#fff;border-radius:9px;cursor:pointer;font-size:12px;font-weight:700;color:#404040}
.ib:hover{background:#f5f5f5}
.body{padding:6px 16px 16px;overflow:auto}
h3{margin:16px 0 8px;font-size:12px;font-weight:700;color:#737373}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;background:#f3f3f3;border-radius:11px}
.seg button{border:0;background:transparent;padding:8px 6px;border-radius:8px;cursor:pointer;color:#525252}
.seg button.on{background:#fff;color:#0a0a0a;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.14)}
.pick{margin-top:10px;padding:10px 12px;border:1px dashed #c8c8c8;border-radius:11px;background:#fafafa;font-size:13px}
.pick code{display:block;direction:ltr;text-align:left;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#0a0a0a;word-break:break-all;margin:2px 0 8px}
.row{display:flex;flex-wrap:wrap;gap:6px}
.sm{padding:6px 10px;border:1px solid #d4d4d4;background:#fff;border-radius:9px;cursor:pointer;font-size:12.5px}
.sm:hover{background:#f5f5f5}
.sm[disabled]{opacity:.45;cursor:not-allowed}
.chk{display:flex;align-items:flex-start;gap:10px;padding:5px 0;cursor:pointer}
.chk input{appearance:none;-webkit-appearance:none;flex:none;width:18px;height:18px;margin:3px 0 0;border:1.5px solid #a3a3a3;border-radius:5px;background:#fff;display:grid;place-content:center;cursor:pointer}
.chk input:checked{background:#0a0a0a;border-color:#0a0a0a}
.chk input:checked::after{content:"";width:9px;height:5px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) translate(1px,-1px)}
.chk span{flex:1}
.hint{display:block;color:#737373;font-size:12px;line-height:1.5}
select{width:100%;padding:9px 10px;border:1px solid #d4d4d4;border-radius:10px;background:#fff}
.two{display:grid;grid-template-columns:1fr auto;gap:8px}
.primary{width:100%;margin-top:16px;padding:12px;border:0;border-radius:12px;background:#0a0a0a;color:#fff;font-weight:700;cursor:pointer}
.primary:hover{background:#262626}
.primary.ghost{background:#fff;color:#0a0a0a;border:1px solid #d4d4d4}
.primary.ghost:hover{background:#f5f5f5}
.note{margin:12px 0 0;color:#737373;font-size:11.5px;line-height:1.6}
.status{margin-top:14px}
.status:empty{display:none}
.bar{height:6px;background:#ececec;border-radius:99px;overflow:hidden}
.bar i{display:block;height:100%;width:0;background:#0a0a0a;border-radius:99px;transition:width .25s}
.ptext{margin:8px 0 0;font-size:12.5px;color:#404040}
.opt{display:flex;align-items:flex-start;gap:6px}
.opt .chk{flex:1}
.tip{flex:none;display:inline-grid;place-items:center;width:22px;height:22px;margin-top:3px;color:#8a8a8a;border-radius:50%;cursor:help;vertical-align:middle}
.tip:hover,.tip:focus-visible{color:#0a0a0a;background:#f0f0f0}
h3 .tip{margin:0 6px;width:20px;height:20px;margin-top:-2px}
.tipbox{position:fixed;display:none;width:230px;padding:9px 11px;background:#0a0a0a;color:#fff;border-radius:9px;font-size:12px;line-height:1.6;font-weight:400;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none;text-align:start}
.card{margin-top:0;padding:18px 16px;border:1px solid #e5e5e5;border-radius:14px;background:#fafafa}
.badge{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#0a0a0a}
.badge.cancel,.badge.error{background:#737373}
.rt{font-size:17px;line-height:1.3}
.result .body{padding-top:14px}
.result .primary{margin-top:10px}
.result .card+.primary{margin-top:12px}
.card .work{margin-bottom:8px}
.card .box{background:#fff}
.running .lock,.running .pick,.running .note{display:none}
.running .body{padding-top:14px}
.running .status{margin-top:0;padding:16px;border:1px solid #e5e5e5;border-radius:14px;background:#fafafa}
.work{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.work b{font-size:22px;line-height:1;font-variant-numeric:tabular-nums}
.dot{width:10px;height:10px;border-radius:50%;background:#0a0a0a;animation:pulse 1.1s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.25;transform:scale(.7)}}
.running .ptext{font-size:13.5px;color:#0a0a0a}
.running .bar{height:8px}
@media (prefers-reduced-motion:reduce){.dot{animation:none}}
.box{padding:10px 12px;border:1px solid #e5e5e5;background:#fafafa;border-radius:11px;font-size:12.5px;color:#404040;margin-top:8px}
.box ul{margin:6px 0 0;padding-inline-start:18px}
.ok{font-weight:700;color:#0a0a0a;font-size:13.5px}
.running .lock{opacity:.5;pointer-events:none}
:focus-visible{outline:2px solid #0a0a0a;outline-offset:2px}
.hl{position:fixed;display:none;pointer-events:none;border:2px solid #0a0a0a;outline:2px solid #fff;background:rgba(10,10,10,.07);border-radius:3px}
.hl b{position:absolute;top:-26px;inset-inline-start:-2px;max-width:70vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#0a0a0a;color:#fff;font:600 11.5px/1 ui-monospace,Menlo,Consolas,monospace;padding:6px 8px;border-radius:6px;direction:ltr}
`;

  let host = null, root = null, panel = null, hl = null, tipEl = null;
  let picking = false;
  let handlers = {};
  let statusHtml = '';
  let running = false;
  let view = 'form';
  let resultKind = 'ok';
  let progress = { text: '', pct: 0 };

  UI.opts = {
    scope: 'full', shotDesktop: true, shotMobile: true, shotTablet: false, shotSections: true,
    assetsImg: true, assetsFonts: false, cssUsed: true, privacy: false, tpl: 'html', format: 'zip', lang: 'en'
  };
  UI.state = { picked: null };

  /* ------------------------------------------------------------------ mount / render */
  UI.mount = async function () {
    UI.opts.lang = DL.detectLang();
    try {
      const st = await chrome.storage.local.get(['dlOpts']);
      if (st && st.dlOpts) Object.assign(UI.opts, st.dlOpts, { scope: 'full' });
    } catch (e) { /* storage unavailable */ }
    DL.setLang(UI.opts.lang);

    host = document.createElement('div');
    host.id = 'dibino-lens-host';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block;';
    root = host.attachShadow({ mode: 'open' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      const st = document.createElement('style');
      st.textContent = CSS;
      root.appendChild(st);
    }
    panel = document.createElement('div');
    panel.className = 'panel';
    hl = document.createElement('div');
    hl.className = 'hl';
    hl.innerHTML = '<b></b>';
    root.append(panel, hl);
    document.documentElement.appendChild(host);

    panel.addEventListener('click', onClick);
    panel.addEventListener('change', onChange);
    tipEl = document.createElement('div');
    tipEl.className = 'tipbox';
    root.appendChild(tipEl);
    const showTip = (e) => {
      const el = e.target.closest && e.target.closest('.tip');
      if (!el) return;
      tipEl.textContent = el.getAttribute('data-tip');
      tipEl.style.display = 'block';
      const r = el.getBoundingClientRect();
      const left = Math.min(Math.max(8, r.left + r.width / 2 - 115), window.innerWidth - 238);
      let top = r.bottom + 8;
      if (top + tipEl.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - tipEl.offsetHeight - 8);
      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';
      tipEl.style.direction = UI.opts.lang === 'fa' ? 'rtl' : 'ltr';
    };
    const hideTip = () => { tipEl.style.display = 'none'; };
    panel.addEventListener('mouseover', showTip);
    panel.addEventListener('mouseout', hideTip);
    panel.addEventListener('focusin', showTip);
    panel.addEventListener('focusout', hideTip);
    enableDrag();
    UI.render();
  };

  const t = (k, v) => DL.t(k, v);
  const INFO = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.2v3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="5" r=".9" fill="currentColor"/></svg>';
  const tip = (text) => text ? '<span class="tip" tabindex="0" role="img" aria-label="' + escHtml(text) + '" data-tip="' + escHtml(text) + '">' + INFO + '</span>' : '';
  const chk = (key, label, tipText) =>
    '<div class="opt"><label class="chk"><input type="checkbox" data-opt="' + key + '"' + (UI.opts[key] ? ' checked' : '') + '><span>' + label + '</span></label>' + tip(tipText) + '</div>';
  const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  UI.render = function () {
    const o = UI.opts;
    const fa = o.lang === 'fa';
    panel.setAttribute('dir', fa ? 'rtl' : 'ltr');
    panel.setAttribute('lang', fa ? 'fa' : 'en');
    panel.classList.toggle('running', running);

    let pickBox = '';
    if (o.scope === 'pick') {
      const el = UI.state.picked;
      pickBox = '<div class="pick lock">' +
        (picking ? t('pickHint') :
          el && el.isConnected
            ? t('picked') + ':<code>' + escHtml(DL.extract.labelOf(el)) + '  ·  ' + Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height) + '</code>' +
              '<div class="row"><button class="sm" data-act="parent">' + t('pickParent') + '</button><button class="sm" data-act="child">' + t('pickChild') + '</button>' +
              '<button class="sm" data-act="pick">' + t('pickAgain') + '</button></div>'
            : t('pickNone') + '<div class="row" style="margin-top:8px"><button class="sm" data-act="pick">' + t('pickStart') + '</button></div>') +
        '</div>';
    }

    const hdr =
      '<div class="hdr" data-drag>' +
        '<div class="brand">' + LOGO + '<div><b>Dibino Lens</b><small>' + t('tagline') + '</small></div></div>' +
        '<div class="hb"><button class="ib" data-act="lang" title="Language">' + t('langBtn') + '</button>' +
        '<button class="ib" data-act="close" aria-label="' + t('close') + '">✕</button></div>' +
      '</div>';

    if (view === 'result' && !running) {
      const icons = {
        ok: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        cancel: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>',
        error: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 6v8" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><circle cx="12" cy="18" r="1.6" fill="#fff"/></svg>'
      };
      const title = resultKind === 'ok' ? t('done') : resultKind === 'cancel' ? t('cancelled') : t('errTitle');
      panel.className = 'panel result';
      panel.innerHTML = hdr +
        '<div class="body"><div class="status card" aria-live="polite">' +
          '<div class="work"><span class="badge ' + resultKind + '">' + icons[resultKind] + '</span><b class="rt">' + title + '</b></div>' +
          statusHtml +
        '</div>' +
        (resultKind === 'ok' ? '<button class="primary ghost" data-act="copy">' + t('copyPrompt') + '</button>' : '') +
        '<button class="primary" data-act="again">' + t('runAgain') + '</button></div>';
      return;
    }

    panel.className = 'panel' + (running ? ' running' : '');
    panel.innerHTML = hdr +
      '<div class="body">' +
        '<div class="lock">' +
        '<h3>' + t('scope') + '</h3>' +
        '<div class="seg"><button data-scope="full" class="' + (o.scope === 'full' ? 'on' : '') + '">' + t('scopeFull') + '</button>' +
        '<button data-scope="pick" class="' + (o.scope === 'pick' ? 'on' : '') + '">' + t('scopePick') + '</button></div></div>' +
        pickBox +
        '<div class="lock">' +
        '<h3>' + t('include') + '</h3>' +
        chk('shotDesktop', t('shotDesktop'), t('tip_shotDesktop')) + chk('shotMobile', t('shotMobile'), t('tip_shotMobile')) + chk('shotTablet', t('shotTablet'), t('tip_shotTablet')) +
        chk('shotSections', t('shotSections'), t('tip_shotSections')) + chk('assetsImg', t('assetsImg'), t('tip_assetsImg')) + chk('assetsFonts', t('assetsFonts'), t('tip_assetsFonts')) +
        chk('cssUsed', t('cssUsed'), t('tip_cssUsed')) + chk('privacy', t('privacy'), t('privacyHint')) +
        '<h3>' + t('prompt') + tip(t('tip_prompt')) + '</h3>' +
        '<div class="two"><select data-opt="tpl">' +
          [['html', 'tplHtml'], ['tailwind', 'tplTailwind'], ['react', 'tplReact'], ['elementor', 'tplElementor']]
            .map(([v, k]) => '<option value="' + v + '"' + (o.tpl === v ? ' selected' : '') + '>' + t(k) + '</option>').join('') +
        '</select><button class="sm" data-act="copy">' + t('copyPrompt') + '</button></div>' +
        '<h3>' + t('output') + tip(t('tip_output')) + '</h3>' +
        '<select data-opt="format"><option value="zip"' + (o.format === 'zip' ? ' selected' : '') + '>' + t('fmtZip') + '</option>' +
        '<option value="md"' + (o.format === 'md' ? ' selected' : '') + '>' + t('fmtMd') + '</option></select>' +
        '</div>' +
        '<div class="status" id="status" aria-live="polite">' + (running ? '<div class="work"><span class="dot"></span><b id="pct">0%</b></div>' : '') + statusHtml + '</div>' +
        (running
          ? '<button class="primary ghost" data-act="cancel">' + t('cancel') + '</button>'
          : '<button class="primary" data-act="run">' + t('run') + '</button>') +
        '<p class="note">' + t('disclaimer') + '</p>' +
      '</div>';

    if (running) UI.progress(progress.text, progress.pct);
  };

  /* ------------------------------------------------------------------ events */
  function save() {
    try { const { scope, ...rest } = UI.opts; chrome.storage.local.set({ dlOpts: rest }); } catch (e) { /* ignore */ }
  }

  function onChange(e) {
    const el = e.target.closest('[data-opt]');
    if (!el) return;
    const key = el.getAttribute('data-opt');
    UI.opts[key] = el.type === 'checkbox' ? el.checked : el.value;
    save();
  }

  async function onClick(e) {
    const scopeBtn = e.target.closest('[data-scope]');
    if (scopeBtn) {
      UI.opts.scope = scopeBtn.getAttribute('data-scope');
      statusHtml = '';
      UI.render();
      if (UI.opts.scope === 'pick' && !(UI.state.picked && UI.state.picked.isConnected)) UI.startPick();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.getAttribute('data-act');
    if (act === 'close') return UI.hide();
    if (act === 'lang') {
      UI.opts.lang = UI.opts.lang === 'fa' ? 'en' : 'fa';
      DL.setLang(UI.opts.lang); save();
      try { chrome.storage.local.set({ lang: UI.opts.lang }); } catch (err) { /* ignore */ }
      return UI.render();
    }
    if (act === 'pick') return UI.startPick();
    if (act === 'parent') { const p = UI.state.picked && UI.state.picked.parentElement; if (p && p !== document.documentElement) UI.state.picked = p; return UI.render(); }
    if (act === 'child') {
      const el = UI.state.picked;
      const c = el && Array.from(el.children).filter((k) => k.getBoundingClientRect().height > 20).sort((a, z) => z.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
      if (c) UI.state.picked = c;
      return UI.render();
    }
    if (act === 'copy') {
      const text = DL.report.promptText(UI.opts.tpl, UI.opts.lang);
      await copyText(text);
      b.textContent = t('copied');
      setTimeout(() => { if (b.isConnected) b.textContent = t('copyPrompt'); }, 1600);
      return;
    }
    if (act === 'again') { view = 'form'; statusHtml = ''; return UI.render(); }
    if (act === 'run' && handlers.run) return handlers.run();
    if (act === 'cancel' && handlers.cancel) return handlers.cancel();
    if (act === 'perm' && handlers.perm) return handlers.perm();
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return; } catch (e) { /* fall back */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.documentElement.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  /* ------------------------------------------------------------------ element picker */
  function targetOf(e) {
    const el = e.target;
    if (!el || el === host || el === document.documentElement) return null;
    return el.nodeType === 1 ? el : null;
  }
  function moveHl(el) {
    if (!el) { hl.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    hl.style.cssText = 'display:block;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
    hl.firstChild.textContent = DL.extract.labelOf(el) + '  ' + Math.round(r.width) + '×' + Math.round(r.height);
    hl.firstChild.style.top = r.top < 30 ? 'auto' : '-26px';
    hl.firstChild.style.bottom = r.top < 30 ? '-26px' : 'auto';
  }
  const onMove = (e) => { moveHl(targetOf(e)); };
  const onPickClick = (e) => {
    const el = targetOf(e);
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    UI.state.picked = el;
    UI.stopPick();
  };
  const swallow = (e) => { if (targetOf(e)) { e.preventDefault(); e.stopPropagation(); } };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); UI.stopPick(); }
  };

  UI.startPick = function () {
    if (picking) return;
    picking = true;
    UI.opts.scope = 'pick';
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onPickClick, true);
    document.addEventListener('mousedown', swallow, true);
    document.addEventListener('mouseup', swallow, true);
    document.addEventListener('keydown', onKey, true);
    UI.render();
  };
  UI.stopPick = function () {
    picking = false;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onPickClick, true);
    document.removeEventListener('mousedown', swallow, true);
    document.removeEventListener('mouseup', swallow, true);
    document.removeEventListener('keydown', onKey, true);
    hl.style.display = 'none';
    UI.render();
  };

  /* ------------------------------------------------------------------ drag */
  function enableDrag() {
    let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    panel.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('[data-drag]');
      if (!h || e.target.closest('button')) return;
      on = true; sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.setPointerCapture(e.pointerId);
    });
    panel.addEventListener('pointermove', (e) => {
      if (!on) return;
      const x = Math.min(Math.max(0, ox + e.clientX - sx), window.innerWidth - 80);
      const y = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - 50);
      panel.style.left = x + 'px'; panel.style.top = y + 'px'; panel.style.right = 'auto';
    });
    const end = () => { on = false; };
    panel.addEventListener('pointerup', end);
    panel.addEventListener('pointercancel', end);
  }

  /* ------------------------------------------------------------------ show / hide / capture helpers */
  UI.show = function () { host.style.display = 'block'; panel.hidden = false; };
  UI.hide = function () { if (picking) UI.stopPick(); panel.hidden = true; };
  UI.toggle = function () { if (panel.hidden || host.style.display === 'none') UI.show(); else UI.hide(); };
  UI.hideForSnap = async function () {
    host.style.visibility = 'hidden';
    await Promise.race([
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      new Promise((r) => setTimeout(r, 120))
    ]);
    await new Promise((r) => setTimeout(r, 60));
  };
  UI.showAfterSnap = function () { host.style.visibility = 'visible'; };

  /* ------------------------------------------------------------------ run state */
  UI.bind = function (h) { handlers = h; };
  UI.setRunning = function (v) {
    running = v;
    if (v) { view = 'form'; statusHtml = '<div class="bar"><i id="pbar"></i></div><p class="ptext" id="ptext"></p>'; progress = { text: t('working'), pct: 0 }; }
    UI.render();
  };
  UI.progress = function (text, pct) {
    progress = { text: text != null ? text : progress.text, pct: pct != null ? pct : progress.pct };
    const bar = root.getElementById ? root.getElementById('pbar') : root.querySelector('#pbar');
    const pt = root.querySelector('#ptext');
    if (bar) bar.style.width = Math.round(progress.pct * 100) + '%';
    if (pt) pt.textContent = progress.text;
    const pc = root.querySelector('#pct');
    if (pc) pc.textContent = Math.round(progress.pct * 100) + '%';
  };
  UI.setStatus = function (html) {
    statusHtml = html;
    const s = root.querySelector('#status');
    if (s) s.innerHTML = html;
  };
  UI.finish = function (html, kind) {
    running = false;
    view = 'result';
    resultKind = kind || 'ok';
    statusHtml = html;
    UI.render();
  };
  UI.permGranted = function () {
    statusHtml = '<div class="box ok">' + t('permDone') + '</div>';
    UI.show();
    UI.render();
  };
  UI.esc = escHtml;
})();
