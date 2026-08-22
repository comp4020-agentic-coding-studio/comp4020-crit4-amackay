// One-off: count the caps actually on screen, separating those strictly inside
// the viewport from those whose centre lands exactly on its edge (half-caps).
(() => {
  const rows = new Map();
  let inside = 0, onEdge = 0, keyed = 0;
  for (const cap of document.querySelectorAll('.cap')) {
    const p = cap.querySelector('polygon').getBoundingClientRect();
    const x = p.left + p.width / 2, y = p.top + p.height / 2;
    const eps = 0.75;
    if (x < -eps || x > innerWidth + eps || y < -eps || y > innerHeight + eps) continue;
    const edge = x < eps || x > innerWidth - eps || y < eps || y > innerHeight - eps;
    edge ? onEdge++ : inside++;
    if (cap.dataset.note) keyed++;
    const k = Math.round(y);
    rows.set(k, (rows.get(k) ?? 0) + 1);
  }
  return JSON.stringify({
    viewport: [innerWidth, innerHeight],
    twelfthPx: +(document.querySelector('.debug-fit-window').getBoundingClientRect().width / 15).toFixed(1),
    strictlyInside: inside, centreOnEdge: onEdge, total: inside + onEdge, keyed,
    rowsTopToBottom: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([y, n]) => `y=${y}:${n}`),
  });
})()
