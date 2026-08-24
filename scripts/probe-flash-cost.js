// One-off browser probe: which half of flashRestrike costs the time —
// getAnimations() (a style flush per element) or animate() itself — measured
// over the 121 caps a pitch class has in the drawn window.
(() => {
  const surface = document.querySelector("[data-instrument]");
  const polys = (pc) => [...surface.querySelectorAll(`[data-pc="${pc}"] polygon`)];
  const three = [2, 5, 9].flatMap(polys);
  const time = (label, fn) => {
    const t = performance.now();
    fn();
    return { [label]: +(performance.now() - t).toFixed(1) };
  };
  const out = { n: three.length };
  Object.assign(out, time("getAnimations", () => three.forEach((p) => p.getAnimations())));
  Object.assign(
    out,
    time("animate", () =>
      three.forEach((p) => p.animate([{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], { duration: 220 })),
    ),
  );
  Object.assign(out, time("bothAgain", () =>
    three.forEach((p) => {
      for (const a of p.getAnimations()) a.cancel();
      p.animate([{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], { duration: 220 });
    }),
  ));
  Object.assign(out, time("classAdd", () => three.forEach((p) => p.parentElement.classList.add("active"))));
  Object.assign(out, time("classRemove", () => three.forEach((p) => p.parentElement.classList.remove("active"))));
  return out;
})();
