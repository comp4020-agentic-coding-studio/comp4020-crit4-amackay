// Zoom in/out over the Tonnetz surface: mutates --fit-size on the stage
// element, and everything else (--twelfth, .stage's size, the cursor dot)
// follows from it through the existing CSS calc chain (index.astro). See
// DESIGN.md "Sizing" and CLAUDE.md's `const` arrow-function rule.
//
// Every move — buttons, the '0' key, the '-'/'=' keys — is the same kind of
// move: exactly one ratio-step, CSS-animated via index.astro's
// `transition: --fit-size ...` on .stage. Holding a key down does nothing
// beyond that first step; main.ts guards on event.repeat.

import {
  FIT_SIZE_INITIAL,
  FIT_SIZE_MAX,
  FIT_SIZE_MIN,
  ZOOM_STEPS_OUT,
  fitSizeForStep,
  stepForFitSize,
} from "./tonnetz.ts";

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
  /** One ratio-step in (shrinks --fit-size) or out (grows it) — the '='/'-'
   *  keys share this with the +/- buttons. */
  stepIn: () => void;
  stepOut: () => void;
  /** Animate to the initial fit size — the '0' key's move. */
  reset: () => void;
}

const CLOSED: ZoomControl = {
  setEnabled: () => {},
  stepIn: () => {},
  stepOut: () => {},
  reset: () => {},
};

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

  // Snap current() to its nearest ratio-step first, then move exactly one
  // step from there, rather than dividing/multiplying current() by
  // ZOOM_RATIO directly: current() may not sit on a step at all (ordinary
  // float slop), and snap-then-step is what makes a move from anywhere
  // always land exactly on the next clean stop, including the bounds
  // themselves — see tonnetz.ts's stepForFitSize.
  const moveStep = (delta: 1 | -1): void => {
    const step = Math.min(ZOOM_STEPS_OUT, Math.max(0, stepForFitSize(current()) + delta));
    setFitSize(fitSizeForStep(step));
  };

  const stepIn = (): void => moveStep(-1);
  const stepOut = (): void => moveStep(1);

  zoomIn.addEventListener("click", stepIn);
  zoomOut.addEventListener("click", stepOut);

  const reset = (): void => setFitSize(FIT_SIZE_INITIAL);

  updateDisabled(current());

  const setEnabled = (enabled: boolean): void => {
    zoomIn.tabIndex = enabled ? 0 : -1;
    zoomOut.tabIndex = enabled ? 0 : -1;
  };

  return { setEnabled, stepIn, stepOut, reset };
};
