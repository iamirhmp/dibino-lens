/* Dibino Lens – builds the files of the package: START-HERE, report, tokens, Tailwind theme, prompts */
(() => {
  const DL = (globalThis.DL = globalThis.DL || {});
  const R = (DL.report = {});
  const F = '`'.repeat(3);
  const FF = '`'.repeat(4);

  /* ------------------------------------------------------------------ prompts */
  const PROMPTS = {
    en: {
      common: [
        'You are a senior front-end engineer. I extracted the design of a web page with Dibino Lens, and I want you to rebuild it.',
        '',
        'How to read the package:',
        '- screenshots/ is the visual source of truth. Match it closely (layout, spacing, colours, typography, borders, shadows).',
        '- page.html is the rendered DOM (scripts removed): use it for the real texts, hierarchy and structure.',
        '- styles.css holds the exact CSS values the page uses: read it for numbers, but rewrite it clean – do not paste it blindly.',
        '- tokens.json (and the Tailwind files) hold colours, fonts, type scale, radius, shadows, spacing and breakpoints.',
        '- sections/ has one screenshot + HTML per section: work section by section.',
        '- report.md has the layout outline (desktop and mobile), interactions, images and the technology guess.',
        ''
      ].join('\n'),
      html: [
        'Build it with plain HTML and CSS only (no frameworks, no build step, no CDN).',
        '',
        'Requirements:',
        '1. Pixel-faithful on desktop, then make mobile and tablet match their screenshots, using the breakpoints from report.md.',
        '2. Define the design tokens as CSS custom properties on :root and use them everywhere.',
        '3. Semantic HTML5, accessible (landmarks, alt text, labels, visible focus states).',
        '4. Keep the language and direction from the report; when the page is RTL use logical properties (margin-inline, padding-inline, inset-inline).',
        '5. Re-create the hover / focus / transition behaviour listed in report.md.',
        '6. Do not invent content: reuse the texts and image URLs from page.html; use neutral placeholders for missing images.',
        '7. Deliver separate files: index.html, styles.css and (only if really needed) script.js.',
        '',
        'If something is ambiguous, ask me before guessing.'
      ].join('\n'),
      tailwind: [
        'Build it with Tailwind CSS (v4 syntax; tailwind-theme.css contains the tokens as @theme, tailwind.config.snippet.js is the v3 equivalent).',
        '',
        'Requirements:',
        '1. Use utility classes; add custom CSS only when Tailwind cannot express it.',
        '2. Put the tokens in the theme and use the token names, not raw hex values.',
        '3. Mobile-first, with the breakpoints from report.md; match all provided screenshots.',
        '4. Semantic and accessible HTML; keep language and direction (use rtl: / logical utilities for RTL pages).',
        '5. Extract repeated patterns into small partials / components, and keep hover, focus and transition behaviour from report.md.',
        '6. Do not invent content; reuse texts and image URLs from page.html.',
        '7. Deliver the result as separate files.',
        '',
        'If something is ambiguous, ask me before guessing.'
      ].join('\n'),
      react: [
        'Build it as a React + TypeScript + Tailwind CSS project (v4 syntax; tailwind-theme.css has the tokens).',
        '',
        'Requirements:',
        '1. One component per section (use the names in sections/), composed in a single page component.',
        '2. Content lives in typed data objects/props – no hard-coded repeated markup. No UI libraries.',
        '3. Match the screenshots on desktop, tablet and mobile; mobile-first with the breakpoints from report.md.',
        '4. Accessible and semantic; keep the page language and direction.',
        '5. Re-create the hover / focus / transition behaviour and any sliders, tabs or menus the report lists, with small hooks instead of heavy libraries.',
        '6. Do not invent content; reuse texts and image URLs from page.html.',
        '7. Show the file tree first, then every file.',
        '',
        'If something is ambiguous, ask me before guessing.'
      ].join('\n'),
      elementor: [
        'I will build this in Elementor (Containers, not legacy sections). Do not write one big custom HTML block.',
        '',
        'Give me:',
        '1. The Global Colors and Global Fonts to create (from tokens.json), with exact values and names.',
        '2. The page as a tree of nested Containers per section: direction, widths, gaps, paddings, alignment – for desktop, tablet and mobile.',
        '3. For every element, which widget to use (Heading, Text Editor, Button, Image, Icon List, Nav Menu, Loop Grid, Tabs, Accordion…) and its settings.',
        '4. Minimal custom CSS, only for what widgets cannot do, scoped with a custom class.',
        '5. The hover / entrance / sticky behaviour from report.md as Elementor motion effects.',
        '6. Match the screenshots; keep the page direction (RTL) and use the real texts from page.html.',
        '',
        'If you have Elementor MCP tools connected, build it directly instead of only describing it. If something is ambiguous, ask me first.'
      ].join('\n')
    },
    fa: {
      common: [
        'تو یک مهندس فرانت‌اند ارشد هستی. دیزاین یک صفحه‌ی وب را با «دیبینو لنز» استخراج کرده‌ام و می‌خواهم آن را بازسازی کنی.',
        '',
        'طرز خواندن بسته:',
        '- پوشه‌ی screenshots/ مرجع اصلی ظاهر است؛ تا جای ممکن عین آن بساز (چیدمان، فاصله‌ها، رنگ، تایپوگرافی، border و سایه).',
        '- page.html همان DOM رندرشده (بدون اسکریپت) است؛ متن‌های واقعی، سلسله‌مراتب و ساختار را از آن بردار.',
        '- styles.css مقدارهای دقیق CSS صفحه را دارد؛ اعداد را از آن بخوان ولی تمیز و مرتب بازنویسی کن، کورکورانه کپی نکن.',
        '- tokens.json (و فایل‌های Tailwind) رنگ‌ها، فونت‌ها، مقیاس تایپوگرافی، radius، سایه‌ها، فاصله‌ها و breakpointها را دارند.',
        '- پوشه‌ی sections/ برای هر سکشن یک اسکرین‌شات و HTML دارد؛ سکشن به سکشن جلو برو.',
        '- report.md ساختار چیدمان (دسکتاپ و موبایل)، تعامل‌ها، تصاویر و حدس تکنولوژی را دارد.',
        ''
      ].join('\n'),
      html: [
        'فقط با HTML و CSS خالص بساز (بدون فریم‌ورک، بدون build، بدون CDN).',
        '',
        'الزامات:',
        '۱. روی دسکتاپ پیکسل‌به‌پیکسل مطابق اسکرین‌شات باشد، بعد موبایل و تبلت را با breakpointهای report.md مطابق اسکرین‌شاتشان کن.',
        '۲. توکن‌های دیزاین را به‌صورت CSS custom property روی :root تعریف کن و همه‌جا از آن‌ها استفاده کن.',
        '۳. HTML5 معنایی و قابل‌دسترس (landmark، alt، label و focus مشخص).',
        '۴. زبان و جهت صفحه را طبق گزارش نگه دار؛ اگر RTL است از logical property استفاده کن (margin-inline، padding-inline، inset-inline).',
        '۵. رفتار hover / focus / transition که در report.md آمده را بازسازی کن.',
        '۶. محتوا اختراع نکن: متن‌ها و آدرس تصاویر را از page.html بردار و برای تصاویری که در دسترس نیستند جایگزین خنثی بگذار.',
        '۷. خروجی را در فایل‌های جدا بده: index.html، styles.css و فقط در صورت لزوم script.js.',
        '',
        'اگر جایی مبهم بود، قبل از حدس زدن از من بپرس.'
      ].join('\n'),
      tailwind: [
        'با Tailwind CSS بساز (سینتکس v4؛ فایل tailwind-theme.css توکن‌ها را به‌صورت @theme دارد و tailwind.config.snippet.js معادل v3 است).',
        '',
        'الزامات:',
        '۱. از utility class استفاده کن؛ CSS سفارشی فقط وقتی که Tailwind نمی‌تواند بیان کند.',
        '۲. توکن‌ها را در theme بگذار و به‌جای hex خام از اسم توکن‌ها استفاده کن.',
        '۳. موبایل‌فرست و با breakpointهای report.md؛ با همه‌ی اسکرین‌شات‌ها مطابق باشد.',
        '۴. HTML معنایی و قابل‌دسترس؛ زبان و جهت را نگه دار (برای صفحه‌های RTL از rtl: و ابزارهای logical استفاده کن).',
        '۵. الگوهای تکراری را به partial/کامپوننت کوچک تبدیل کن و رفتار hover، focus و transition را طبق report.md نگه دار.',
        '۶. محتوا اختراع نکن؛ متن‌ها و آدرس تصاویر را از page.html بردار.',
        '۷. نتیجه را در فایل‌های جدا بده.',
        '',
        'اگر جایی مبهم بود، قبل از حدس زدن از من بپرس.'
      ].join('\n'),
      react: [
        'به‌صورت پروژه‌ی React + TypeScript + Tailwind CSS بساز (سینتکس v4؛ tailwind-theme.css توکن‌ها را دارد).',
        '',
        'الزامات:',
        '۱. برای هر سکشن یک کامپوننت (با اسم‌های پوشه‌ی sections/) و یک کامپوننت صفحه که همه را کنار هم می‌گذارد.',
        '۲. محتوا در data/props تایپ‌شده باشد، نه markup تکراری هاردکد. از کتابخانه‌ی UI استفاده نکن.',
        '۳. روی دسکتاپ، تبلت و موبایل مطابق اسکرین‌شات‌ها؛ موبایل‌فرست با breakpointهای report.md.',
        '۴. قابل‌دسترس و معنایی؛ زبان و جهت صفحه را نگه دار.',
        '۵. رفتار hover / focus / transition و اسلایدر، تب یا منویی که گزارش آورده را با hookهای کوچک بساز، نه کتابخانه‌ی سنگین.',
        '۶. محتوا اختراع نکن؛ متن‌ها و آدرس تصاویر را از page.html بردار.',
        '۷. اول درخت فایل‌ها را نشان بده، بعد همه‌ی فایل‌ها را.',
        '',
        'اگر جایی مبهم بود، قبل از حدس زدن از من بپرس.'
      ].join('\n'),
      elementor: [
        'می‌خواهم این صفحه را در المنتور بسازم (با Container، نه سکشن قدیمی). یک بلوک HTML سفارشی بزرگ ننویس.',
        '',
        'این‌ها را به من بده:',
        '۱. Global Colors و Global Fonts که باید ساخته شوند (از tokens.json)، با مقدار دقیق و اسم.',
        '۲. صفحه به‌صورت درخت Containerهای تو در تو برای هر سکشن: جهت، عرض‌ها، gap، padding و تراز – برای دسکتاپ، تبلت و موبایل.',
        '۳. برای هر المان بگو از کدام ویجت استفاده شود (Heading، Text Editor، Button، Image، Icon List، Nav Menu، Loop Grid، Tabs، Accordion و…) و تنظیماتش چه باشد.',
        '۴. حداقل CSS سفارشی، فقط برای کاری که ویجت‌ها نمی‌توانند، و با یک class اختصاصی.',
        '۵. رفتار hover / ورود / sticky که در report.md آمده را با Motion Effectهای المنتور پیاده کن.',
        '۶. مطابق اسکرین‌شات‌ها؛ جهت صفحه (RTL) را نگه دار و از متن‌های واقعی page.html استفاده کن.',
        '',
        'اگر ابزار Elementor MCP وصل است، به‌جای توضیح دادن مستقیم بسازش. اگر جایی مبهم بود اول بپرس.'
      ].join('\n')
    }
  };

  R.promptText = (tpl, lang) => {
    const L = PROMPTS[lang] || PROMPTS.en;
    return L.common + '\n' + (L[tpl] || L.html);
  };

  /* ------------------------------------------------------------------ small helpers */
  const list = (arr, fmt) => (arr && arr.length ? arr.map((x) => '- ' + (fmt ? fmt(x) : (Array.isArray(x) ? x[0] + '  (×' + Math.round(x[1]) + ')' : x))).join('\n') : '- (none)');
  const kb = (n) => (n / 1024 >= 1024 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
  R.kb = kb;
  const simple = (v) => typeof v === 'string' && !v.includes(',') && !v.includes(' ');
  const pxNum = (v) => parseFloat(v) || 0;

  /* ------------------------------------------------------------------ tokens */
  R.buildTokens = function (data) {
    const st = data.stats;
    const toObj = (a) => (a || []).map(([value, count]) => ({ value, count: Math.round(count) }));
    return {
      meta: {
        url: data.meta.url, title: data.meta.title, lang: data.meta.lang, dir: data.meta.dir,
        capturedAt: data.meta.capturedAt, scope: data.meta.scopeSelector, window: data.meta.windowSize
      },
      colors: {
        text: toObj(st.palette.text), background: toObj(st.palette.background),
        border: toObj(st.palette.border), accentGuess: toObj(st.palette.accent)
      },
      typography: {
        families: toObj(st.fontFamilies), weightsByFamily: st.fontWeightsByFamily,
        sizes: toObj(st.fontSizes), weights: toObj(st.fontWeights), lineHeights: toObj(st.lineHeights),
        persianFontsDetected: data.meta.persianFonts, elements: st.typo
      },
      radius: toObj(st.radius),
      shadows: toObj(st.shadows),
      spacingPx: st.spacing.map(([px, count]) => ({ px, count })),
      breakpoints: data.css.widthStats,
      cssVariables: data.css.resolved,
      motion: { transitions: toObj(st.transitions), animations: toObj(st.animations), fixedOrSticky: st.fixed }
    };
  };

  function themeGroups(data) {
    const st = data.stats;
    const uniq = (arr) => [...new Set(arr)];
    const col = (pairs, prefix, n) => {
      const out = {};
      uniq(pairs.map((p) => p[0])).slice(0, n).forEach((v, i) => { out[prefix + '-' + (i + 1)] = v; });
      return out;
    };
    const colors = Object.assign({},
      col(st.palette.text, 'ink', 6), col(st.palette.background, 'surface', 6),
      col(st.palette.border, 'line', 4), col(st.palette.accent, 'accent', 4));
    const sizes = {};
    st.fontSizes.map((f) => f[0]).filter((v) => /px$/.test(v)).sort((a, b) => pxNum(a) - pxNum(b))
      .forEach((v) => { sizes['fs-' + Math.round(pxNum(v))] = v; });
    const radius = {};
    uniq(st.radius.map((r) => r[0])).filter(simple).slice(0, 6).forEach((v) => { radius['r-' + Math.round(pxNum(v))] = v; });
    const shadows = {};
    st.shadows.slice(0, 4).forEach((s, i) => { shadows['sh-' + (i + 1)] = s[0]; });
    const screens = {};
    Object.keys(data.css.widthStats).filter((k) => k.startsWith('min:')).map((k) => Number(k.slice(4)))
      .filter((n) => n >= 320 && n <= 2200).sort((a, b) => a - b).slice(0, 6).forEach((n) => { screens['bp-' + n] = n + 'px'; });
    const fam = (st.fontFamilies[0] || ['system-ui'])[0];
    const font = '"' + fam + '", system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif';
    return { colors, sizes, radius, shadows, screens, font };
  }

  R.buildTailwindV4 = function (data) {
    const g = themeGroups(data);
    const lines = ['/* Generated by Dibino Lens from ' + data.meta.url + ' */', '@theme {', '  --font-sans: ' + g.font + ';'];
    Object.entries(g.colors).forEach(([k, v]) => lines.push('  --color-' + k + ': ' + v + ';'));
    Object.entries(g.sizes).forEach(([k, v]) => lines.push('  --text-' + k + ': ' + v + ';'));
    Object.entries(g.radius).forEach(([k, v]) => lines.push('  --radius-' + k + ': ' + v + ';'));
    Object.entries(g.shadows).forEach(([k, v]) => lines.push('  --shadow-' + k + ': ' + v + ';'));
    Object.entries(g.screens).forEach(([k, v]) => lines.push('  --breakpoint-' + k + ': ' + v + ';'));
    lines.push('}', '');
    return lines.join('\n');
  };

  R.buildTailwindV3 = function (data) {
    const g = themeGroups(data);
    const cfg = {
      colors: g.colors, fontFamily: { sans: g.font.split(',').map((s) => s.trim().replace(/^"|"$/g, '')) },
      fontSize: g.sizes, borderRadius: g.radius, boxShadow: g.shadows, screens: g.screens
    };
    return '// Generated by Dibino Lens from ' + data.meta.url + '\n// Paste into tailwind.config.js → theme.extend (Tailwind v3)\nmodule.exports = {\n  theme: {\n    extend: ' +
      JSON.stringify(cfg, null, 4).replace(/\n/g, '\n    ') + '\n  }\n};\n';
  };

  /* ------------------------------------------------------------------ report.md */
  R.buildReport = function (data, x) {
    const m = data.meta, st = data.stats, o = x.opts;
    const sectionsTable = data.sections.length
      ? data.sections.map((s) =>
        '| ' + s.slug + ' | ' + s.label.replace(/\|/g, '\\|') + ' | ' + Math.round(s.rect.w) + '×' + Math.round(s.rect.h) +
        ' | ' + (s.bg || '-') + ' | ' + (s.heading ? s.heading.replace(/\|/g, '\\|') : '-') + ' |').join('\n')
      : '| - | - | - | - | - |';

    const typo = Object.entries(st.typo).map(([k, v]) => k + ': ' + JSON.stringify(v)).join('\n');
    const vars = Object.entries(data.css.resolved).slice(0, 200).map(([k, v]) => k + ': ' + v + ';').join('\n');
    const frames = (x.frames || []).map((f) =>
      '### Layout outline – ' + f.width + 'px view (' + f.name + ')\n' + F + '\n' + (f.outline.length ? f.outline.join('\n') : '(empty)') + '\n' + F).join('\n\n');
    const assets = x.assetManifest && x.assetManifest.length
      ? x.assetManifest.map((a) => '- [' + a.status + '] ' + a.url + (a.file ? ' → ' + a.file : '')).join('\n') : '';

    return [
      '# Page design report',
      '',
      '## 1. Overview',
      '- URL: ' + m.url,
      '- Title: ' + m.title,
      '- Captured: ' + m.capturedAt,
      '- Scope: ' + (o.scope === 'pick' ? 'Element ' + m.scopeSelector : 'Full page'),
      '- CSS mode: ' + (o.cssUsed ? 'only rules that match the scope' : 'all rules'),
      '- Language: ' + (m.lang || '-') + ' | Direction: ' + (m.dir || '-'),
      '- Viewport meta: ' + (m.viewportMeta || '-'),
      '- Window: ' + m.windowSize + ' | Page: ' + m.pageSize,
      '- Generator: ' + (m.generator || '-') + (m.themeColor ? ' | theme-color: ' + m.themeColor : ''),
      '- Body class: ' + (m.bodyClass || '-'),
      '- Detected technology: ' + (data.libs.length ? data.libs.join(', ') : '-'),
      '- Persian fonts detected: ' + (m.persianFonts.length ? m.persianFonts.join(', ') : '-'),
      '- Privacy mode: ' + (o.privacy ? 'ON (texts replaced)' : 'off'),
      '',
      '## 2. Sections (top to bottom)',
      '| file | element | size | background | first heading |',
      '|---|---|---|---|---|',
      sectionsTable,
      '',
      '## 3. Layout outline',
      '### Desktop (' + m.windowSize + ')',
      F, data.outline.join('\n') || '(empty)', F,
      '',
      frames,
      '',
      '## 4. Design tokens',
      '### Fonts (most used first)', list(st.fontFamilies),
      '### Weights per family', list(Object.entries(st.fontWeightsByFamily), ([k, v]) => k + ': ' + v.join(', ')),
      '### Loaded @font-face', list(data.css.fontFaces, (f) => f.family + ' ' + f.weight + ' ' + f.style + (f.urls[0] ? ' – ' + f.urls[0] : '')),
      '### Font sizes', list(st.fontSizes),
      '### Line heights', list(st.lineHeights),
      '### Text colors', list(st.palette.text),
      '### Background colors', list(st.palette.background),
      '### Border colors', list(st.palette.border),
      '### Likely brand / accent colors', list(st.palette.accent),
      '### Border radius', list(st.radius),
      '### Box shadows', list(st.shadows),
      '### Spacing values in px (padding / margin / gap, ascending)', list(st.spacing, (p) => p[0] + 'px  (×' + p[1] + ')'),
      '### Key elements (computed)', F, typo, F,
      '### CSS variables (resolved)', F + 'css', vars || '(none)', F,
      '### Media-query breakpoints', list(data.css.breakpoints),
      '',
      '## 5. Interactions & motion',
      '- :hover rules in the CSS: ' + data.hoverRules,
      '- scroll-behavior: ' + (m.scrollBehavior || '-'),
      '### Fixed / sticky elements', list(st.fixed, (f) => f.el + ' | ' + f.position + ' | ' + f.size + ' | top:' + f.top + ' bottom:' + f.bottom + ' z:' + f.zIndex),
      '### Transitions in use', list(st.transitions),
      '### Animations in use', list(st.animations),
      '',
      '## 6. Images',
      list(data.images),
      '### CSS background images', list(st.bgImages),
      assets ? '### Downloaded assets\n' + assets : '',
      '',
      '## 7. Scripts loaded',
      list(data.scripts),
      '',
      '## 8. Notes',
      list(x.warnings && x.warnings.length ? x.warnings : ['No warnings.']),
      '',
      '## 9. How the files fit together',
      '- page.html – cleaned rendered DOM (' + kb(data.html.length) + ')',
      '- styles.css – CSS (' + kb(data.css.css.length) + ')',
      '- Screenshots are in screenshots/, one HTML + one image per section is in sections/.',
      ''
    ].join('\n');
  };

  /* ------------------------------------------------------------------ start-here + single-file */
  const DESCR = [
    [/^00-START-HERE/, 'this file: the prompt and a map of the package'],
    [/^report\.md$/, 'layout outline, design tokens, interactions, images, notes'],
    [/^page\.html$/, 'cleaned rendered HTML (scripts removed)'],
    [/^styles\.css$/, 'the CSS used by the page'],
    [/^tokens\.json$/, 'colors, fonts, sizes, radius, shadows, spacing, breakpoints'],
    [/^tailwind-theme\.css$/, 'tokens as Tailwind v4 @theme'],
    [/^tailwind\.config\.snippet\.js$/, 'tokens for Tailwind v3'],
    [/^screenshots\//, 'screenshots (desktop / mobile / tablet)'],
    [/^sections\/.*\.jpg$/, 'screenshot of one section'],
    [/^sections\/.*\.html$/, 'HTML of one section'],
    [/^assets\/svg\//, 'SVG files'],
    [/^assets\/images\//, 'downloaded images'],
    [/^assets\/fonts\//, 'downloaded font files (check their licences before reuse)'],
    [/^assets\/_manifest\.json$/, 'original URL → local file for every asset']
  ];

  R.buildStart = function (data, files, opts) {
    const lang = opts.lang;
    const prompt = R.promptText(opts.tpl, lang);
    const rows = [];
    const seen = new Set();
    if (opts.format === 'md') {
      rows.push('- Everything in this single file: report, tokens, page.html and styles.css (below).');
      rows.push('- The screenshots are the separate .jpg files downloaded next to it – upload them together with this file.');
    }
    for (const f of (opts.format === 'md' ? [] : files)) {
      const d = DESCR.find((x) => x[0].test(f.name));
      const key = d ? d[1] : f.name;
      if (seen.has(key)) continue;
      seen.add(key);
      const folder = f.name.includes('/') && /^(screenshots|sections|assets)\//.test(f.name) ? f.name.split('/')[0] + '/' : f.name;
      rows.push('- ' + folder + ' – ' + key);
    }
    return [
      '# Dibino Lens package – start here',
      '',
      '- Source: ' + data.meta.url,
      '- Captured: ' + data.meta.capturedAt,
      '',
      '## Prompt (give it to your AI together with these files)',
      '',
      F + 'text', prompt, F,
      '',
      '## What is in this package',
      rows.join('\n'),
      '',
      '_Made with Dibino Lens. Use it for designs that are yours or that you have permission to use._',
      ''
    ].join('\n');
  };

  R.buildSingleMarkdown = function (data, startMd, reportMd) {
    return [
      startMd, '', '---', '',
      reportMd, '', '---', '',
      '## page.html', '', FF + 'html', data.html, FF, '',
      '## styles.css', '', FF + 'css', data.css.css, FF, ''
    ].join('\n');
  };
})();
