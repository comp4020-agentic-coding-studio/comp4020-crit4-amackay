// One-off: read the page's actual rendered layout — which caps' polygons sit
// inside the fundamental-domain rect, by screen position, grouped into rows,
// plus which of them carry a key hint.
(() => {
  const dom = document.querySelector('.debug-fundamental-domain').getBoundingClientRect();
  const fit = document.querySelector('.debug-fit-window').getBoundingClientRect();
  const inside = [];
  for (const cap of document.querySelectorAll('.cap')) {
    const p = cap.querySelector('polygon').getBoundingClientRect();
    const cx = p.left + p.width / 2, cy = p.top + p.height / 2;
    if (cx > dom.left && cx < dom.right && cy > dom.top && cy < dom.bottom)
      inside.push({ name: cap.querySelector('text.name').textContent.trim(),
                    key: cap.querySelector('text.key')?.textContent.trim() ?? null,
                    m: cap.dataset.m, n: cap.dataset.n, cx, cy });
  }
  const rows = {};
  for (const c of inside) { const k = Math.round(c.cy); (rows[k] ||= []).push(c); }
  const out = Object.keys(rows).map(Number).sort((a, b) => a - b)
    .map(k => rows[k].sort((a, b) => a.cx - b.cx)
      .map(c => `${c.key ?? '-'}:${c.name}`).join('  '));
  return JSON.stringify({
    inDomain: inside.length,
    hintsOnPage: document.querySelectorAll('.cap text.key').length,
    capsOnPage: document.querySelectorAll('.cap').length,
    domainCentre: [dom.left + dom.width / 2, dom.top + dom.height / 2].map(Math.round),
    fitCentre: [fit.left + fit.width / 2, fit.top + fit.height / 2].map(Math.round),
    rows: out }, null, 1);
})()
