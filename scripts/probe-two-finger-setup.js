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

  // The cell nearest the camera centre, so it is on screen at any zoom stop.
  // CENTRE_X/CENTRE_Y are (10.5, 16.5); pos(2, 4) is (10, 18). Hard-coded
  // because the lit layer hit-tests to a pitch class, not a cell — there is no
  // element left to read data-m off.
  const [m, n] = [2, 4];
  const node = [3 * n - m, 3 * (m + n)];
  // DESIGN.md: minor triad spot = node + (1, 2) — the corner three caps share.
  const corner = [node[0] + 1, node[1] + 2];

  const [ax, ay] = toClient(corner[0], corner[1]);

  // The lit layer is twelve elements, so the observer watches those rather
  // than every cap on screen — which also stops the probe distorting what it
  // measures: observing 1474 elements was itself part of the old cost.
  const lit = surface.querySelector(".lit");

  window.__t0 = performance.now();
  window.__log = [];
  const at = () => +(performance.now() - window.__t0).toFixed(1);

  new MutationObserver((records) => {
    for (const r of records) {
      const active = r.target.classList.contains("active");
      window.__log.push({ t: at(), kind: active ? "lit" : "unlit", pc: r.target.dataset.pc });
    }
  }).observe(lit, { subtree: true, attributes: true, attributeFilter: ["class"] });

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

  return { ax: Math.round(ax), ay: Math.round(ay), bx: Math.round(ax) + 2, by: Math.round(ay) + 2, m, n };
})();
