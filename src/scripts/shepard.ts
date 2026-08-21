// Standalone manual-test rig for the Shepard-tone synthesis in
// instrument.ts, independent of the just-intonation lattice. See
// DESIGN.md "Shepard/12-TET test page".

import { Instrument } from "../lib/instrument.ts";
import { clockNodeAt, clockNodeFor, type ClockNode } from "../lib/clock.ts";

const STEP_BY_CODE: Record<string, number> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit6: 6,
  Digit7: 7,
  Digit8: 8,
  Digit9: 9,
  Digit0: 10,
};

const grid = document.querySelector<HTMLElement>("[data-instrument]");

if (grid) {
  const instrument = new Instrument();
  const caps = [...grid.querySelectorAll<HTMLElement>("[data-note]")];
  const capByCode = new Map(caps.map((cap) => [cap.dataset.note!, cap]));

  // Which pressing codes currently hold each dial active, so two different
  // presses landing on the same dial don't fight over its visual state.
  const holders = new Map<HTMLElement, Set<string>>();

  // `const` arrow functions throughout this block, not `function`
  // declarations: the spec harness for the main page runs its built script as
  // a classic (sloppy) script, where a block-scoped `function` hoists under
  // Annex B and can clobber whichever top-level binding the minifier gives
  // the same single-letter name (bit main.ts once already). Kept here too in
  // case this script is ever driven the same way.
  const activate = (cap: HTMLElement, holder: string): void => {
    const set = holders.get(cap) ?? new Set<string>();
    set.add(holder);
    holders.set(cap, set);
    cap.classList.add("active");
  };

  const deactivate = (cap: HTMLElement, holder: string): void => {
    const set = holders.get(cap);
    if (!set) return;
    set.delete(holder);
    if (set.size === 0) {
      holders.delete(cap);
      cap.classList.remove("active");
    }
  };

  // What each pressing code (a keyboard code, or a pointerId as a string)
  // currently holds, so release knows which node — and hence which ratio and
  // which dial — to let go of, even if a shared cursor has since moved on.
  const heldNodes = new Map<string, ClockNode>();

  const press = (pressCode: string, resolve: () => ClockNode | undefined): void => {
    if (heldNodes.has(pressCode)) return; // already held — also guards event.repeat
    const node = resolve();
    if (!node) return;
    heldNodes.set(pressCode, node);
    instrument.noteOn(pressCode, node.ratio);
    const cap = capByCode.get(node.code);
    if (cap) activate(cap, pressCode);
  };

  const release = (pressCode: string): void => {
    const node = heldNodes.get(pressCode);
    if (!node) return;
    heldNodes.delete(pressCode);
    instrument.noteOff(pressCode);
    const cap = capByCode.get(node.code);
    if (cap) deactivate(cap, pressCode);
  };

  // The digit stepper's shared cursor, advanced by whichever digit key was
  // pressed most recently.
  let cursor = 0;

  for (const cap of caps) {
    cap.addEventListener("pointerdown", (event) => {
      cap.releasePointerCapture(event.pointerId);
      press(String(event.pointerId), () => clockNodeFor(cap.dataset.note!));
    });
  }

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    grid.addEventListener(type, (event) => release(String((event as PointerEvent).pointerId)));
  }

  window.addEventListener("keydown", (event) => {
    const step = STEP_BY_CODE[event.code];
    const direct = clockNodeFor(event.code);

    if (direct) {
      event.preventDefault();
      if (!event.repeat) press(event.code, () => clockNodeFor(event.code));
    } else if (step !== undefined) {
      event.preventDefault();
      if (!event.repeat) {
        press(event.code, () => {
          cursor += event.shiftKey ? -step : step;
          return clockNodeAt(cursor);
        });
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    if (clockNodeFor(event.code) || STEP_BY_CODE[event.code] !== undefined) {
      release(event.code);
    }
  });

  window.addEventListener("blur", () => {
    instrument.releaseAll();
    for (const cap of holders.keys()) cap.classList.remove("active");
    holders.clear();
    heldNodes.clear();
  });
}
