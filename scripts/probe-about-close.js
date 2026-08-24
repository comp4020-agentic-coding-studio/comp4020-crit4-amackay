// One-off: does the close button clear the centred title, and the copy?
(async () => {
  const panel = document.querySelector("[data-about]");
  document.querySelector("[data-about-toggle]").click();
  await new Promise((r) => setTimeout(r, 250));
  const box = (sel) => {
    const r = panel.querySelector(sel).getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) };
  };
  const card = panel.getBoundingClientRect();
  const title = box("h1");
  const close = box(".about-close");
  const body = box(".about-body");
  return {
    viewport: [innerWidth, innerHeight],
    card: { w: Math.round(card.width), h: Math.round(card.height) },
    titleGlyphRight: Math.round(panel.querySelector("h1").getBoundingClientRect().right),
    close,
    // The title is centred and nowrap, so what matters is its ink, not its box.
    gapTitleToClose: Math.round(close.l - (card.left + card.width / 2 + measureTitle() / 2)),
    padLeft: Math.round(body.l - card.left),
    padRight: Math.round(card.right - body.r),
    padBottom: Math.round(card.bottom - body.b),
    gapTitleToCopy: Math.round(body.t - title.b),
    gapCloseToTitle: Math.round(title.t - close.b),
    titleTop: Math.round(title.t - card.top),
    scrolls: panel.querySelector(".about-body").scrollHeight > panel.querySelector(".about-body").clientHeight,
    slackBelowCopy: Math.round(card.bottom - body.b),
    closeSize: Math.round(close.r - close.l),
  };
  function measureTitle() {
    const el = panel.querySelector("h1");
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  }
})();
