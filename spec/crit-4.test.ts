// This week's published spec, as far as a machine can hold it.
//
// These were written before the instrument existed and are meant to be red
// until it does. What they can reach: that a gesture reaches the audio graph,
// that mouse and keyboard both work, that two players' gestures sound
// different, that nothing sounds unbidden, that no input is refused. What no
// test here can reach: whether it sounds *good*, whether the opening screen
// really invites a stranger, whether a gesture is expressive or exhausting.
// Those are judged by ear at the crit — see CLAUDE.md.
//
// Spec lines covered below: live sound rather than playback; expressive;
// playable by mouse, keyboard or touch; no way to play it wrong.
// Spec lines deliberately NOT faked here: "deployed and live" (CI's deploy job
// verifies the live URL), "the repo shows the process" (`pnpm check:evidence`),
// "a stranger can play it uninstructed" and "you can account for how you
// directed the work" (both human, at the crit).

import { existsSync, readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { SURFACE, loadInstrument, type LoadedPage } from "./support/instrument-page.ts";

const DIST = resolve("dist");

function shipped(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? shipped(path)
      : [relative(DIST, path).split(sep).join("/")];
  });
}

let page: LoadedPage | undefined;

function open(): LoadedPage {
  page = loadInstrument();
  return page;
}

afterEach(() => {
  page?.close();
  page = undefined;
});

describe("the browser is the instrument", () => {
  it("ships no recorded audio to play back", () => {
    const media = shipped().filter((name) => /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(name));
    expect(
      media,
      "the sound has to be made in the page, not played back from a file",
    ).toEqual([]);
  });

  it("has no media element standing in for synthesis", () => {
    const doc = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;
    expect(
      doc.querySelector("audio, video"),
      "a media element is playback, not an instrument",
    ).toBeNull();
  });

  it("marks a playable surface for a player to reach", () => {
    const { surface } = open();
    expect(
      surface,
      `nothing in the built page carries ${SURFACE}, so there is nothing to play — mark the playable surface with it`,
    ).not.toBeNull();
  });

  it("stays silent until the player acts", () => {
    const { audio } = open();
    expect(
      audio.started,
      "the autoplay policy aside, a page that sounds before the first gesture is a page that ambushes its player",
    ).toEqual([]);
  });

  it("makes sound live, through the Web Audio graph", () => {
    const { audio, errors } = open();
    audio.reset();
    page?.press("KeyF");

    expect(errors, "the page threw while being played").toEqual([]);
    expect(audio.contexts, "no AudioContext was ever created").toBeGreaterThan(0);
    expect(
      audio.started.length,
      "a pointer gesture on a cap started no voice",
    ).toBeGreaterThan(0);
  });

  it("resumes the suspended context on the player's first gesture", () => {
    const { audio } = open();
    page?.press("KeyF");
    expect(
      audio.resumes,
      "an AudioContext starts suspended; without resume() on a user gesture the page is silent in a real browser",
    ).toBeGreaterThan(0);
  });
});

describe("playable with whatever is at hand", () => {
  it("plays from the pointer, so mouse and touch both work", () => {
    const { audio } = open();
    audio.reset();
    page?.press("KeyG");
    expect(audio.started.length, "no voice from a pointer gesture").toBeGreaterThan(0);
  });

  it("plays the caps a finger drags across", () => {
    const { audio } = open();
    audio.reset();
    page?.drag("KeyA", "KeyL");
    expect(
      audio.started.length,
      "a drag across two caps should start two voices, not one continuous one",
    ).toBeGreaterThan(8);
    expect(
      audio.frequencies.length,
      "dragging onto a different cap should sound different partials, not repeat the first cap's",
    ).toBeGreaterThan(8);
  });

  it("plays from the keyboard", () => {
    const { audio } = open();
    audio.reset();
    for (const code of ["KeyA", "KeyS", "KeyD", "Space", "ArrowUp"]) {
      page?.key(code);
    }
    expect(
      audio.started.length,
      "no key made a sound; the spec asks for mouse, keyboard OR touch to all be viable",
    ).toBeGreaterThan(0);
  });

  it("lets a finger drag without the page scrolling out from under it", () => {
    const css = shipped()
      .filter((name) => name.endsWith(".css"))
      .map((name) => readFileSync(join(DIST, name), "utf8"))
      .join("\n");
    const inline = [...new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document.querySelectorAll("style")]
      .map((style) => style.textContent ?? "")
      .join("\n");

    expect(
      `${css}\n${inline}`,
      "without touch-action, dragging on a phone scrolls the page instead of playing the instrument",
    ).toMatch(/touch-action\s*:/);
  });
});

describe("it is expressive", () => {
  it("sounds different when the player does something different", () => {
    const { audio } = open();

    audio.reset();
    page?.press("KeyZ");
    const low = audio.signature;

    audio.reset();
    page?.press("Digit9");
    const high = audio.signature;

    expect(low, "the first gesture made no sound to compare").not.toBe("[]");
    expect(
      high,
      "two very different gestures produced identical sound — the player's choices have to shape what they hear",
    ).not.toBe(low);
  });

  it("gives two players enough room to sound unalike", () => {
    const { audio } = open();
    audio.reset();

    // Ten different caps stand in for two players who don't play the same.
    const codes = [
      "Digit1", "KeyQ", "KeyA", "KeyZ", "Digit5",
      "KeyU", "KeyH", "KeyN", "Digit9", "KeyL",
    ];
    for (const code of codes) {
      page?.press(code);
    }
    const distinct = new Set(audio.started.map((voice) => JSON.stringify(voice)));

    expect(
      distinct.size,
      "ten different gestures collapsed to fewer than three distinct sounds; two players would be indistinguishable",
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("there is no way to play it wrong", () => {
  it("refuses nothing a player can do", () => {
    const { audio, errors } = open();
    audio.reset();

    // Everything a curious stranger does in the first ten seconds: mash keys,
    // scrub the edges, press between caps or outside the grid, drag around,
    // release without pressing.
    for (const code of ["KeyQ", "Escape", "F5", "Tab", "Enter", "Digit9", "ShiftLeft"]) {
      page?.key(code);
    }
    for (const code of ["Digit1", "KeyL", "KeyZ", "Period", "NoSuchCap"]) {
      page?.press(code);
    }
    page?.missPointer();
    page?.drag("KeyA", "NoSuchCap");
    page?.press("KeyA", { type: "pointerup" });

    expect(errors, "some input made the page throw; a thrown error is a way to play it wrong").toEqual([]);
  });

  it("keeps no score and has no fail state", () => {
    const html = readFileSync(join(DIST, "index.html"), "utf8");
    // Astro sometimes inlines the page script and sometimes (once a second
    // page shares lib code with this one) externalises it into its own file
    // — check both, so a forbidden word hiding in an identifier isn't
    // invisible here just because the build happened to split it out.
    const doc = new JSDOM(html).window.document;
    const scripts = [...doc.querySelectorAll("script[src]")]
      .map((el) => el.getAttribute("src")!)
      .filter((src) => !/^[a-z]+:|^\/\//i.test(src))
      .map((src) => join(DIST, src.replace(/^.*?\/(?=_astro\/)/, "").replace(/^\//, "")))
      .filter((path) => existsSync(path))
      .map((path) => readFileSync(path, "utf8"));

    expect(
      [html, ...scripts].join("\n"),
      "the page ships scoring or failure vocabulary; the spec asks for neither",
    ).not.toMatch(/\b(score|game over|you lose|wrong note|try again|streak|high ?score)\b/i);
  });
});
