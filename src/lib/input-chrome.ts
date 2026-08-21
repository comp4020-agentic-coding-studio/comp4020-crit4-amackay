// The browser's default input chrome, got out of the way of a performance.
// Shared by both playable pages. See DESIGN.md "Input chrome".
//
// `const` arrow functions rather than `function` declarations, per the Annex B
// hoisting hazard that bit main.ts twice (CLAUDE.md, "Two build quirks").

/** Suppress the long-press context menu on the playing surface, and show the
 *  keyboard focus ring only while the player is actually tabbing. */
export const installInputChrome = (surface: HTMLElement): void => {
  // A held finger is the instrument's primary gesture; the browser reads it as
  // a right click. Scoped to the surface, so right-click still works elsewhere.
  surface.addEventListener("contextmenu", (event) => event.preventDefault());

  const root = document.documentElement;

  // Capture phase, so this runs before the play handlers whatever order they
  // were bound in — and regardless of any preventDefault they call.
  window.addEventListener(
    "keydown",
    (event) => root.classList.toggle("keyboard-nav", event.key === "Tab"),
    true,
  );

  const clear = (): void => root.classList.remove("keyboard-nav");
  window.addEventListener("pointerdown", clear, true);
  window.addEventListener("mousedown", clear, true);
};
