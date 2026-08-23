#!/usr/bin/env node
// The share card's staleness sensor, and the recorder that clears it.
//
// public/card.png is a screenshot, so it goes stale silently whenever the
// surface changes. This hashes the things that decide what that screenshot
// looks like — the built page's CSS, and the playing surface's own markup —
// and compares against the fingerprint recorded when the card was last made.
//
// `--write` records the current fingerprint instead of checking it;
// scripts/make-card.sh calls it that way, immediately after taking the shot.
//
// Two properties worth knowing:
//  - The About panel's *copy* is not hashed (the card is posed with the plate
//    hidden), so editing it never trips this. Its *styles* are, since they
//    share the page's one <style> block: a false positive there costs one
//    `pnpm card` run, which is the direction to be wrong in.
//  - It reads dist/, so it skips rather than fails when there is no build.
//    CI builds before it runs `check:evidence`, so the gate still holds there.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const DIST = resolve("dist");
const CARD = resolve("public/card.png");
const FINGERPRINT = resolve("scripts/card.fingerprint");
const CARD_SIZE = [1200, 630] as const;

function distFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? distFiles(path) : [relative(DIST, path).split(sep).join("/")];
  });
}

/** What the card looks like, as one hash: every stylesheet the built page
 *  ships, plus the playing surface's markup (which carries the geometry, the
 *  per-cap hues and the sizing custom properties). */
export function fingerprint(): string {
  const doc = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

  const inline = [...doc.querySelectorAll("style")].map((style) => style.textContent ?? "");
  const external = distFiles()
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(DIST, name), "utf8"));
  const surface = doc.querySelector("[data-instrument]")?.outerHTML ?? "";

  // Stylesheet filenames carry a content hash, so they move whenever their
  // contents do; sorting the *hashes* keeps the order stable instead.
  const parts = [...inline, ...external]
    .map((text) => createHash("sha256").update(text).digest("hex"))
    .sort();

  return createHash("sha256").update([...parts, surface].join("\n")).digest("hex");
}

/** [width, height] out of a PNG's IHDR, so a card shot at the wrong viewport
 *  is caught as well as one shot at the wrong time. */
function pngSize(path: string): [number, number] {
  const header = readFileSync(path).subarray(16, 24);
  return [header.readUInt32BE(0), header.readUInt32BE(4)];
}

function main(): void {
  const write = process.argv.includes("--write");

  if (!existsSync(join(DIST, "index.html"))) {
    console.warn("! no dist/index.html — build first; skipping the card check");
    return;
  }

  if (write) {
    writeFileSync(FINGERPRINT, `${fingerprint()}\n`);
    console.log("✓ recorded the card's fingerprint");
    return;
  }

  const fail = (msg: string): never => {
    console.error(`✗ ${msg}`);
    process.exit(1);
  };

  if (!existsSync(CARD)) fail("no public/card.png — the share card is missing. Run: pnpm card");
  if (!existsSync(FINGERPRINT)) {
    fail("public/card.png has no recorded fingerprint, so staleness can't be told. Run: pnpm card");
  }

  const [width, height] = pngSize(CARD);
  if (width !== CARD_SIZE[0] || height !== CARD_SIZE[1]) {
    fail(`public/card.png is ${width}×${height}, not ${CARD_SIZE[0]}×${CARD_SIZE[1]}. Run: pnpm card`);
  }

  const recorded = readFileSync(FINGERPRINT, "utf8").trim();
  if (recorded !== fingerprint()) {
    fail("public/card.png is stale — the surface has changed since it was taken. Run: pnpm card");
  }

  console.log("✓ public/card.png: still the surface it was taken from");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
