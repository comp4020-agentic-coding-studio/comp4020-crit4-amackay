// Checkpoint 1: the synthesis and envelope path, wired to a single temporary
// trigger for a listening pass. No grid yet — see DESIGN.md "Checkpoints".
//
// The trigger is one element, held by pointer (any number of simultaneous
// fingers) or the space bar. Each new hold advances one step along the a-row
// fifths chain (b = 0) and wraps after ten, so a player can walk the chain by
// repeated presses to check the Shepard illusion, or land several fingers on
// it at once to check loudness with five or more voices held.

import { Instrument } from "../lib/instrument.ts";
import { ratioFor } from "../lib/tuning.ts";

const trigger = document.querySelector<HTMLElement>("[data-instrument]");

if (trigger) {
  const instrument = new Instrument();
  let step = 0;

  // A `const` arrow function, not a block-scoped `function` declaration: the
  // spec harness runs the built script as a classic (sloppy) script, where a
  // `function` declared inside this `if` block would hoist to the module's
  // top level under Annex B and clobber whichever top-level binding the
  // minifier happened to give the same single-letter name.
  const nextRatio = (): number => {
    const a = (step % 10) - 3;
    step += 1;
    return ratioFor(a, 0);
  };

  trigger.addEventListener("pointerdown", (event) => {
    trigger.releasePointerCapture(event.pointerId);
    instrument.noteOn(String(event.pointerId), nextRatio());
  });

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    trigger.addEventListener(type, (event) => {
      instrument.noteOff(String((event as PointerEvent).pointerId));
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat) return;
    event.preventDefault();
    instrument.noteOn("Space", nextRatio());
  });
  window.addEventListener("keyup", (event) => {
    if (event.code !== "Space") return;
    instrument.noteOff("Space");
  });

  window.addEventListener("blur", () => instrument.releaseAll());
}
