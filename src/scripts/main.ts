// The Tonnetz: pointer, drag and keyboard wiring over the static SVG surface.
// See DESIGN.md "Interaction" for the contract this follows.

import { Instrument } from "../lib/instrument.ts";
import { installInputChrome } from "../lib/input-chrome.ts";
import { PitchClassVoices } from "../lib/pitch-voices.ts";
import { nodeForCode, pc as pcOf, pressedPitchClasses } from "../lib/tonnetz.ts";

// Debug mode: `?debug` in the URL shows each cap's (m, n). Never shown to a
// player who hasn't gone looking for it — see DESIGN.md "Debug mode".
document.documentElement.classList.toggle("debug", new URLSearchParams(location.search).has("debug"));

const surface = document.querySelector<HTMLElement>("[data-instrument]");

if (surface) {
  installInputChrome(surface);

  const instrument = new Instrument();
  const voices = new PitchClassVoices(instrument);

  const svg = surface.querySelector<SVGSVGElement>("svg");
  const caps = [...surface.querySelectorAll<SVGGElement>("[data-m]")];

  // A pitch class can light up more than one on-screen cap at once — the
  // fundamental-domain instance and any wrapped copies within the drawn
  // margin — so the DOM ".active" class is refcounted per pitch class, not
  // per cap. This is separate from PitchClassVoices' own per-pitch-class
  // refcount of *voices*, which knows nothing about the DOM.
  const capsByPc = new Map<number, SVGGElement[]>();
  for (const cap of caps) {
    const p = Number(cap.dataset.pc);
    const list = capsByPc.get(p) ?? [];
    list.push(cap);
    capsByPc.set(p, list);
  }
  const activeHolders = new Map<number, Set<string>>();

  // `const` arrow functions throughout this block, not `function`
  // declarations: the spec harness runs the built script as a classic
  // (sloppy) script, where a block-scoped `function` hoists under Annex B and
  // can clobber whichever top-level binding the minifier gives the same
  // single-letter name (bit main.ts twice already, per CLAUDE.md).
  const activatePc = (p: number, holder: string): void => {
    const set = activeHolders.get(p) ?? new Set<string>();
    set.add(holder);
    activeHolders.set(p, set);
    for (const cap of capsByPc.get(p) ?? []) cap.classList.add("active");
  };

  const deactivatePc = (p: number, holder: string): void => {
    const set = activeHolders.get(p);
    if (!set) return;
    set.delete(holder);
    if (set.size === 0) {
      activeHolders.delete(p);
      for (const cap of capsByPc.get(p) ?? []) cap.classList.remove("active");
    }
  };

  // Drives both the DOM refcount and the audio refcount from one diff, so the
  // two can never disagree about what a holder has just pressed.
  const applyPress = (holder: string, next: ReadonlySet<number>, previous: ReadonlySet<number>): void => {
    for (const p of next) if (!previous.has(p)) activatePc(p, holder);
    for (const p of previous) if (!next.has(p)) deactivatePc(p, holder);
    voices.press(holder, next);
  };

  const releaseHolder = (holder: string, previous: ReadonlySet<number>): void => {
    for (const p of previous) deactivatePc(p, holder);
    voices.release(holder);
  };

  // --- pointer ---

  // What each pointer currently presses, and which cell it last landed on
  // (the coordinate path's anchor for its 7-cell neighbourhood check).
  const pointerPcs = new Map<number, Set<number>>();
  const pointerCell = new Map<number, [number, number]>();

  const releasePointer = (pointerId: number): void => {
    const previous = pointerPcs.get(pointerId);
    if (!previous) return;
    pointerPcs.delete(pointerId);
    pointerCell.delete(pointerId);
    releaseHolder(String(pointerId), previous);
  };

  // Element path: the cap under the pointer already named one cell — SVG hit
  // tested the hexagon for us. Always available, and the only path the spec
  // harness's press()/drag() ever exercise (they never dispatch pointermove).
  const pressPointerAt = (pointerId: number, cap: SVGGElement): void => {
    const m = Number(cap.dataset.m);
    const n = Number(cap.dataset.n);
    pointerCell.set(pointerId, [m, n]);
    const previous = pointerPcs.get(pointerId) ?? new Set<number>();
    const next = new Set<number>([pcOf(m, n)]);
    pointerPcs.set(pointerId, next);
    applyPress(String(pointerId), next, previous);
  };

  for (const cap of caps) {
    cap.addEventListener("pointerdown", (event) => {
      // Touch pointers are implicitly captured to the cap pressed; releasing
      // capture is what lets pointerenter fire on the caps a finger drags onto.
      // A pointerdown with no real capture behind it (synthetic events, some
      // browser/device quirks) throws NotFoundError here — harmless, and
      // never worth failing the press over.
      try {
        cap.releasePointerCapture(event.pointerId);
      } catch {
        // no capture to release
      }
      pressPointerAt(event.pointerId, cap);
    });

    cap.addEventListener("pointerenter", (event) => {
      if (!pointerPcs.has(event.pointerId)) return; // hover, not a drag
      pressPointerAt(event.pointerId, cap);
    });
  }

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    surface.addEventListener(type, (event) => releasePointer((event as PointerEvent).pointerId));
  }
  // A lift that happens off the surface entirely never reaches the listeners
  // above; releasePointer is idempotent, so catching it twice is harmless.
  for (const type of ["pointerup", "pointercancel"]) {
    window.addEventListener(type, (event) => releasePointer((event as PointerEvent).pointerId));
  }

  // Coordinate path: refines the element hit into the true set of one, two or
  // three pitch classes, via cellDist against the hit cell and its six
  // neighbours. jsdom has no layout, so every getBoundingClientRect() is
  // zero-sized and a client-to-twelfths division would be NaN; guard on
  // rect.width === 0 and do nothing extra — the element path above is still
  // driving everything. See DESIGN.md "Two hit-test paths".
  surface.addEventListener("pointermove", (event) => {
    const pointerId = (event as PointerEvent).pointerId;
    const cell = pointerCell.get(pointerId);
    if (!cell || !svg) return;

    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;

    try {
      const box = svg.viewBox.baseVal;
      const localX = box.x + ((event.clientX - rect.left) / rect.width) * box.width;
      const localY = box.y + ((event.clientY - rect.top) / rect.height) * box.height;
      const point: [number, number] = [localX, -localY];

      const previous = pointerPcs.get(pointerId) ?? new Set<number>();
      const next = pressedPitchClasses(point, cell, previous);
      if (next.size === 0) return; // every point of the surface presses something; a glitch shouldn't clear it
      pointerPcs.set(pointerId, next);
      applyPress(String(pointerId), next, previous);
    } catch {
      // Never let coordinate refinement throw — the element path already did the real work.
    }
  });

  // --- keyboard ---

  const heldKeyPcs = new Map<string, number>();

  window.addEventListener("keydown", (event) => {
    const node = nodeForCode(event.code);
    if (!node) return; // unmapped keys do nothing
    event.preventDefault();
    if (event.repeat || heldKeyPcs.has(event.code)) return;
    heldKeyPcs.set(event.code, node.pc);
    applyPress(event.code, new Set([node.pc]), new Set());
  });

  window.addEventListener("keyup", (event) => {
    const p = heldKeyPcs.get(event.code);
    if (p === undefined) return;
    heldKeyPcs.delete(event.code);
    releaseHolder(event.code, new Set([p]));
  });

  window.addEventListener("blur", () => {
    instrument.releaseAll();
    voices.releaseAll();
    for (const cap of caps) cap.classList.remove("active");
    activeHolders.clear();
    pointerPcs.clear();
    pointerCell.clear();
    heldKeyPcs.clear();
  });
}
