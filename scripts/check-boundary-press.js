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

  // The cell nearest the camera centre, so the whole edge has real neighbours
  // at any zoom stop. CENTRE_X/CENTRE_Y are (10.5, 16.5); pos(2, 4) is (10, 18).
  const [m, n] = [2, 4];
  // pos(m, n) = (3n - m, 3(m + n)), lattice coords, y up. Evaluated, not
  // quoted: this file carried the transposed pair until 2026-08-24, which
  // agreed with a transposed comment and with nothing else.
  const [ox, oy] = [3 * n - m, 3 * (m + n)];

  // HEX[0]-HEX[1]: the minor-third boundary. Lattice coords, y up.
  const [a, b] = [[2.5, 1], [0.5, 2]];
  const toClient = ([x, y]) => [
    rect.left + (x - box.x) * perTwelfth,
    rect.top + (-y - box.y) * perTwelfth,
  ];

  const soundingCount = () => new Set(
    [...surface.querySelectorAll(".lit .active")].map((c) => c.dataset.pc),
  ).size;

  // Async, and 120 ms between presses: the lit class has an 80 ms floor
  // (DESIGN.md "Visual design"), so back-to-back presses would count the
  // previous one as still sounding and every reading would come out high.
  const run = async () => {
    const out = [];
    for (const t of [0.05, 0.15, 0.35, 0.5, 0.65, 0.85, 0.95]) {
      const point = [ox + a[0] + t * (b[0] - a[0]), oy + a[1] + t * (b[1] - a[1])];
      const [cx, cy] = toClient(point);
      const target = document.elementFromPoint(cx, cy);
      const opts = { pointerId: 1, pointerType: "mouse", clientX: cx, clientY: cy, bubbles: true, isPrimary: true };
      target.dispatchEvent(new PointerEvent("pointerdown", opts));
      out.push(`t=${t} -> ${soundingCount()}`);
      target.dispatchEvent(new PointerEvent("pointerup", opts));
      await new Promise((r) => setTimeout(r, 120));
    }
    return JSON.stringify(out);
  };
  return run();
})();
