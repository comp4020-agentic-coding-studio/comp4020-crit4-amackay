// The title plate, which is also the About panel. See DESIGN.md "About panel".
//
// This file opens and closes; it never animates. The plate and the card are one
// element in two states, and the whole morph is a CSS transition between them
// (index.astro's scoped <style>), so all that happens here is `data-open` going
// on and off.
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
