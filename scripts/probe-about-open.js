// One-off: what rect does the plate->card transition actually start from?
// Samples the panel's used width/height across the first frames of the open.
(async () => {
  const panel = document.querySelector("[data-about]");
  const toggle = document.querySelector("[data-about-toggle]");
  const frame = () => new Promise(requestAnimationFrame);
  const read = (label) => {
    const box = panel.getBoundingClientRect();
    return { at: label, w: Math.round(box.width), h: Math.round(box.height), top: Math.round(box.top) };
  };

  const out = [read("closed")];
  toggle.click();
  out.push(read("sync after click"));
  for (let i = 0; i < 3; i += 1) {
    await frame();
    out.push(read(`frame ${i + 1}`));
  }
  await new Promise((r) => setTimeout(r, 500));
  out.push(read("settled"));
  return out;
})();
