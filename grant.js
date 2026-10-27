const S = {
  en: {
    t: 'Allow access to these files?',
    d: 'Some CSS, image or font files of this page are hosted on other domains, so the page itself is not allowed to read them. Dibino Lens only needs to download them once, into your ZIP.',
    ok: 'Allow', no: 'Cancel',
    n: 'You can revoke this any time from chrome://extensions → Dibino Lens → Details → Site access.'
  },
  fa: {
    t: 'اجازه‌ی دسترسی به این فایل‌ها؟',
    d: 'بعضی فایل‌های CSS، تصویر یا فونت این صفحه روی دامنه‌های دیگر هستند و خود صفحه اجازه‌ی خواندنشان را نمی‌دهد. دیبینو لنز فقط یک‌بار آن‌ها را برای ساختن فایل ZIP دانلود می‌کند.',
    ok: 'اجازه می‌دهم', no: 'انصراف',
    n: 'هر زمان بخواهید از chrome://extensions ← دیبینو لنز ← Details ← Site access می‌توانید دسترسی را پس بگیرید.'
  }
};
(async () => {
  const p = new URLSearchParams(location.search);
  const tabId = Number(p.get('tab'));
  let origins = [];
  try { origins = JSON.parse(p.get('o') || '[]'); } catch (e) { /* ignore */ }
  let lang = (chrome.i18n.getUILanguage() || 'en').toLowerCase().startsWith('fa') ? 'fa' : 'en';
  try {
    const st = await chrome.storage.local.get('lang');
    if (st.lang === 'fa' || st.lang === 'en') lang = st.lang;
  } catch (e) { /* ignore */ }
  const t = S[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.getElementById('t').textContent = t.t;
  document.getElementById('d').textContent = t.d;
  document.getElementById('ok').textContent = t.ok;
  document.getElementById('no').textContent = t.no;
  document.getElementById('n').textContent = t.n;
  const ul = document.getElementById('l');
  origins.forEach((o) => { const li = document.createElement('li'); li.textContent = o.replace('/*', ''); ul.appendChild(li); });
  document.getElementById('no').onclick = () => window.close();
  document.getElementById('ok').onclick = async () => {
    let granted = false;
    try { granted = await chrome.permissions.request({ origins }); } catch (e) { /* ignore */ }
    if (granted) { try { await chrome.tabs.sendMessage(tabId, { type: 'perm-granted' }); } catch (e) { /* tab gone */ } }
    window.close();
  };
})();
