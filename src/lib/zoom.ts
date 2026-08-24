// Zoom in/out over the Tonnetz surface: mutates --fit-size on the stage
// element, and everything else (--twelfth, .stage's size, the cursor dot)
// follows from it through the existing CSS calc chain (index.astro). See
// DESIGN.md "Sizing" and CLAUDE.md's `const` arrow-function rule.

import { FIT_SIZE_MAX, FIT_SIZE_MIN, ZOOM_STEP } from "./tonnetz.ts";

/** Layout.astro's viewport-substitution fix reads --fit-size live off the
 *  stage, but only re-runs on resize/orientationchange/load/visualViewport
 *  resize. A zoom click changes --fit-size for none of those reasons, so it
 *  dispatches this event and Layout.astro's listener list includes it. The
 *  string has to match by hand on both sides — that script is `is:inline`
 *  and cannot import this constant. */
export const FIT_SIZE_CHANGE_EVENT = "tonnetz:fit-size-change";

export interface ZoomControl {
  /** Pull the zoom buttons out of the tab order (About panel open) or back
   *  in (closed) — independent of the bound-driven `disabled` state, which
   *  keeps applying underneath. Z-index already hides these behind the
   *  About scrim while it's open; this is the matching fix for keyboard
   *  tab order, which stacking order doesn't touch. */
  setEnabled: (enabled: boolean) => void;
}

const CLOSED: ZoomControl = { setEnabled: () => {} };

export const installZoom = (): ZoomControl => {
  const stage = document.querySelector<HTMLElement>("[data-instrument]");
  const zoomIn = document.querySelector<HTMLButtonElement>("[data-zoom-in]");
  const zoomOut = document.querySelector<HTMLButtonElement>("[data-zoom-out]");
  if (!stage || !zoomIn || !zoomOut) return CLOSED;

  const clamp = (n: number): number => Math.min(FIT_SIZE_MAX, Math.max(FIT_SIZE_MIN, n));

  // Read the live value back off the stage rather than tracking it in a
  // module-level variable — the same "one number, read back" idiom
  // Layout.astro's own fitSize() already uses for this exact property.
  const current = (): number => {
    const n = parseFloat(getComputedStyle(stage).getPropertyValue("--fit-size"));
    return Number.isFinite(n) && n > 0 ? n : FIT_SIZE_MIN;
  };

  const updateDisabled = (fitSize: number): void => {
    zoomIn.disabled = fitSize <= FIT_SIZE_MIN;
    zoomIn.setAttribute("aria-disabled", String(zoomIn.disabled));
    zoomOut.disabled = fitSize >= FIT_SIZE_MAX;
    zoomOut.setAttribute("aria-disabled", String(zoomOut.disabled));
  };

  const setFitSize = (next: number): void => {
    const clamped = clamp(next);
    stage.style.setProperty("--fit-size", String(clamped));
    updateDisabled(clamped);
    window.dispatchEvent(new Event(FIT_SIZE_CHANGE_EVENT));
  };

  // Zooming in shows fewer twelfths (a smaller fit-size); zooming out shows
  // more.
  zoomIn.addEventListener("click", () => setFitSize(current() - ZOOM_STEP));
  zoomOut.addEventListener("click", () => setFitSize(current() + ZOOM_STEP));

  updateDisabled(current());

  const setEnabled = (enabled: boolean): void => {
    zoomIn.tabIndex = enabled ? 0 : -1;
    zoomOut.tabIndex = enabled ? 0 : -1;
  };

  return { setEnabled };
};
