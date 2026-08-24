// One-off browser probe (agent-browser eval): where does a pitch class stop
// answering the pointer? The lit layer's twelve paths are the hit test now —
// each hexagon a disjoint subpath — so the press boundary is the hexagon
// itself, with nothing clipping it into shape. This binary-searches, via
// elementFromPoint, where a path stops being the topmost element along a ray
// from one of its cap centres, and compares that against the hexagon.
//
// Expected, from HEX in src/lib/tonnetz.ts, in screen twelfths (y down):
//   +x  -> 2         (a flat edge)
//   +y  -> 1.75      (a flat edge)
//   toward the vertex at screen (2.5, -1) -> sqrt(7.25) ~= 2.6926
//
// Those numbers are evaluated from the geometry, not quoted from a comment:
// this file's ancestor carried the pre-reorientation pair (7/4 and sqrt(4.25))
// alongside a transposed centre formula, and the two agreed with each other
// while both disagreed with pos().
(() => {
  const surface = document.querySelector("[data-instrument]");
  const svg = surface.querySelector("svg");
  const rect = svg.getBoundingClientRect();
  const box = svg.viewBox.baseVal;
  const perTwelfth = rect.width / box.width;

  // pos(m, n) = (3n - m, 3(m + n)) in twelfths, y up; the drawing negates y.
  const centre = (m, n) => [3 * n - m, -(3 * (m + n))];
  const toClient = ([x, y]) => [rect.left + (x - box.x) * perTwelfth, rect.top + (y - box.y) * perTwelfth];
  const pathAt = (point) => document.elementFromPoint(...toClient(point))?.closest("[data-pc]");

  // The cell nearest the camera centre, so every ray has a real neighbour at
  // any zoom stop. CENTRE_X/CENTRE_Y are (10.5, 16.5); pos(2, 4) is (10, 18).
  const [m, n] = [2, 4];
  const [ox, oy] = centre(m, n);
  const path = pathAt([ox, oy]);

  const edgeAlong = (dir) => {
    const at = (t) => pathAt([ox + dir[0] * t, oy + dir[1] * t]) === path;
    let [lo, hi] = [0, 4];
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  const vertex = [2.5, -1];
  const len = Math.hypot(vertex[0], vertex[1]);
  return JSON.stringify({
    cell: [m, n],
    pc: path?.dataset.pc,
    name: path?.dataset.name,
    alongX: edgeAlong([1, 0]).toFixed(4),
    alongY: edgeAlong([0, 1]).toFixed(4),
    towardVertex: edgeAlong([vertex[0] / len, vertex[1] / len]).toFixed(4),
    expected: { alongX: "2.0000", alongY: "1.7500", towardVertex: Math.sqrt(7.25).toFixed(4) },
  });
})();
