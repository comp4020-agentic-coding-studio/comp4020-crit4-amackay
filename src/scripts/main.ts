// The Tonnetz: pointer, drag and keyboard wiring over the static SVG surface.
// See DESIGN.md "Interaction" for the contract this follows.

import { installAboutPanel } from "../lib/about-panel.ts";
import { Instrument } from "../lib/instrument.ts";
import { installInputChrome } from "../lib/input-chrome.ts";
import { extentStepFor, installSurface } from "../lib/surface.ts";
import { PitchClassVoices } from "../lib/pitch-voices.ts";
import { anchorCell, containingCell, EXTENT, FIT_SIZE_INITIAL, nodeForCode, pressedPitchClasses } from "../lib/tonnetz.ts";
import { FIT_SIZE_CHANGE_EVENT, installZoom } from "../lib/zoom.ts";

const surface = document.querySelector<HTMLElement>("[data-instrument]");

if (surface) {
  installInputChrome(surface);

  // --- the drawn window ---
  //
  // The page ships enough lattice for the load state and no more; this grows
  // it to whatever the real viewport and zoom stop need, which is the whole
  // fix for an odd aspect ratio showing black canvas past the lattice's edge
  // (DESIGN.md "The drawn window is not a constant"). Grow-only and rounded to
  // a step, so a drag-resize converges instead of rebuilding per pixel.
  const surfaceWindow = installSurface(surface, EXTENT);

  // The *target* fit size, off the inline style, not the computed one. A zoom
  // step is a CSS transition on --fit-size, so getComputedStyle returns the
  // value mid-flight — which is smaller than where the zoom is heading and
  // sizes the window for a stop it has already left. zoom.ts and index.astro
  // both write --fit-size as an inline style, so the specified value is always
  // the destination.
  const fitSize = (): number => {
    const inline = parseFloat(surface.style.getPropertyValue("--fit-size"));
    if (Number.isFinite(inline) && inline > 0) return inline;
    const computed = parseFloat(getComputedStyle(surface).getPropertyValue("--fit-size"));
    return Number.isFinite(computed) && computed > 0 ? computed : FIT_SIZE_INITIAL;
  };

  const fitWindow = (): void => {
    const [w, h] = [window.innerWidth, window.innerHeight];
    if (!w || !h) return; // jsdom, and any moment the viewport reports nothing
    surfaceWindow.grow(extentStepFor(fitSize(), Math.max(w, h) / Math.min(w, h)));
  };

  // A zoom step animates --fit-size over 240ms, so the window has to be big
  // enough *before* the transition starts or the edges go black on the way
  // out. zoom.ts fires this synchronously from its own setProperty, which is
  // before the next style recalc, so growing here lands ahead of the first
  // animated frame.
  for (const event of [FIT_SIZE_CHANGE_EVENT, "resize", "orientationchange"]) {
    window.addEventListener(event, fitWindow);
  }
  window.visualViewport?.addEventListener("resize", fitWindow);
  fitWindow();

  const zoom = installZoom();

  const instrument = new Instrument();
  const voices = new PitchClassVoices(instrument);

  const svg = surface.querySelector<SVGSVGElement>("svg");

  // A pitch class lights up every one of its caps at once — the
  // fundamental-domain instance and every wrapped copy in the drawn window —
  // and there are about 121 of each, so it is drawn as *one* path holding all
  // of them (DESIGN.md "The lit layer"). Lighting a note is therefore one
  // class on one element, whatever the zoom shows.
  //
  // The class is still refcounted per pitch class, and still a refcount even
  // though voices no longer are: a pitch class is lit while *anyone* holds it,
  // whereas each holder owns a voice of its own (DESIGN.md "One voice per
  // gesture"). The count is what tells a restrike apart from a first strike.
  const litByPc = new Map<number, SVGPathElement>();
  for (const path of surface.querySelectorAll<SVGPathElement>(".lit [data-pc]")) {
    litByPc.set(Number(path.dataset.pc), path);
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
  //
  // `minOnMs` is a floor on how long the class stays applied once it goes on.
  // Style is recalculated once a frame, so a class added and removed between
  // two recalcs is never *computed*: no transition starts, nothing paints, and
  // a tap shorter than a frame plays a note the surface never acknowledged —
  // which is worse than either a silent press or a lit one, because the player
  // is told nothing while hearing something. 80 ms is the 15 ms attack the
  // fill transition takes plus two frames even on a 30 Hz display, so the lit
  // colour is reached and painted before the 500 ms decay begins. It floors
  // only taps already shorter than itself; a held note is untouched. One
  // number to tune by eye.
  const MIN_LIT_MS = 80;

  const pcClassToggle = (className: string, minOnMs = 0) => {
    const holders = new Map<number, Set<string>>();
    const litAt = new Map<number, number>();
    const pendingOff = new Map<number, ReturnType<typeof setTimeout>>();

    const removeNow = (p: number): void => {
      const timer = pendingOff.get(p);
      if (timer !== undefined) clearTimeout(timer);
      pendingOff.delete(p);
      litAt.delete(p);
      litByPc.get(p)?.classList.remove(className);
    };

    return {
      /** True when this holder joined a pitch class that was still lit — a
       *  restrike, which is a new voice but no change of class. Includes one
       *  still lit only because of the floor above: the light is showing, so
       *  arriving under it is a restrike and wants the flash, not a silent
       *  re-press. */
      activate: (p: number, holder: string): boolean => {
        const set = holders.get(p) ?? new Set<string>();
        const restrike = (set.size > 0 && !set.has(holder)) || pendingOff.has(p);
        const timer = pendingOff.get(p);
        if (timer !== undefined) clearTimeout(timer);
        pendingOff.delete(p);
        set.add(holder);
        holders.set(p, set);
        litAt.set(p, performance.now());
        litByPc.get(p)?.classList.add(className);
        return restrike;
      },
      deactivate: (p: number, holder: string): void => {
        const set = holders.get(p);
        if (!set) return;
        set.delete(holder);
        if (set.size > 0) return;
        holders.delete(p);
        const shown = performance.now() - (litAt.get(p) ?? 0);
        if (shown >= minOnMs) removeNow(p);
        else pendingOff.set(p, setTimeout(() => removeNow(p), minOnMs - shown));
      },
      reset: (): void => {
        holders.clear();
        for (const p of [...pendingOff.keys()]) removeNow(p);
        litAt.clear();
      },
    };
  };

  const { activate: activatePc, deactivate: deactivatePc, reset: resetActive } = pcClassToggle("active", MIN_LIT_MS);
  // No floor on the hover preview: a mouse that is somewhere has been there
  // for at least a frame, so there is no sub-frame case to catch.
  const { activate: activateHoverPc, deactivate: deactivateHoverPc, reset: resetHover } = pcClassToggle("hover");

  // Client coordinates -> lattice twelfths, through the SVG viewBox. Shared by
  // the on-screen filter below and by every coordinate refine further down
  // (press and hover alike). null under jsdom, where getBoundingClientRect()
  // is zero-sized — see DESIGN.md "Two hit-test paths".
  type ClientPoint = { clientX: number; clientY: number };

  const toLatticePoint = (event: ClientPoint): [number, number] | null => {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    const box = svg.viewBox.baseVal;
    const localX = box.x + ((event.clientX - rect.left) / rect.width) * box.width;
    const localY = box.y + ((event.clientY - rect.top) / rect.height) * box.height;
    return [localX, -localY];
  };

  // A pitch class already sounding gains nothing visible when a second holder
  // arrives — it is lit and stays lit — but a second voice really did start,
  // so restrike it: a brief flash that decays back into the held state.
  // `filter` rather than `fill` so this stays one transient in one place
  // instead of a second copy of the palette living in the script. It needs no
  // clip of its own: brightness() has no spatial spread, so it cannot put ink
  // anywhere the path's own hexagons did not. See DESIGN.md "One voice per
  // gesture".
  const RESTRIKE = "restrike";

  const flashRestrike = (p: number): void => {
    const path = litByPc.get(p);
    if (!path || typeof path.animate !== "function") return; // jsdom has no Web Animations
    if (typeof path.getAnimations === "function") {
      for (const running of path.getAnimations()) if (running.id === RESTRIKE) running.cancel();
    }
    // Held just short of washing out: a restrike on an already-bright cap has
    // little headroom before it clips to white and the cap loses the hue that
    // says which note it is. One number to tune by eye.
    path.animate([{ filter: "brightness(1.3)" }, { filter: "brightness(1)" }], {
      duration: 220,
      easing: "ease-out",
      id: RESTRIKE,
    });
  };

  // Drives both the DOM class and the voices from one diff, so the two can
  // never disagree about what a holder has just pressed.
  //
  // A press the browser will not let sound lights nothing either. A lit cap
  // is the instrument saying it is sounding that note, and it has to be worth
  // exactly that: a player who has just been told their touch registered, and
  // heard nothing, is left to wonder about their volume, while one whose
  // touch did nothing at all simply tries again — and the second try works.
  // The guard asks only whether sound is possible, never which input asked:
  // a mouse and a keyboard carry their own activation and never fail it.
  const applyPress = (holder: string, next: ReadonlySet<number>, previous: ReadonlySet<number>): void => {
    if (!instrument.canSound()) return;
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

  // The screen position behind every coordinate refine below — real
  // PointerEvents satisfy this structurally, but so does the synthetic
  // replay point the zoom-retrigger loop further down passes in on a
  // pointer that hasn't moved. Recorded on every real refine (see
  // refinePointerAt/refineHoverAt) so that loop knows where to replay each
  // held pointer from.
  const lastClient = new Map<number, ClientPoint>();

  const releasePointer = (pointerId: number): void => {
    const previous = pointerPcs.get(pointerId);
    if (!previous) return;
    pointerPcs.delete(pointerId);
    pointerCell.delete(pointerId);
    releaseHolder(String(pointerId), previous);
  };

  // Element path: the lit path under the pointer names one pitch class — SVG
  // hit-tested its hexagons for us. Always available, and the only path the
  // spec harness's press()/drag() ever exercise (they never dispatch
  // pointermove), which is the whole reason it exists: jsdom has no layout, so
  // the coordinate path below cannot run there at all.
  const pressPointerAt = (pointerId: number, path: SVGPathElement): void => {
    const previous = pointerPcs.get(pointerId) ?? new Set<number>();
    const next = new Set<number>([Number(path.dataset.pc)]);
    pointerPcs.set(pointerId, next);
    applyPress(String(pointerId), next, previous);
  };

  // Coordinate refine, shared by pointermove and pointerenter: measures
  // cellDist against `cell` (already the anchor named by the element path)
  // and its six neighbours, with hysteresis against whatever the pointer
  // already holds.
  const refinePointerAt = (pointerId: number, event: ClientPoint, hitPc?: number): boolean => {
    lastClient.set(pointerId, { clientX: event.clientX, clientY: event.clientY });
    try {
      const point = toLatticePoint(event);
      if (!point) return false;
      // The anchor the element path used to hand over with the cap's own
      // data-m/data-n. A pitch class's path cannot name a cell — it holds 121
      // of them — so the cell comes from the geometry instead, by inverting
      // the F/B basis. scripts/tonnetz-check.ts checks the two agree exactly
      // and keeps agreeing well past the press radius this design allows.
      const cell = pointerCell.get(pointerId) ?? containingCell(point[0], point[1]);
      // Re-anchor to whichever of the seven cells the point has actually
      // stepped into. Without this a drag can only ever reach the one ring
      // around wherever pointerdown landed — fine for mouse, which also gets
      // pointerenter on every cap it crosses, but touch does not reliably
      // retarget pointerenter to caps a finger drags onto, so pointermove has
      // to be able to walk the anchor forward on its own. See tonnetz.ts
      // anchorCell.
      const anchor = anchorCell(point, cell) ?? cell;
      pointerCell.set(pointerId, anchor);
      const previous = pointerPcs.get(pointerId) ?? new Set<number>();
      const next = pressedPitchClasses(point, anchor, previous);
      if (next.size === 0) return false; // every point of the surface presses something; a glitch shouldn't clear it
      // DESIGN.md's "neither path can produce a cell the other did not", made
      // explicit now that the cell is derived rather than handed over. The
      // refine may *add* pitch classes — that is its whole job on a boundary —
      // but it may never drop the one the browser hit-tested. An event whose
      // coordinates don't describe where it was actually dispatched (a
      // synthetic press, which carries clientX/clientY of 0) fails this and
      // leaves the element path's answer standing, rather than pressing
      // whatever happens to sit at the top-left corner of the lattice.
      if (hitPc !== undefined && !next.has(hitPc)) return false;
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
  // only: a touch has no hover to preview, and per DESIGN.md "Visual design"
  // this stays the one exception to "none of that is drawn".
  const hoverCell = new Map<number, [number, number]>();
  const hoverPcs = new Map<number, Set<number>>();

  const clearHover = (pointerId: number): void => {
    const previous = hoverPcs.get(pointerId);
    if (!previous) return;
    hoverPcs.delete(pointerId);
    hoverCell.delete(pointerId);
    applyHover(String(pointerId), new Set(), previous);
  };

  const hoverElementAt = (pointerId: number, path: SVGPathElement): void => {
    const previous = hoverPcs.get(pointerId) ?? new Set<number>();
    const next = new Set<number>([Number(path.dataset.pc)]);
    hoverPcs.set(pointerId, next);
    applyHover(String(pointerId), next, previous);
  };

  const refineHoverAt = (pointerId: number, event: ClientPoint, hitPc?: number): boolean => {
    lastClient.set(pointerId, { clientX: event.clientX, clientY: event.clientY });
    try {
      const point = toLatticePoint(event);
      if (!point) return false;
      const cell = hoverCell.get(pointerId) ?? containingCell(point[0], point[1]);
      const anchor = anchorCell(point, cell) ?? cell;
      hoverCell.set(pointerId, anchor);
      const previous = hoverPcs.get(pointerId) ?? new Set<number>();
      const next = pressedPitchClasses(point, anchor, previous);
      if (next.size === 0) return false;
      if (hitPc !== undefined && !next.has(hitPc)) return false; // see refinePointerAt
      hoverPcs.set(pointerId, next);
      applyHover(String(pointerId), next, previous);
      return true;
    } catch {
      return false;
    }
  };

  const cursorDot = surface.querySelector<HTMLElement>("[data-cursor]");

  // Both marks the mouse leaves behind — the lit preview cap and the cursor
  // disk — put out, because the hands are on the keyboard now and neither
  // mark has anything to do with what is being played. `hoverCell` is kept
  // deliberately: it is the anchor the next pointermove refines from, and
  // dropping it (as clearHover does) would leave the preview dark until the
  // mouse crossed into a *different* cap. Nothing restores these; the next
  // move relights the preview and re-shows the disk on its own.
  const dimMouseMarks = (): void => {
    for (const [pointerId, previous] of hoverPcs) applyHover(String(pointerId), new Set(), previous);
    hoverPcs.clear();
    cursorDot?.classList.remove("visible");
  };

  // ...and back, on any mouse event whatever, not only movement. A player who
  // reaches for the mouse and clicks without nudging it produces no
  // pointermove at all, so keying that restore to movement left the disk and
  // the preview off through the whole click and after it.
  const showMouseMarks = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    positionCursorDot(event);
    const path = (event.target as Element | null)?.closest?.("[data-pc]");
    refineHoverAt(event.pointerId, event, path ? Number((path as HTMLElement).dataset.pc) : undefined);
  };

  const positionCursorDot = (event: ClientPoint): void => {
    if (!cursorDot) return;
    const rect = surface.getBoundingClientRect();
    cursorDot.style.left = `${event.clientX - rect.left}px`;
    cursorDot.style.top = `${event.clientY - rect.top}px`;
    cursorDot.classList.add("visible");
  };

  // --- keep hover/press in sync through a zoom animation ---
  //
  // --fit-size's CSS transition (index.astro) changes the screen-to-lattice
  // mapping every frame it runs, but a pointer sitting still on screen
  // generates no pointer event of its own to prompt a re-read — so without
  // this, the mouse's cursor dot/hover preview and any held drag go stale
  // the instant zoom starts and increasingly wrong as it continues,
  // recovering only on the next real pointer event, if any. Treat every
  // animation frame as a pointer event at the same on-screen position,
  // replaying each still-held pointer's last known coordinates (lastClient)
  // against the current, mid-transition geometry, for as long as the
  // transition runs.
  let zoomRafId: number | null = null;

  const retriggerHeldPointers = (): void => {
    for (const [id, point] of lastClient) {
      if (hoverCell.has(id)) {
        positionCursorDot(point);
        refineHoverAt(id, point);
      }
      if (pointerPcs.has(id)) refinePointerAt(id, point);
    }
  };

  surface.addEventListener("transitionrun", (event) => {
    if (event.propertyName !== "--fit-size" || zoomRafId !== null) return;
    const tick = (): void => {
      retriggerHeldPointers();
      zoomRafId = requestAnimationFrame(tick);
    };
    zoomRafId = requestAnimationFrame(tick);
  });

  const stopZoomRetrigger = (event: TransitionEvent): void => {
    if (event.propertyName !== "--fit-size" || zoomRafId === null) return;
    cancelAnimationFrame(zoomRafId);
    zoomRafId = null;
    retriggerHeldPointers(); // land exactly on the final geometry, not the last animation frame's
  };
  surface.addEventListener("transitionend", stopZoomRetrigger);
  surface.addEventListener("transitioncancel", stopZoomRetrigger);

  // Twelve listeners, not one per cap: a pitch class's hexagons are one path,
  // and two adjacent caps never share a pitch class, so crossing any cap
  // boundary is always a crossing between two of these paths — which is what
  // pointerenter needs in order to fire at all.
  for (const path of litByPc.values()) {
    path.addEventListener("pointerdown", (event) => {
      // Touch pointers are implicitly captured to the element pressed;
      // releasing capture is what lets pointerenter fire on the paths a finger
      // drags onto. A pointerdown with no real capture behind it (synthetic
      // events, some browser/device quirks) throws NotFoundError here —
      // harmless, and never worth failing the press over.
      try {
        path.releasePointerCapture(event.pointerId);
      } catch {
        // no capture to release
      }
      pressPointerAt(event.pointerId, path);
      // pressPointerAt knows only the one pitch class SVG hit-tested, so
      // without this a press on a boundary sounds a single note until the
      // pointer first moves — a tap in a seam under-presses, and the hover
      // preview promises a dyad the click then doesn't deliver.
      refinePointerAt(event.pointerId, event, Number(path.dataset.pc));
    });

    path.addEventListener("pointerenter", (event) => {
      // Hover tracks where the cursor is, pressed or not — the two states are
      // not exclusive. `.active` outranks `.hover` in CSS for as long as a
      // press lasts, so the preview underneath is already correct when the
      // press ends, and a pitch class the mouse is still sitting on returns to
      // hover rather than dropping all the way to rest.
      const hitPc = Number(path.dataset.pc);
      if (event.pointerType === "mouse" && !refineHoverAt(event.pointerId, event, hitPc)) {
        hoverElementAt(event.pointerId, path);
      }
      if (!pointerPcs.has(event.pointerId)) return; // hovering, not dragging
      // Refine against this event's own coordinates first. Collapsing straight
      // to the singleton element press — without the refine — would drop a pc
      // still held across a shared edge and immediately re-add it, an audible
      // retrigger every time a drag crosses back and forth over that edge.
      if (!refinePointerAt(event.pointerId, event, hitPc)) pressPointerAt(event.pointerId, path);
    });
  }

  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    surface.addEventListener(type, (event) => releasePointer((event as PointerEvent).pointerId));
  }
  // A lift that happens off the surface entirely never reaches the listeners
  // above; releasePointer is idempotent, so catching it twice is harmless.
  //
  // The lift is also where a touch earns the page its user activation, so it
  // is the first moment the audio device can legally start opening — release
  // first, so a gesture that ended before it opened stays dropped, then ask.
  for (const type of ["pointerup", "pointercancel"]) {
    window.addEventListener(type, (event) => {
      releasePointer((event as PointerEvent).pointerId);
      instrument.unlock();
    });
  }

  // Coordinate path: refines the element hit into the true set of one, two or
  // three pitch classes. jsdom has no layout, so every getBoundingClientRect()
  // is zero-sized and a client-to-twelfths division would be NaN;
  // refinePointerAt guards on rect.width === 0 and does nothing extra — the
  // element path above is still driving everything. See DESIGN.md "Two
  // hit-test paths".
  const hitPcOf = (event: Event): number | undefined => {
    const path = (event.target as Element | null)?.closest?.("[data-pc]");
    return path ? Number((path as HTMLElement).dataset.pc) : undefined;
  };

  // A move refines a press that is already happening; it can never start one.
  // refinePointerAt writes pointerPcs and calls applyPress whether or not the
  // pointer was holding anything, so calling it unguarded made a bare mouse
  // move press — and keep pressing — without a button ever going down. The
  // press starts at pointerdown, so `pointerPcs.has` is the whole test, and it
  // reads the same for touch, which has no unpressed moves to tell apart.
  //
  // buttons === 0 is the other half: a mouse whose lift the page never saw
  // (released over browser chrome, or outside the window) is still recorded as
  // held, and the first move back over the surface is where that becomes
  // knowable. releasePointer is idempotent, so the ordinary case costs nothing.
  surface.addEventListener("pointermove", (event) => {
    const pointerEvent = event as PointerEvent;
    if (pointerEvent.pointerType === "mouse" && pointerEvent.buttons === 0) releasePointer(pointerEvent.pointerId);
    else if (pointerPcs.has(pointerEvent.pointerId)) refinePointerAt(pointerEvent.pointerId, pointerEvent, hitPcOf(event));
    showMouseMarks(pointerEvent);
  });

  // The rest of the mouse's evidence that it is being used. All three bubble,
  // so one listener each on the surface covers the whole lattice;
  // `pointerenter` does not bubble and is handled on the twelve paths, above.
  for (const type of ["pointerover", "pointerdown", "pointerup"]) {
    surface.addEventListener(type, (event) => showMouseMarks(event as PointerEvent));
  }

  surface.addEventListener("pointerleave", (event) => {
    const pointerEvent = event as PointerEvent;
    if (pointerEvent.pointerType !== "mouse") return;
    clearHover(pointerEvent.pointerId);
    cursorDot?.classList.remove("visible");
  });

  // --- keyboard ---

  const heldKeyPcs = new Map<string, number>();

  // Everything a holder could be holding, let go of at once. Two things ask
  // for it: losing the window, and opening the About panel over the surface —
  // in both cases the player's hands are somewhere else and a held note or a
  // lit hover cap would just be stranded.
  const releaseEverything = (): void => {
    instrument.releaseAll();
    voices.releaseAll();
    for (const path of litByPc.values()) path.classList.remove("active", "hover");
    resetActive();
    resetHover();
    pointerPcs.clear();
    pointerCell.clear();
    hoverPcs.clear();
    hoverCell.clear();
    heldKeyPcs.clear();
    cursorDot?.classList.remove("visible");
  };

  // The scrim already keeps the pointer off the caps while the About panel is
  // open; this is the same silence for the keyboard. DESIGN.md "About panel".
  // The zoom buttons sit under the scrim (index.astro's z-index) so it
  // already blocks pointer access while open; this pulls them out of the tab
  // order too, since stacking order says nothing to a screen reader.
  const about = installAboutPanel({
    onOpen: () => {
      releaseEverything();
      zoom.setEnabled(false);
    },
    onClose: () => zoom.setEnabled(true),
  });

  // Where nothing hovers, the key hints start hidden (index.astro): almost
  // nothing that answers to that description has a keyboard. The exception —
  // a phone with one paired — announces itself the only way anything can, by
  // using it. Any key will do; a player who has one is not obliged to guess a
  // mapped letter first. Deliberately not remembered across reloads: a stored
  // answer would outlive the keyboard being unplugged.
  window.addEventListener("keydown", () => document.documentElement.classList.add("has-keyboard"), {
    once: true,
  });

  window.addEventListener("keydown", (event) => {
    if (about.isOpen()) return;
    const node = nodeForCode(event.code);
    if (!node) return; // unmapped keys do nothing
    event.preventDefault();
    dimMouseMarks(); // a key that plays; Tab and the rest leave the preview alone
    if (event.repeat || heldKeyPcs.has(event.code)) return;
    heldKeyPcs.set(event.code, node.pc);
    applyPress(event.code, new Set([node.pc]), new Set());
  });

  window.addEventListener("keyup", (event) => {
    // No early return on an open panel here: a key held as the panel opened
    // is already released by releaseEverything, and one pressed before it
    // opened must still be able to clear its own bookkeeping.
    const p = heldKeyPcs.get(event.code);
    if (p === undefined) return;
    heldKeyPcs.delete(event.code);
    releaseHolder(event.code, new Set([p]));
  });

  // --- zoom keys: '0' resets, '-'/'=' each move one step ---
  //
  // Same about.isOpen() gating and "only preventDefault what's mapped"
  // discipline as the note-key listeners above. One press, one step —
  // same move a button click makes, animated the same way — and holding
  // the key down does nothing further: event.repeat is guarded so only
  // the first keydown of a hold does anything.

  const ZOOM_KEY_ACTION: Record<string, () => void> = {
    Digit0: () => zoom.reset(),
    Minus: () => zoom.stepOut(),
    Equal: () => zoom.stepIn(),
  };

  window.addEventListener("keydown", (event) => {
    if (about.isOpen()) return;
    const action = ZOOM_KEY_ACTION[event.code];
    if (!action) return; // unmapped keys do nothing
    if (event.ctrlKey || event.metaKey) return; // Ctrl/Cmd +/-/0 is the browser's own zoom
    event.preventDefault();
    if (event.repeat) return;
    action();
  });

  window.addEventListener("blur", releaseEverything);
}
