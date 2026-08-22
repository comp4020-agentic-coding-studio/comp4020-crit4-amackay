// One-off browser probe (agent-browser eval): walks t along one m3 button
// boundary in the live page and counts distinct sounding pitch classes, to
// confirm the 25/50/25 triad/dyad/triad split of
// tonnetz-equilateral-patch.md reaches the real coordinate hit-test path,
// not just the unit tests.
(() => {
  const surface = document.querySelector("[data-instrument]");
  const svg = surface.querySelector("svg");
  const rect = svg.getBoundingClientRect();
  const box = svg.viewBox.baseVal;
  const perTwelfth = rect.width / box.width;

  // A cap well inside the viewport, so the whole edge has real neighbours.
  const cap = [...surface.querySelectorAll("[data-m]")].find((c) => {
    const r = c.getBoundingClientRect();
    return r.left > 200 && r.top > 200 && r.right < window.innerWidth - 200 && r.bottom < window.innerHeight - 200;
  });
  const [m, n] = [Number(cap.dataset.m), Number(cap.dataset.n)];
  const [ox, oy] = [3 * (m + n), 3 * n - m];

  // HEX[0]-HEX[1]: the minor-third boundary. Lattice coords, y up.
  const [a, b] = [[2, 0.5], [1, 2.5]];
  const toClient = ([x, y]) => [
    rect.left + (x - box.x) * perTwelfth,
    rect.top + (-y - box.y) * perTwelfth,
  ];

  const soundingCount = () => new Set(
    [...surface.querySelectorAll(".cap.active")].map((c) => c.dataset.pc),
  ).size;

  const out = [];
  for (const t of [0.05, 0.15, 0.35, 0.5, 0.65, 0.85, 0.95]) {
    const point = [ox + a[0] + t * (b[0] - a[0]), oy + a[1] + t * (b[1] - a[1])];
    const [cx, cy] = toClient(point);
    const target = document.elementFromPoint(cx, cy);
    const opts = { pointerId: 1, pointerType: "mouse", clientX: cx, clientY: cy, bubbles: true, isPrimary: true };
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    out.push(`t=${t} -> ${soundingCount()}`);
    target.dispatchEvent(new PointerEvent("pointerup", opts));
  }
  return JSON.stringify(out);
})();
