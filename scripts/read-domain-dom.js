// One-off: read the debug page's actual rendered layout — which caps' polygons
// sit inside the orange domain rect, by screen position, grouped into rows.
(() => {
  const dom = document.querySelector('.debug-fundamental-domain').getBoundingClientRect();
  const inside = [];
  for (const cap of document.querySelectorAll('.cap')) {
    const p = cap.querySelector('polygon').getBoundingClientRect();
    const cx = p.left + p.width / 2, cy = p.top + p.height / 2;
    if (cx > dom.left && cx < dom.right && cy > dom.top && cy < dom.bottom)
      inside.push({ name: cap.querySelector('text.name').textContent.trim(),
                    m: cap.dataset.m, n: cap.dataset.n, cx, cy });
  }
  const rows = {};
  for (const c of inside) { const k = Math.round(c.cy); (rows[k] ||= []).push(c); }
  const out = Object.keys(rows).map(Number).sort((a, b) => a - b)
    .map(k => rows[k].sort((a, b) => a.cx - b.cx)
      .map(c => `${c.name}(${c.m},${c.n})`).join('  '));
  return JSON.stringify({ count: inside.length,
    domain: [dom.left, dom.top, dom.width, dom.height].map(Math.round), rows: out }, null, 1);
})()
