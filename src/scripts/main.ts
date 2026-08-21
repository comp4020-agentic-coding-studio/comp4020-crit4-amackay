// Checkpoint 2: the grid, keyboard mapping, and pointer/drag handling. See
// DESIGN.md "Interaction" for the contract this follows.

import { Instrument } from "../lib/instrument.ts";
import { nodeFor } from "../lib/lattice.ts";

// Debug mode: `?debug` in the URL shows each cap's monzo and nearest 12-TET
// name, and shrinks the label into the corner. Never shown to a player who
// hasn't gone looking for it — see DESIGN.md "Debug mode".
document.documentElement.classList.toggle("debug", new URLSearchParams(location.search).has("debug"));

const grid = document.querySelector<HTMLElement>("[data-instrument]");

if (grid) {
  const instrument = new Instrument();
  const caps = [...grid.querySelectorAll<HTMLElement>("[data-note]")];
  const capByCode = new Map(caps.map((cap) => [cap.dataset.note!, cap]));

  // Which codes currently hold each cap active, so a key and a finger landing
  // on the same cap don't fight over its visual state.
  const holders = new Map<HTMLElement, Set<string>>();

  // `const` arrow functions throughout this block, not `function`
  // declarations: the spec harness runs the built script as a classic
  // (sloppy) script, where a block-scoped `function` hoists under Annex B and
  // can clobber whichever top-level binding the minifier gives the same
  // single-letter name (bit us once already at checkpoint 1).
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

  // What each pointer is currently holding, so a drag knows what to release.
  const pointerCodes = new Map<number, string>();

  const releasePointer = (pointerId: number): void => {
    const code = pointerCodes.get(pointerId);
    if (code === undefined) return;
    pointerCodes.delete(pointerId);
    const holder = String(pointerId);
    instrument.noteOff(holder);
    const cap = capByCode.get(code);
    if (cap) deactivate(cap, holder);
  };

  const pressPointer = (pointerId: number, cap: HTMLElement): void => {
    const code = cap.dataset.note;
    if (!code) return;
    if (pointerCodes.get(pointerId) === code) return; // already holding this cap
    releasePointer(pointerId);
    const node = nodeFor(code);
    if (!node) return;
    pointerCodes.set(pointerId, code);
    instrument.noteOn(String(pointerId), node.ratio);
    activate(cap, String(pointerId));
  };

  for (const cap of caps) {
    cap.addEventListener("pointerdown", (event) => {
      cap.releasePointerCapture(event.pointerId);
      pressPointer(event.pointerId, cap);
    });

    // pointerenter is the drag path the spec drives: touch pointers are
    // implicitly captured to the cap pressed, so releasing capture above is
    // what lets this fire on the caps a finger drags onto.
    cap.addEventListener("pointerenter", (event) => {
      if (!pointerCodes.has(event.pointerId)) return; // hover, not a drag
      pressPointer(event.pointerId, cap);
    });
  }

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    grid.addEventListener(type, (event) => releasePointer((event as PointerEvent).pointerId));
  }

  // A fallback for environments where pointerenter doesn't carry a drag:
  // resolve the cap under the pointer directly. jsdom has no layout, so this
  // is wrapped to degrade to doing nothing rather than throwing.
  grid.addEventListener("pointermove", (event) => {
    if (!pointerCodes.has(event.pointerId)) return;
    let hit: Element | null = null;
    try {
      hit = document.elementFromPoint(event.clientX, event.clientY);
    } catch {
      return;
    }
    const cap = hit?.closest<HTMLElement>("[data-note]");
    if (cap) pressPointer(event.pointerId, cap);
  });

  const heldKeys = new Set<string>();

  window.addEventListener("keydown", (event) => {
    const node = nodeFor(event.code);
    if (!node) return; // unmapped keys do nothing
    event.preventDefault();
    if (event.repeat || heldKeys.has(event.code)) return;
    heldKeys.add(event.code);
    instrument.noteOn(event.code, node.ratio);
    const cap = capByCode.get(event.code);
    if (cap) activate(cap, event.code);
  });

  window.addEventListener("keyup", (event) => {
    if (!heldKeys.has(event.code)) return;
    heldKeys.delete(event.code);
    instrument.noteOff(event.code);
    const cap = capByCode.get(event.code);
    if (cap) deactivate(cap, event.code);
  });

  window.addEventListener("blur", () => {
    instrument.releaseAll();
    for (const cap of holders.keys()) cap.classList.remove("active");
    holders.clear();
    pointerCodes.clear();
    heldKeys.clear();
  });
}
