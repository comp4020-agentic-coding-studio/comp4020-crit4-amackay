// One-off: is the whole closed plate the click target, or just the glyphs?
// Hit-tests the plate's four corners and its centre.
(() => {
  const panel = document.querySelector("[data-about]");
  const toggle = document.querySelector("[data-about-toggle]");
  const box = panel.getBoundingClientRect();
  const inset = 3;
  const points = {
    topLeft: [box.left + inset, box.top + inset],
    topRight: [box.right - inset, box.top + inset],
    bottomLeft: [box.left + inset, box.bottom - inset],
    bottomRight: [box.right - inset, box.bottom - inset],
    centre: [box.left + box.width / 2, box.top + box.height / 2],
  };
  const out = { plate: { w: Math.round(box.width), h: Math.round(box.height) } };
  for (const [name, [x, y]] of Object.entries(points)) {
    const hit = document.elementFromPoint(x, y);
    out[name] = hit === toggle || toggle.contains(hit) ? "toggle" : (hit?.tagName ?? "none").toLowerCase();
  }
  return out;
})();
