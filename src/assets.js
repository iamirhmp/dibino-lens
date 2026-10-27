/* Dibino Lens – optional download of images / SVG / fonts into the package */
(() => {
  const DL = (globalThis.DL = globalThis.DL || {});
  const A = (DL.assets = {});

  const EXT_BY_TYPE = {
    'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif',
    'image/gif': 'gif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
    'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf',
    'application/font-woff2': 'woff2', 'application/font-woff': 'woff', 'application/x-font-ttf': 'ttf'
  };
  const FOLDER = { image: 'images', svg: 'svg', font: 'fonts' };

  function nameFor(item, i, type) {
    let base = 'file', ext = '';
    try {
      const p = new URL(item.url).pathname;
      const last = decodeURIComponent(p.split('/').filter(Boolean).pop() || 'file');
      const m = last.match(/^(.*?)(?:\.([a-z0-9]{2,5}))?$/i);
      base = (m[1] || 'file').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'file';
      ext = (m[2] || '').toLowerCase();
    } catch (e) { /* keep defaults */ }
    const t = String(type || '').split(';')[0].trim().toLowerCase();
    if (!ext || ext.length > 5) ext = EXT_BY_TYPE[t] || (item.kind === 'font' ? 'woff2' : 'bin');
    return (FOLDER[item.kind] || 'other') + '/' + String(i + 1).padStart(3, '0') + '-' + base + '.' + ext;
  }

  A.download = async function (list, opt) {
    const { fetchResource, onProgress, isCancelled } = opt;
    const maxFiles = opt.maxFiles || 60, maxTotal = opt.maxTotal || 25e6, maxEach = opt.maxEach || 6e6;
    const queue = list.slice(0, maxFiles);
    const files = [], manifest = [];
    let total = 0, idx = 0, done = 0;

    async function worker() {
      while (idx < queue.length) {
        if (isCancelled && isCancelled()) return;
        const i = idx++;
        const item = queue[i];
        const entry = { url: item.url, kind: item.kind, note: item.note, status: 'failed' };
        try {
          const r = await fetchResource(item.url, { maxBytes: maxEach });
          if (r && r.ok && r.data) {
            if (total + r.data.length > maxTotal) { entry.status = 'skipped (size limit)'; }
            else {
              total += r.data.length;
              const name = nameFor(item, i, r.type);
              files.push({ name: 'assets/' + name, data: r.data, store: true });
              entry.file = 'assets/' + name; entry.status = 'ok'; entry.bytes = r.data.length;
            }
          } else entry.status = 'failed (' + ((r && r.reason) || 'error') + ')';
        } catch (e) { entry.status = 'failed (error)'; }
        manifest[i] = entry;
        done++;
        if (onProgress) onProgress(done, queue.length);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    for (const it of list.slice(maxFiles)) manifest.push({ url: it.url, kind: it.kind, note: it.note, status: 'skipped (file limit)' });
    return { files, manifest, totalBytes: total };
  };
})();
