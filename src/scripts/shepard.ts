// Standalone manual-test rig for the Shepard-tone synthesis in
// instrument.ts, independent of the just-intonation lattice. See
// DESIGN.md "Shepard/12-TET test page".

import { Instrument } from "../lib/instrument.ts";
import { clockNodeAt, clockNodeFor, type ClockNode } from "../lib/clock.ts";
import { installInputChrome } from "../lib/input-chrome.ts";

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
  installInputChrome(grid);

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

  // Which pointers are down, so a dial can tell a drag from a hover. A held
  // node isn't enough on its own: this page releases in the gap between dials,
  // so a dragging pointer spends part of its time holding nothing.
  const downPointers = new Set<number>();

  const pressPointerAt = (pointerId: number, cap: HTMLElement): void => {
    const pressCode = String(pointerId);
    if (heldNodes.get(pressCode)?.code === cap.dataset.note) return; // already on this dial
    release(pressCode);
    press(pressCode, () => clockNodeFor(cap.dataset.note!));
  };

  for (const cap of caps) {
    cap.addEventListener("pointerdown", (event) => {
      // Touch pointers are implicitly captured to the dial pressed, so
      // pointerenter would never fire on the ones a finger drags onto.
      cap.releasePointerCapture(event.pointerId);
      downPointers.add(event.pointerId);
      pressPointerAt(event.pointerId, cap);
    });

    cap.addEventListener("pointerenter", (event) => {
      if (!downPointers.has(event.pointerId)) return; // hover, not a drag
      pressPointerAt(event.pointerId, cap);
    });

    // The dials don't touch, so unlike the main grid there is somewhere to be
    // between them: leaving one silences it rather than sustaining across.
    // pointerenter/pointerleave don't bubble, and leave fires before the next
    // dial's enter, so dial-to-dial is release-then-press in the right order.
    cap.addEventListener("pointerleave", (event) => {
      if (!downPointers.has(event.pointerId)) return;
      release(String(event.pointerId));
    });
  }

  const liftPointer = (pointerId: number): void => {
    downPointers.delete(pointerId);
    release(String(pointerId));
  };

  // window, not grid: a lift outside the clock box would otherwise leave the
  // pointer marked down, and the next hover would sound a note unbidden.
  for (const type of ["pointerup", "pointercancel"]) {
    window.addEventListener(type, (event) => liftPointer((event as PointerEvent).pointerId));
  }
  grid.addEventListener("pointerleave", (event) => liftPointer((event as PointerEvent).pointerId));

  // A fallback for environments where pointerenter doesn't carry a drag:
  // resolve the dial under the pointer directly. jsdom has no layout, so this
  // is wrapped to degrade to doing nothing rather than throwing.
  grid.addEventListener("pointermove", (event) => {
    if (!downPointers.has(event.pointerId)) return;
    let hit: Element | null = null;
    try {
      hit = document.elementFromPoint(event.clientX, event.clientY);
    } catch {
      return;
    }
    const cap = hit?.closest<HTMLElement>("[data-note]");
    if (cap) pressPointerAt(event.pointerId, cap);
    else release(String(event.pointerId));
  });

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
    downPointers.clear();
  });
}
