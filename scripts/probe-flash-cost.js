// One-off browser probe (agent-browser eval): what lighting and restriking a
// pitch class costs on the lit layer's one path, against what it cost on that
// pitch class's ~121 separate caps. The second column is why the lit layer
// exists; keeping both measurements here keeps the comparison reproducible.
(() => {
  const surface = document.querySelector("[data-instrument]");
  const PC = 4;
  const path = surface.querySelector(`.lit [data-pc="${PC}"]`);
  const polys = [...surface.querySelectorAll(`.cap[data-pc="${PC}"] polygon`)];

  const kf = [{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }];
  const opts = { duration: 220, easing: "ease-out", id: "restrike" };
  const restrike = (el) => {
    for (const running of el.getAnimations()) if (running.id === "restrike") running.cancel();
    el.animate(kf, opts);
  };

  // getComputedStyle forces the style recalc the class write schedules, so the
  // timing covers what the browser actually has to do, not just the JS call.
  const time = (fn, el) => {
    const t = performance.now();
    fn();
    getComputedStyle(el).fill;
    return +(performance.now() - t).toFixed(2);
  };

  const out = { pc: PC, caps: polys.length };

  out.litLayerOn = time(() => path.classList.add("active"), path);
  out.litLayerOff = time(() => path.classList.remove("active"), path);
  out.litLayerFlash = time(() => restrike(path), path);
  out.litLayerFlashAgain = time(() => restrike(path), path);

  // The old shape, measured on the same page: every cap of the pitch class.
  out.perCapOn = time(() => polys.forEach((p) => p.parentElement.classList.add("active")), polys[0]);
  out.perCapOff = time(() => polys.forEach((p) => p.parentElement.classList.remove("active")), polys[0]);
  out.perCapFlash = time(() => polys.forEach(restrike), polys[0]);
  out.perCapFlashAgain = time(() => polys.forEach(restrike), polys[0]);

  for (const p of polys) for (const a of p.getAnimations()) a.cancel();
  return out;
})();
