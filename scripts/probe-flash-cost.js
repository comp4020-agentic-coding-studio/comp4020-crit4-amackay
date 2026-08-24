// One-off browser probe (agent-browser eval): what lighting and restriking a
// pitch class costs on the lit layer's one path.
//
// The comparison this exists to record: on the same page, when a pitch class
// was ~121 separate cap elements, the same operations measured 0.7 ms to light
// and 6-7 ms to restrike, and both were priced by how many caps the zoom
// happened to show. That is why the lit layer exists (DESIGN.md "The lit
// layer"); the caps it replaced are gone, so the second column cannot be
// re-measured here — recover it from the tree at commit 2908732 if it ever
// needs re-deriving.
(() => {
  const surface = document.querySelector("[data-instrument]");
  const PC = 4;
  const path = surface.querySelector(`.lit [data-pc="${PC}"]`);
  const caps = (path.getAttribute("d").match(/z/g) ?? []).length;

  const kf = [{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }];
  const opts = { duration: 220, easing: "ease-out", id: "restrike" };
  const restrike = (el) => {
    for (const running of el.getAnimations()) if (running.id === "restrike") running.cancel();
    el.animate(kf, opts);
  };

  // getComputedStyle forces the style recalc the class write schedules, so the
  // timing covers what the browser actually has to do, not just the JS call.
  const time = (fn) => {
    const t = performance.now();
    fn();
    getComputedStyle(path).fill;
    return +(performance.now() - t).toFixed(2);
  };

  const out = { pc: PC, name: path.dataset.name, hexagonsInPath: caps };
  out.litOn = time(() => path.classList.add("active"));
  out.litOff = time(() => path.classList.remove("active"));
  out.flash = time(() => restrike(path));
  out.flashAgain = time(() => restrike(path));
  for (const a of path.getAnimations()) a.cancel();
  return out;
})();
