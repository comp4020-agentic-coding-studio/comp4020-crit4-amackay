// One-off: does the copy re-wrap while the card is growing? Samples the
// body's box and its first paragraph's height every frame of the expand — a
// paragraph that re-wraps changes height as the line count changes.
(async () => {
  const panel = document.querySelector("[data-about]");
  const toggle = document.querySelector("[data-about-toggle]");
  const body = panel.querySelector(".about-body");
  const paragraph = body.querySelector("p");
  const frame = () => new Promise(requestAnimationFrame);

  const sample = () => ({
    card: Math.round(panel.getBoundingClientRect().width),
    bodyW: Math.round(body.getBoundingClientRect().width),
    paraH: Math.round(paragraph.getBoundingClientRect().height),
    scrolls: body.scrollHeight > body.clientHeight,
    opacity: Number(getComputedStyle(body).opacity.slice(0, 4)),
  });

  const samples = [sample()];
  toggle.click();
  for (let i = 0; i < 26; i += 1) {
    await frame();
    samples.push(sample());
  }

  const distinct = (key) => [...new Set(samples.map((s) => s[key]))];
  return {
    bodyWidths: distinct("bodyW"),
    paragraphHeights: distinct("paraH"),
    everScrolled: samples.some((s) => s.scrolls),
    // The card width when the copy first becomes visible, against its final
    // width: the copy should not arrive through a moving clip edge.
    cardWhenCopyAppears: samples.find((s) => s.opacity > 0)?.card ?? null,
    cardFinal: samples.at(-1).card,
    frames: samples.length,
  };
})();
