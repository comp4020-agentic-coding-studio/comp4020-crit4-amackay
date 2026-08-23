// One-off: how tall is the About copy at its card width, so --card-h can be
// sized to it rather than the other way round.
(async () => {
  const panel = document.querySelector("[data-about]");
  const body = document.querySelector(".about-body");
  document.querySelector("[data-about-toggle]").click();
  await new Promise((r) => setTimeout(r, 600));
  const cs = getComputedStyle(panel);
  return {
    viewport: [innerWidth, innerHeight],
    cardW: Math.round(panel.getBoundingClientRect().width),
    cardH: Math.round(panel.getBoundingClientRect().height),
    bodyBoxH: Math.round(body.getBoundingClientRect().height),
    copyH: (() => {
      const ps = [...body.querySelectorAll("p")];
      const top = body.getBoundingClientRect().top;
      return Math.ceil(ps[ps.length - 1].getBoundingClientRect().bottom - top);
    })(),
    overflowing: body.scrollHeight > body.clientHeight + 1,
    copyTop: cs.getPropertyValue("--copy-top"),
    pad: cs.getPropertyValue("--card-pad"),
  };
})();
