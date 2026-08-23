// The title plate, which is also the About panel. See DESIGN.md "About panel".
//
// This file opens and closes; it never animates. The plate and the card are one
// element in two states, and the whole morph is a CSS transition between them
// (index.astro's scoped <style>), so all that happens here is `data-open` going
// on and off.
//
// It does measure one thing, off the transition entirely: the card's height,
// from the copy, so the card fits whatever the copy says instead of a constant
// refitted by hand every time the words change. CSS cannot read it, because
// the copy is absolutely positioned in both states and so contributes nothing
// to the plate's `fit-content` --- which is exactly the property that keeps the
// expand starting from the plate's rect rather than the card's.
//
// `const` arrow functions rather than `function` declarations, per the Annex B
// hoisting hazard that bit main.ts twice (CLAUDE.md, "Two build quirks").

export interface AboutPanel {
  /** True while the panel is expanded. The page script gates keyboard play on
   *  this: with the card open the surface is behind a scrim, and the keys have
   *  to go quiet with it. */
  isOpen: () => boolean;
}

const CLOSED: AboutPanel = { isOpen: () => false };

export const installAboutPanel = (options: { onOpen?: () => void } = {}): AboutPanel => {
  const panel = document.querySelector<HTMLElement>("[data-about]");
  const toggle = document.querySelector<HTMLButtonElement>("[data-about-toggle]");
  if (!panel || !toggle) return CLOSED;

  const closeButton = document.querySelector<HTMLButtonElement>("[data-about-close]");
  const scrim = document.querySelector<HTMLElement>("[data-about-scrim]");

  const isOpen = (): boolean => panel.hasAttribute("data-open");

  // The copy's own height, measured first-child-top to last-child-bottom
  // rather than from the box: the box carries a `max-height` derived from
  // --card-fit, so reading that back would feed the last answer into the next
  // one. Runs while the panel is closed and the body is `visibility: hidden`,
  // which still lays out.
  //
  // The two insets come off the same element rather than out of the custom
  // properties that set them: an unregistered custom property's computed value
  // is the `calc(...)` it was written as, not a length. The panel has no
  // border, so its padding box --- the containing block an absolutely
  // positioned child is laid out against --- shares its border box's edges,
  // and the child's offset from the panel's own rect is its used `top`/`left`:
  // --copy-top and --card-pad already resolved, in either state, and unaffected
  // by the padding the open card carries. --card-pad is the copy's inset on the
  // other three sides too, so the left one is also the bottom one.
  //
  // Rects rather than `offsetTop`/`offsetLeft`, which are the same two numbers
  // rounded to integers: rounding --copy-top's 97.76 up to 98 and --card-pad's
  // 38.4 down to 38 left the fitted height 0.16px under the copy, and the body
  // grew a hairline scrollbar.
  const body = document.querySelector<HTMLElement>(".about-body");
  const fitCard = (): void => {
    const first = body?.firstElementChild;
    const last = body?.lastElementChild;
    if (!body || !first || !last) return;
    const box = body.getBoundingClientRect();
    const card = panel.getBoundingClientRect();
    const copy = last.getBoundingClientRect().bottom - first.getBoundingClientRect().top;
    if (copy <= 0) return; // no layout yet (jsdom, or display:none): leave the fallback
    panel.style.setProperty("--card-fit", `${copy + (box.top - card.top) + (box.left - card.left)}px`);
  };

  fitCard();
  // The type is vmin-clamped and the card's width is capped in vw, so the copy
  // rewraps at a new size on resize and orientation change.
  window.addEventListener("resize", fitCard);
  void document.fonts?.ready.then(fitCard);

  const setOpen = (open: boolean): void => {
    if (open === isOpen()) return;
    panel.toggleAttribute("data-open", open);
    scrim?.toggleAttribute("data-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) options.onOpen?.();
  };

  const close = (): void => {
    if (!isOpen()) return;
    setOpen(false);
    // The toggle is where the panel came from and where a keyboard reader
    // still is; Escape and the × both hand focus back to it rather than
    // dropping it on <body>.
    toggle.focus();
  };

  toggle.addEventListener("click", () => setOpen(!isOpen()));
  closeButton?.addEventListener("click", close);
  scrim?.addEventListener("pointerdown", close);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return { isOpen };
};
