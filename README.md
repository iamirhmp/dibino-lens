# Dibino Lens

**Turn any web page into a clean package your AI can rebuild.**

Dibino Lens is a Chrome extension that captures what an AI assistant (Claude, ChatGPT, Cursor, v0…) needs to recreate a page design accurately: the *rendered* HTML, the CSS the page really uses, design tokens, section-by-section screenshots and a ready-to-paste prompt – all in one ZIP.

Made by [Dibino](https://dibino.tech) · RTL / Persian friendly · Free for everyone

---

## Why

Copy-pasting "View source" into an AI gives poor results: it is the raw HTML (not what the browser actually rendered), the CSS is scattered over dozens of files, and the AI cannot *see* the page. Dibino Lens fixes all three with one click.

## What you get

```
dibino-lens_example-com_20261027-0912.zip
├── 00-START-HERE.md             ← the prompt + a map of the package
├── report.md                    ← layout outline, tokens, interactions, images, notes
├── page.html                    ← cleaned rendered DOM (scripts removed, lazy images resolved)
├── styles.css                   ← only the CSS rules the page/selection really uses
├── tokens.json                  ← colours, fonts, type scale, radius, shadows, spacing, breakpoints
├── tailwind-theme.css           ← the same tokens as a Tailwind v4 @theme block
├── tailwind.config.snippet.js   ← … and for Tailwind v3
├── screenshots/
│   ├── desktop-full.jpg
│   ├── mobile-390.jpg
│   └── tablet-768.jpg
├── sections/                    ← one screenshot + one HTML file per section
└── assets/                      ← images, SVGs (and optionally fonts) + a manifest
```

## Features

- **Visual element picker** – hover, click, done. Or capture the full page.
- **Per-section screenshots + HTML** – the AI works section by section instead of drowning in one giant page.
- **Real mobile and tablet views** – the page is rendered at 390 px / 768 px, so you get its real responsive layout.
- **Only the CSS that matters** – unused rules are filtered out; relative `url()`s are made absolute.
- **Design tokens** – colours (with a guess at the brand colour), fonts, sizes, spacing, radius, shadows, breakpoints, CSS variables, Persian-font detection.
- **Interactions** – hover rules, transitions, animations and fixed/sticky elements are listed.
- **Prompt templates** – plain HTML/CSS, Tailwind, React + Tailwind, Elementor (English or Persian).
- **Privacy mode** – replaces visible texts, long numbers (4+ digits) and form values with placeholders (in the files *and* in the screenshots), and removes the query string from the page URL. It does **not** change images, link addresses or image URLs, so always review the package before sharing it.
- **Fa / En interface** with full RTL support.
- **No debugger bar, no Dibino servers, no accounts.** Processing happens on your device.

## Install

**From the Chrome Web Store:** search for *Dibino Lens* (link will be added after publishing).

**From source (developer mode):**

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and choose this folder.
4. Pin the extension (puzzle icon → pin) for one-click access.

## Use

1. Open the page you want to analyse and click the **Dibino Lens** icon.
2. Choose **Full page**, or **Pick element** and click the part you want.
3. Tick what you need, choose a prompt template, press **Extract & download**.
4. Keep the tab open while it works – the page scrolls by itself to take the screenshots.
5. Upload the ZIP to your AI and paste the prompt from `00-START-HERE.md` (or use **Copy prompt** in the panel).

> Tip: for long pages, extract section by section with **Pick element**. You get better results and smaller files.

## Permissions – and why

| Permission | Why |
|---|---|
| `activeTab` | Lets the extension work on the tab you clicked it on, only after you click. |
| `scripting` | Injects the panel and the analysis code into that tab. |
| `storage` | Remembers your language and checkbox choices. |
| optional host access | Only requested if you press **Allow access** to read CSS / images / fonts that the page hosts on *other* domains (CDNs). You choose, per domain, and can revoke it at any time. |

No `debugger`, no `tabs`, no `downloads`, no analytics, no remote code. (The optional host access above is *optional*: nothing is granted until you approve a domain.)

## Limitations

- Chrome-internal pages, the Chrome Web Store and PDF viewers cannot be analysed (a browser restriction).
- Screenshots are cut at 16 000 px (full page) / 9 000 px (mobile). Use **Pick element** for the rest.
- The mobile and tablet views load the same page once inside a sandboxed frame. Sites that forbid framing (`X-Frame-Options: DENY`) cannot be rendered this way; the report says so.
- Chrome allows about two screenshots per second, so very long pages take a little while.
- Canvas/WebGL, videos and cross-origin iframes appear in the screenshots but not in the HTML/CSS (their content is not readable).
- Scroll-hijacking sites (full-page scroll libraries) may stitch imperfectly; use **Pick element** there.

## Please use it responsibly

Use Dibino Lens to learn from designs and to rebuild designs that are yours or that you have permission to use. Fonts, images, text and code on websites are protected by their authors' rights; do not republish other people's work as your own.

## Privacy

Dibino receives nothing: no data is sent to us or to any server we run. The extension only talks to the website you are analysing (to load its own files). The package it creates stays on your computer until *you* upload it somewhere, such as an AI tool. See [PRIVACY.md](PRIVACY.md).

## Development

No build step – plain JavaScript (Manifest V3).

```
background.js        service worker: injection, screenshots, optional cross-origin fetch
grant.html / .js     the small page that asks for per-domain access
src/i18n.js          UI strings (fa / en)
src/ui.js            floating panel + element picker (Shadow DOM)
src/extract.js       CSS, HTML, tokens, outline, sections
src/capture.js       scroll-and-stitch screenshots, responsive frame
src/assets.js        optional image / SVG / font download
src/report.js        report.md, tokens, Tailwind files, prompts
src/zip.js           dependency-free ZIP writer
src/privacy.js       text anonymiser
src/main.js          orchestrator
```

## License

Free to use. © Dibino
