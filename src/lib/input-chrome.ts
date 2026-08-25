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

  // ...and consuming that context menu is what makes an Android phone buzz
  // mid-note, so the touch gesture behind it has to be stopped a step earlier.
  // Chromium hangs the long-press haptic off the renderer *consuming* the
  // GestureLongPress, and cancelling `contextmenu` is precisely what reports it
  // consumed. A consumed `touchstart` drops every gesture in the sequence
  // before one is generated, long press included. DESIGN.md "The long-press
  // buzz".
  //
  // The surface has nothing that wants a gesture: no click handler, no
  // scrolling (`touch-action: none`), no double-tap zoom. Touch activation
  // comes from the lift, not from a gesture (`Instrument.unlock`), so the audio
  // unlock is untouched — and the HUD's buttons are outside this element, so
  // their clicks are too.
  surface.addEventListener("touchstart", (event) => event.preventDefault(), { passive: false });

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
