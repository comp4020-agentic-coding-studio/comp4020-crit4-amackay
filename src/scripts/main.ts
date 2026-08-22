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

  // Debug-only, hacky on purpose: rotate/flip/pan/zoom the whole lattice by
  // hand to eyeball positioning against the fit-window and fundamental-domain
  // debug rects, before committing to real sizing numbers. Never runs outside
  // `?debug` — DESIGN.md "Debug mode". Reads the fit-window rect's own
  // attributes for its pivot rather than hand-typing CX/CY again here.
  if (document.documentElement.classList.contains("debug") && svg) {
    const debugGroup = svg.querySelector<SVGGElement>("#debug-transform");
    const fitWindow = svg.querySelector<SVGRectElement>(".debug-fit-window");
    const controls = document.querySelector<HTMLElement>(".debug-controls");
    if (debugGroup && fitWindow && controls) {
      const pivotX = Number(fitWindow.getAttribute("x")) + Number(fitWindow.getAttribute("width")) / 2;
      const pivotY = Number(fitWindow.getAttribute("y")) + Number(fitWindow.getAttribute("height")) / 2;
      const PAN_STEP = 1;
      const ZOOM_STEP = 1.1;

      // The positioning decision: rotate 90° then flip vertically turns the
      // raw lattice's "columns 3 apart, each spaced 4 apart in y" layout into
      // rows of three staggered rightward going down —
      //   Gb D Bb / B G Eb / E C Ab / A F Db
      // — verified column by column against pc(m,n). The pan brings the
      // (rotated) fundamental domain's centre — raw lattice (16.5,10.5), i.e.
      // screen (16.5,-10.5) since screen y = -lattice y — onto the fit
      // window's fixed centre (pivotX,pivotY): rotating+flipping alone maps
      // that centre to pivot + M·(domainCentre - pivot), where M is the
      // combined rotate(90)+flipV matrix (x,y) -> (-y,-x); pan is the
      // remaining difference. Recompute both if DOMAIN_X0/Y0 in index.astro
      // move.
      const DEFAULT_VIEW = { rotate: 90, flipX: 1, flipY: -1, scale: 1, panX: -5, panY: 10.5 };
      const view = { ...DEFAULT_VIEW };

      const render = (): void => {
        const { rotate, flipX, flipY, scale, panX, panY } = view;
        debugGroup.setAttribute(
          "transform",
          `translate(${panX} ${panY}) translate(${pivotX} ${pivotY}) ` +
            `scale(${flipX * scale} ${flipY * scale}) rotate(${rotate}) ` +
            `translate(${-pivotX} ${-pivotY})`,
        );
      };

      const actions: Record<string, () => void> = {
        rotate: () => (view.rotate = (view.rotate + 90) % 360),
        "flip-h": () => (view.flipX *= -1),
        "flip-v": () => (view.flipY *= -1),
        "pan-up": () => (view.panY -= PAN_STEP),
        "pan-down": () => (view.panY += PAN_STEP),
        "pan-left": () => (view.panX -= PAN_STEP),
        "pan-right": () => (view.panX += PAN_STEP),
        "zoom-in": () => (view.scale *= ZOOM_STEP),
        "zoom-out": () => (view.scale /= ZOOM_STEP),
        reset: () => Object.assign(view, DEFAULT_VIEW),
      };

      controls.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-debug-action]");
        const action = button && actions[button.dataset.debugAction ?? ""];
        if (!action) return;
        action();
        render();
      });

      render(); // apply DEFAULT_VIEW immediately, not just after the first click
    }
  }

  // A pitch class can light up more than one on-screen cap at once — the
  // fundamental-domain instance and any wrapped copies within the drawn
  // margin — so the DOM ".active" class is refcounted per pitch class, not
  // per cap. The class is still a refcount even though voices no longer are:
  // a cap is lit while *anyone* holds its pitch class, whereas each holder
  // owns a voice of its own (DESIGN.md "One voice per gesture"). The count is
  // what tells a restrike apart from a first strike.
  const capsByPc = new Map<number, SVGGElement[]>();
  for (const cap of caps) {
    const p = Number(cap.dataset.pc);
    const list = capsByPc.get(p) ?? [];
    list.push(cap);
    capsByPc.set(p, list);
  }
  // `const` arrow functions throughout this block, not `function`
  // declarations: the spec harness runs the built script as a classic
  // (sloppy) script, where a block-scoped `function` hoists under Annex B and
  // can clobber whichever top-level binding the minifier gives the same
  // single-letter name (bit main.ts twice already, per CLAUDE.md).
  //
  // Per-pitch-class DOM class refcount, factored out because pressing
  // (`.active`) and the mouse hover preview (`.hover`, DESIGN.md "Mouse
  // preview") are the same bookkeeping over two different classes and two
  // different sets of holders.
  const pcClassToggle = (className: string) => {
    const holders = new Map<number, Set<string>>();
    return {
      /** True when this holder joined a pitch class someone else was already
       *  holding — a restrike, which is a new voice but no change of class. */
      activate: (p: number, holder: string): boolean => {
        const set = holders.get(p) ?? new Set<string>();
        const restrike = set.size > 0 && !set.has(holder);
        set.add(holder);
        holders.set(p, set);
        for (const cap of capsByPc.get(p) ?? []) cap.classList.add(className);
        return restrike;
      },
      deactivate: (p: number, holder: string): void => {
        const set = holders.get(p);
        if (!set) return;
        set.delete(holder);
        if (set.size === 0) {
          holders.delete(p);
          for (const cap of capsByPc.get(p) ?? []) cap.classList.remove(className);
        }
      },
      reset: (): void => holders.clear(),
    };
  };

  const { activate: activatePc, deactivate: deactivatePc, reset: resetActive } = pcClassToggle("active");
  const { activate: activateHoverPc, deactivate: deactivateHoverPc, reset: resetHover } = pcClassToggle("hover");

  // A pitch class already sounding gains nothing visible when a second holder
  // arrives — the cap is lit and stays lit — but a second voice really did
  // start, so restrike it: a brief flash that decays back into the held state.
  // `filter` rather than `fill` so this stays one transient in one place
  // instead of a second copy of the palette living in the script; clipping is
  // applied after filtering on the same element, so the flash cannot leave the
  // hexagon. See DESIGN.md "One voice per gesture".
  const RESTRIKE = "restrike";

  const flashRestrike = (p: number): void => {
    for (const cap of capsByPc.get(p) ?? []) {
      const polygon = cap.querySelector("polygon");
      if (!polygon || typeof polygon.animate !== "function") continue; // jsdom has no Web Animations
      if (typeof polygon.getAnimations === "function") {
        for (const running of polygon.getAnimations()) if (running.id === RESTRIKE) running.cancel();
      }
      // Held just short of washing out: a restrike on an already-bright cap
      // has little headroom before it clips to white and the cap loses the hue
      // that says which note it is. One number to tune by eye.
      polygon.animate([{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], {
        duration: 220,
        easing: "ease-out",
        id: RESTRIKE,
      });
    }
  };

  // Drives both the DOM class and the voices from one diff, so the two can
  // never disagree about what a holder has just pressed.
  const applyPress = (holder: string, next: ReadonlySet<number>, previous: ReadonlySet<number>): void => {
    for (const p of next) if (!previous.has(p) && activatePc(p, holder)) flashRestrike(p);
    for (const p of previous) if (!next.has(p)) deactivatePc(p, holder);
    voices.press(holder, next);
  };

  // Same diff, no audio: the hover preview never reaches Instrument or
  // PitchClassVoices, only the DOM.
  const applyHover = (holder: string, next: ReadonlySet<number>, previous: ReadonlySet<number>): void => {
    for (const p of next) if (!previous.has(p)) activateHoverPc(p, holder);
    for (const p of previous) if (!next.has(p)) deactivateHoverPc(p, holder);
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

  // Client coordinates -> lattice twelfths, through the SVG viewBox. Shared by
  // every coordinate refine below (press and hover alike). null under jsdom,
  // where getBoundingClientRect() is zero-sized — see DESIGN.md "Two hit-test
  // paths".
  const toLatticePoint = (event: PointerEvent): [number, number] | null => {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    const box = svg.viewBox.baseVal;
    const localX = box.x + ((event.clientX - rect.left) / rect.width) * box.width;
    const localY = box.y + ((event.clientY - rect.top) / rect.height) * box.height;
    return [localX, -localY];
  };

  // Coordinate refine, shared by pointermove and pointerenter: measures
  // cellDist against `cell` (already the anchor named by the element path)
  // and its six neighbours, with hysteresis against whatever the pointer
  // already holds.
  const refinePointerAt = (pointerId: number, event: PointerEvent): boolean => {
    const cell = pointerCell.get(pointerId);
    if (!cell) return false;
    try {
      const point = toLatticePoint(event);
      if (!point) return false;
      const previous = pointerPcs.get(pointerId) ?? new Set<number>();
      const next = pressedPitchClasses(point, cell, previous);
      if (next.size === 0) return false; // every point of the surface presses something; a glitch shouldn't clear it
      pointerPcs.set(pointerId, next);
      applyPress(String(pointerId), next, previous);
      return true;
    } catch {
      return false; // Never let coordinate refinement throw — the element path already did the real work.
    }
  };

  // --- mouse preview: cursor dot + hover highlight ---
  //
  // A finger presses by covering ground; a mouse pointer is a dimensionless
  // point until it clicks. Before the click, the cursor becomes the disk it
  // is about to press (DESIGN.md "Touch model"'s r, drawn for once) and the
  // caps that disk overlaps light up — the same pressedPitchClasses geometry
  // as a real press, just never reaching Instrument or PitchClassVoices. Mouse
  // only: a touch has no hover to preview, and per DESIGN.md "Debug mode" /
  // "Visual design" this stays the one exception to "none of that is drawn".
  const hoverCell = new Map<number, [number, number]>();
  const hoverPcs = new Map<number, Set<number>>();

  const clearHover = (pointerId: number): void => {
    const previous = hoverPcs.get(pointerId);
    if (!previous) return;
    hoverPcs.delete(pointerId);
    hoverCell.delete(pointerId);
    applyHover(String(pointerId), new Set(), previous);
  };

  const hoverElementAt = (pointerId: number, cap: SVGGElement): void => {
    const m = Number(cap.dataset.m);
    const n = Number(cap.dataset.n);
    hoverCell.set(pointerId, [m, n]);
    const previous = hoverPcs.get(pointerId) ?? new Set<number>();
    const next = new Set<number>([pcOf(m, n)]);
    hoverPcs.set(pointerId, next);
    applyHover(String(pointerId), next, previous);
  };

  const refineHoverAt = (pointerId: number, event: PointerEvent): boolean => {
    const cell = hoverCell.get(pointerId);
    if (!cell) return false;
    try {
      const point = toLatticePoint(event);
      if (!point) return false;
      const previous = hoverPcs.get(pointerId) ?? new Set<number>();
      const next = pressedPitchClasses(point, cell, previous);
      if (next.size === 0) return false;
      hoverPcs.set(pointerId, next);
      applyHover(String(pointerId), next, previous);
      return true;
    } catch {
      return false;
    }
  };

  const cursorDot = surface.querySelector<HTMLElement>("[data-cursor]");

  const positionCursorDot = (event: PointerEvent): void => {
    if (!cursorDot) return;
    const rect = surface.getBoundingClientRect();
    cursorDot.style.left = `${event.clientX - rect.left}px`;
    cursorDot.style.top = `${event.clientY - rect.top}px`;
    cursorDot.classList.add("visible");
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
      // pressPointerAt knows only the one cell SVG hit-tested, so without this
      // a press on a boundary sounds a single note until the pointer first
      // moves — a tap in a seam under-presses, and the hover preview promises
      // a dyad the click then doesn't deliver.
      refinePointerAt(event.pointerId, event);
    });

    cap.addEventListener("pointerenter", (event) => {
      // Hover tracks where the cursor is, pressed or not — the two states are
      // not exclusive. `.active` outranks `.hover` in CSS for as long as a
      // press lasts, so the preview underneath is already correct when the
      // press ends, and a cap the mouse is still sitting on returns to hover
      // rather than dropping all the way to rest.
      if (event.pointerType === "mouse") {
        hoverCell.set(event.pointerId, [Number(cap.dataset.m), Number(cap.dataset.n)]);
        if (!refineHoverAt(event.pointerId, event)) hoverElementAt(event.pointerId, cap);
      }
      if (!pointerPcs.has(event.pointerId)) return; // hovering, not dragging
      // Update the anchor cell first, then try to refine against this event's
      // own coordinates. Collapsing straight to the singleton element press
      // here — without the refine — would drop a pc still held across a
      // shared edge and immediately re-add it, an audible retrigger every
      // time a drag crosses back and forth over that edge.
      pointerCell.set(event.pointerId, [Number(cap.dataset.m), Number(cap.dataset.n)]);
      if (!refinePointerAt(event.pointerId, event)) pressPointerAt(event.pointerId, cap);
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
  // three pitch classes. jsdom has no layout, so every getBoundingClientRect()
  // is zero-sized and a client-to-twelfths division would be NaN;
  // refinePointerAt guards on rect.width === 0 and does nothing extra — the
  // element path above is still driving everything. See DESIGN.md "Two
  // hit-test paths".
  surface.addEventListener("pointermove", (event) => {
    const pointerEvent = event as PointerEvent;
    refinePointerAt(pointerEvent.pointerId, pointerEvent);
    if (pointerEvent.pointerType !== "mouse") return;
    positionCursorDot(pointerEvent);
    refineHoverAt(pointerEvent.pointerId, pointerEvent);
  });

  surface.addEventListener("pointerleave", (event) => {
    const pointerEvent = event as PointerEvent;
    if (pointerEvent.pointerType !== "mouse") return;
    clearHover(pointerEvent.pointerId);
    cursorDot?.classList.remove("visible");
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
    for (const cap of caps) cap.classList.remove("active", "hover");
    resetActive();
    resetHover();
    pointerPcs.clear();
    pointerCell.clear();
    hoverPcs.clear();
    hoverCell.clear();
    heldKeyPcs.clear();
    cursorDot?.classList.remove("visible");
  });
}
