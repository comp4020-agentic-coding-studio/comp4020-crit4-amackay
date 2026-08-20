// Loads the BUILT page into jsdom with a fake Web Audio API attached, so the
// spec tests drive the artefact that actually ships rather than a module that
// happens to live in src/.
//
// Two things make this less direct than it sounds. Astro emits its scripts as
// `type="module"`, and jsdom executes no module scripts at all; and jsdom has
// no audio, so the page's first `new AudioContext()` would throw. So the loader
// installs the fake first, then runs each shipped script by hand as a classic
// script. A bundled page script has no imports left in it, which is what makes
// that substitution safe.

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
  /** Press, drag and release across the surface, in surface-relative
   *  fractions of its size (0–1), the way a player would. */
  pointer(x: number, y: number, options?: { type?: string }): void;
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
    return existsSync(path) ? [readFileSync(path, "utf8")] : [];
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

  function pointer(x: number, y: number, options: { type?: string } = {}): void {
    const target = surface ?? document.body;
    // jsdom lays nothing out, so a rect is all zeroes; give the surface a
    // plausible one so a page mapping position to pitch sees a real spread.
    const rect = { left: 0, top: 0, width: 1000, height: 600 };
    const init = {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + x * rect.width,
      clientY: rect.top + y * rect.height,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      buttons: 1,
    };
    const Ctor =
      (window as unknown as Record<string, unknown>).PointerEvent ?? window.MouseEvent;
    const make = (type: string) =>
      new (Ctor as typeof window.MouseEvent)(type, init as MouseEventInit);

    for (const type of options.type ? [options.type] : ["pointerdown", "pointermove"]) {
      target.dispatchEvent(make(type));
    }
    if (!options.type) {
      target.dispatchEvent(make("pointerup"));
      // Mouse-only pages listen for these instead; a player pressing a mouse
      // fires both families, so the test should too.
      target.dispatchEvent(make("mousedown"));
      target.dispatchEvent(make("mouseup"));
      target.dispatchEvent(make("click"));
    }
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
    pointer,
    key,
    close: () => dom.window.close(),
  };
}
