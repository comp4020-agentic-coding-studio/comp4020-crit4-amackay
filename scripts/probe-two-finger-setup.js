// Page-side half of probe-two-finger-tap.mjs: finds a triad corner (where
// three caps meet, so one touch presses three notes) in client coordinates,
// and starts logging .active class changes and frame times against __t0.
(() => {
  const surface = document.querySelector("[data-instrument]");
  const svg = surface.querySelector("svg");
  const rect = svg.getBoundingClientRect();
  const box = svg.viewBox.baseVal;

  const toClient = (lx, ly) => [
    rect.left + ((lx - box.x) / box.width) * rect.width,
    rect.top + ((-ly - box.y) / box.height) * rect.height,
  ];

  // The cap under the middle of the screen, and its lattice node.
  const mid = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  const cap = mid.closest("[data-m]");
  const m = Number(cap.dataset.m);
  const n = Number(cap.dataset.n);
  const node = [3 * n - m, 3 * (m + n)];
  // DESIGN.md: minor triad spot = node + (1, 2) — the corner three caps share.
  const corner = [node[0] + 1, node[1] + 2];

  const [ax, ay] = toClient(corner[0], corner[1]);

  // On-screen caps only, so the log stays readable.
  const onScreen = new Set(
    [...surface.querySelectorAll("[data-m]")].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
    }),
  );

  window.__t0 = performance.now();
  window.__log = [];
  const at = () => +(performance.now() - window.__t0).toFixed(1);

  new MutationObserver((records) => {
    for (const r of records) {
      if (!onScreen.has(r.target)) continue;
      const active = r.target.classList.contains("active");
      window.__log.push({ t: at(), kind: active ? "lit" : "unlit", pc: r.target.dataset.pc });
    }
  }).observe(surface, { subtree: true, attributes: true, attributeFilter: ["class"] });

  for (const type of ["pointerdown", "pointerup", "pointercancel"]) {
    window.addEventListener(type, (e) => window.__log.push({ t: at(), kind: type, id: e.pointerId }), true);
  }

  const frames = [];
  let last = performance.now();
  const tick = (now) => {
    frames.push(+(now - last).toFixed(1));
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Collapse the 121 caps of one pitch class into one line each.
  window.__report = () => {
    const seen = new Set();
    const events = [];
    for (const e of window.__log) {
      const key = `${e.kind}:${e.pc ?? e.id}`;
      if (e.pc !== undefined) {
        if (seen.has(key + e.t)) continue;
        seen.add(key + e.t);
      }
      events.push(e);
    }
    return { events, worstFrames: frames.slice().sort((a, b) => b - a).slice(0, 5) };
  };

  return { ax: Math.round(ax), ay: Math.round(ay), bx: Math.round(ax) + 2, by: Math.round(ay) + 2, m, n, pc: cap.dataset.pc };
})();
