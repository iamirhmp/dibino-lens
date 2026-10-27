# Privacy Policy – Dibino Lens

_Last updated: 27 October 2026_

**Short version: Dibino does not receive, collect or sell any data. Processing happens on your computer. The file the extension creates contains the content of the page you analysed – what you do with it (for example uploading it to an AI service) is up to you.**

## What the extension does with a page

When you click **Extract & download**, the extension reads the page you are on (its HTML, CSS, computed styles and a screenshot of the visible tab), builds a ZIP/Markdown file in your browser's memory and hands it to your browser's normal download mechanism. The file goes to your Downloads folder. That is all.

- No data is sent to Dibino or to any server we operate. We do not operate any server for this extension.
- No analytics, telemetry, crash reporting, advertising or tracking of any kind.
- No remote code: all JavaScript ships inside the extension package.
- No accounts and no sign-in.

## What is stored on your device

The extension uses `chrome.storage.local` only to remember your **interface language** and your **checkbox / template choices**. Nothing else is stored, and nothing is synced.

## Network requests

The extension makes network requests only when you ask it to produce a package, and only to download files that the page you are analysing itself references (its CSS files, and – if you ticked those options – its images, SVGs and fonts). Those requests go straight from your browser to the website that hosts the files, exactly like loading the page. If a page hosts files on another domain, the extension asks for your permission for that specific domain before fetching them; you can revoke it at any time in `chrome://extensions`.

For the mobile and tablet views, the extension loads the page you are on once more inside a sandboxed frame in the same tab. That is a normal request to the same site and may be counted by that site's own analytics.

## Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Work on the current tab after you click the icon. |
| `scripting` | Inject the panel and the analysis code into that tab. |
| `storage` | Remember language and options. |
| optional host permissions | Read CSS / images / fonts hosted on other domains – only after you approve each domain. |

## Privacy mode

_Privacy mode is a convenience, not a guarantee of anonymity._ 
If you enable **Privacy mode**, texts, numbers and form values on the page are temporarily replaced with placeholders before the extraction and the screenshots, and restored right after. It does not change images, link addresses or image URLs, and it removes only the query string from the page URL. Review the package before sharing it.

## Your responsibility

The package contains whatever the page contains (including, on pages behind a login, personal or private content that is visible to you). Hidden-field and password values are not exported, but review the package before sharing it. Use the extension only on pages and designs you are entitled to analyse.

## Children

The extension is a developer tool and is not directed at children.

## Changes

If this policy changes, the new version will be published in this repository with a new date.

## Contact

Dibino – https://dibino.tech
