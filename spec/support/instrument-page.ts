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
// A single page's bundle used to have no imports left in it, which was what
// made that substitution safe — but once a second page's script shares a lib
// module with this one, Rollup factors the shared code into its own chunk,
// and the entry script starts with a real `import {...} from "./chunk.js"`
// that a classic-script eval can't run. inlineChunkImports() resolves one
// level of that by hand: wrap the chunk's body in an IIFE returning its
// exports, and turn the entry's import into a same-scope destructure of that
// IIFE's result. Each chunk's own (independently minified, so collision-prone)
// identifiers stay sealed inside its own closure this way, rather than being
// flattened into one shared scope where two chunks could easily have each
// picked the same single-letter name for something unrelated.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { type AudioLog, installFakeAudio } from "./fake-audio.ts";

const DIST = resolve("dist");

function inlineChunkImports(source: string, dir: string): string {
  const importRe = /^import\s*\{([^}]*)\}\s*from\s*["']\.\/([^"']+)["'];\s*/;
  const splitAs = (entry: string): [string, string] => {
    const [first, second] = entry.split(/\s+as\s+/).map((s) => s.trim());
    return [first!, second ?? first!];
  };

  let result = source;
  let match: RegExpMatchArray | null = result.match(importRe);
  while (match) {
    const [whole, specifiers, chunkFile] = match as [string, string, string];
    const chunkPath = join(dir, chunkFile);
    if (!existsSync(chunkPath)) break;

    const chunkSource = readFileSync(chunkPath, "utf8");
    const exportMatch = chunkSource.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
    if (!exportMatch) break;

    const chunkBody = chunkSource.slice(0, exportMatch.index);
    // "local as exported, ..." -> { exported: local, ... }
    const exported = exportMatch[1]!
      .split(",")
      .map((entry) => {
        const [local, name] = splitAs(entry);
        return `${name}: ${local}`;
      })
      .join(", ");
    // "exported as local, ..." -> { exported: local, ... }
    const imported = specifiers
      .split(",")
      .map((entry) => {
        const [name, local] = splitAs(entry);
        return `${name}: ${local}`;
      })
      .join(", ");

    const chunkVar = `__chunk_${chunkFile.replace(/[^a-zA-Z0-9]/g, "_")}`;
    result =
      `const ${chunkVar} = (function(){ ${chunkBody} return { ${exported} }; })();\n` +
      `const { ${imported} } = ${chunkVar};\n` +
      result.slice(whole.length);
    match = result.match(importRe);
  }
  return result;
}

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
    return [inlineChunkImports(readFileSync(path, "utf8"), dirname(path))];
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
    return surface?.querySelector(`[data-note="${code}"]`) ?? surface ?? document.body;
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
