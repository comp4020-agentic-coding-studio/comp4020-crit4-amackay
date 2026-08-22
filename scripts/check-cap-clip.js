// One-off browser probe (agent-browser eval) for "effects stay inside the
// cap": binary-searches, via elementFromPoint (which respects clip-path),
// where each cap stops answering along a ray from its centre, and compares
// that against the hexagon's own geometry. Without the clip — or with the
// clip but no fill-box — the boundary sits on the stroke's outer edge and
// moves when stroke-width does.
(() => {
  const surface = document.querySelector("[data-instrument]");
  const svg = surface.querySelector("svg");
  const rect = svg.getBoundingClientRect();
  const box = svg.viewBox.baseVal;
  const perTwelfth = rect.width / box.width;

  // Cap centres are (3(m+n), 3n-m) in twelfths, y negated for the screen.
  const centre = (cap) => {
    const [m, n] = [Number(cap.dataset.m), Number(cap.dataset.n)];
    return [3 * (m + n), -(3 * n - m)];
  };
  const toClient = ([x, y]) => [rect.left + (x - box.x) * perTwelfth, rect.top + (y - box.y) * perTwelfth];
  const capAt = (point) => document.elementFromPoint(...toClient(point))?.closest("[data-m]");

  // Distance in twelfths, along `dir` from `cap`'s centre, at which the cap
  // stops being the topmost element.
  const edgeAlong = (cap, dir) => {
    const [ox, oy] = centre(cap);
    const at = (t) => capAt([ox + dir[0] * t, oy + dir[1] * t]) === cap;
    let [lo, hi] = [0, 3];
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  // A cap well inside the viewport, so every ray has a real neighbour.
  const cap = [...surface.querySelectorAll("[data-m]")].find((c) => {
    const r = c.getBoundingClientRect();
    return r.left > 80 && r.top > 80 && r.right < window.innerWidth - 80 && r.bottom < window.innerHeight - 80;
  });

  // +x crosses a flat edge at 7/4; the vertex at screen (2,-0.5) is at sqrt(4.25).
  return JSON.stringify({
    cell: [cap.dataset.m, cap.dataset.n],
    alongX: edgeAlong(cap, [1, 0]).toFixed(4),
    expectedX: (7 / 4).toFixed(4),
    alongY: edgeAlong(cap, [0, 1]).toFixed(4),
    expectedY: (2).toFixed(4),
    towardVertex: edgeAlong(cap, [2 / Math.sqrt(4.25), -0.5 / Math.sqrt(4.25)]).toFixed(4),
    expectedVertex: Math.sqrt(4.25).toFixed(4),
  });
})();
