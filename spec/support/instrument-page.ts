// Loads the BUILT page into jsdom with a fake Web Audio API attached, so the
// spec tests drive the artefact that actually ships rather than a module that
// happens to live in src/.
//
// Two things make this less direct than it sounds. Astro emits its scripts as
// `type="module"`, and jsdom executes no module scripts at all; and jsdom has
// no audio, so the page's first `new AudioContext()` would throw. So the loader
// installs the fake first, then runs each shipped script by hand as a classic
// script.
//
// That substitution is safe only because the site is a single page, so Rollup
// leaves the bundle with no imports in it. Add a second page whose script
// shares a lib module with this one and Rollup factors the shared code into
// its own chunk, leaving the entry starting with a real
// `import {...} from "./chunk.js"` that a classic-script eval cannot run. The
// harness used to carry an inlineChunkImports() that unpicked one level of
// that by hand; it went with the Shepard page, and git history has it if a
// second page ever comes back.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { type AudioLog, installFakeAudio } from "./fake-audio.ts";

const DIST = resolve("dist");

/** The handle the tests hold the instrument by. The page must mark its
 *  playable surface with it; everything else about the markup is free. */
export const SURFACE = "[data-instrument]";

export interface LoadedPage {
  window: Window & typeof globalThis;
  document: Document;
  audio: AudioLog;
  /** The playable surface, or null if the page never marked one. */
  surface: Element | null;
  errors: string[];
  /** Press and release the cap carrying `data-note="<code>"`, the way a
   *  player's finger or mouse would. Falls back to the surface itself if no
   *  cap carries that code, standing in for a tap in the gap between keys. */
  press(code: string, options?: { type?: string }): void;
  /** Press `from`, then — pointer still down — `pointerenter` `to` before
   *  releasing there. The drag path DESIGN.md asks a finger to be able to
   *  take across the grid. */
  drag(from: string, to: string): void;
  /** A pointer gesture that lands on no cap at all — the gap between keys, or
   *  outside the grid entirely. */
  missPointer(): void;
  /** Press and release a key, the way a player would. */
  key(code: string, options?: { type?: string }): void;
  close(): void;
}

function scripts(document: Document): string[] {
  return [...document.querySelectorAll("script")].flatMap((element) => {
    const src = element.getAttribute("src");
    if (!src) return element.textContent ? [element.textContent] : [];

    // Only same-origin scripts the build emitted; an external CDN script is
    // not something this page should have anyway.
    if (/^[a-z]+:|^\/\//i.test(src)) return [];
    const path = join(DIST, src.replace(/^.*?\/(?=_astro\/)/, "").replace(/^\//, ""));
    if (!existsSync(path)) return [];
    return [readFileSync(path, "utf8")];
  });
}

export function loadInstrument(page = "index.html"): LoadedPage {
  const html = readFileSync(join(DIST, page), "utf8");

  const dom = new JSDOM(html, {
    // The deployed site lives under the repo-name base path, so resolve
    // relative URLs the way the browser will.
    url: "https://comp4020-agentic-coding-studio.github.io/comp4020-crit4-amackay/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });

  const window = dom.window as unknown as Window & typeof globalThis;
  const document = window.document;
  const errors: string[] = [];
  window.addEventListener("error", (event) => errors.push(String(event)));

  const audio = installFakeAudio(window);

  // jsdom leaves these out, and a page that reaches for either should not fall
  // over in a test for a reason no player would ever hit.
  const globals = window as unknown as Record<string, unknown>;
  globals.matchMedia ??= () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  if (typeof window.Element.prototype.setPointerCapture !== "function") {
    window.Element.prototype.setPointerCapture = () => undefined;
    window.Element.prototype.releasePointerCapture = () => undefined;
  }

  for (const source of scripts(document)) {
    try {
      window.eval(source.replace(/\bexport\s*\{\s*\}\s*;?/g, ""));
    } catch (error) {
      errors.push(String(error));
    }
  }
  document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true }));
  window.dispatchEvent(new window.Event("load"));

  const surface = document.querySelector(SURFACE);

  function capOrSurface(code: string): Element {
    // Whatever element the page says sounds this key. `data-notes` is a
    // space-separated list, since one element can answer for several codes;
    // `data-note` is the single-code form. The page uses one or the other,
    // never both, so the order of the two selectors never has to be decided.
    const target = surface?.querySelector(`[data-notes~="${code}"], [data-note="${code}"]`);
    return target ?? surface ?? document.body;
  }

  const Ctor = (window as unknown as Record<string, unknown>).PointerEvent ?? window.MouseEvent;

  function dispatchPointer(target: Element, type: string, pointerId = 1): void {
    const init = {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: "mouse",
      isPrimary: true,
      buttons: 1,
    };
    target.dispatchEvent(new (Ctor as typeof window.MouseEvent)(type, init as MouseEventInit));
  }

  function press(code: string, options: { type?: string } = {}): void {
    const target = capOrSurface(code);
    for (const type of options.type ? [options.type] : ["pointerdown", "pointerup"]) {
      dispatchPointer(target, type);
    }
    if (!options.type) {
      // Mouse-only pages listen for these instead; a player pressing a mouse
      // fires both families, so the test should too.
      for (const type of ["mousedown", "mouseup", "click"]) {
        target.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }));
      }
    }
  }

  function drag(from: string, to: string): void {
    dispatchPointer(capOrSurface(from), "pointerdown");
    dispatchPointer(capOrSurface(to), "pointerenter");
    dispatchPointer(capOrSurface(to), "pointerup");
  }

  function missPointer(): void {
    const target = surface ?? document.body;
    dispatchPointer(target, "pointerdown");
    dispatchPointer(target, "pointerup");
  }

  function key(code: string, options: { type?: string } = {}): void {
    const init = { bubbles: true, cancelable: true, key: code, code };
    const target = document.activeElement ?? document.body;
    for (const type of options.type ? [options.type] : ["keydown", "keyup"]) {
      target.dispatchEvent(new window.KeyboardEvent(type, init));
    }
  }

  return {
    window,
    document,
    audio,
    surface,
    errors,
    press,
    drag,
    missPointer,
    key,
    close: () => dom.window.close(),
  };
}
