// The 12-node chromatic "clock face" for the standalone Shepard/12-TET test
// page (shepard.astro) — plain equal temperament, independent of lattice.ts's
// 5-limit just-intonation grid, so the Shepard-tone synthesis can be judged
// on its own terms.

import { equalTemperamentNameFor, equalTemperamentRatioFor, hueFor } from "./tuning.ts";

export interface ClockNode {
  /** KeyboardEvent.code for this position's direct key. */
  code: string;
  /** 0-11, clockwise from 12 o'clock (the root, F). */
  index: number;
  /** Equal-tempered pitch name. */
  label: string;
  ratio: number;
  hue: number;
}

const CODES = [
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
  "KeyY",
  "KeyU",
  "KeyI",
  "KeyO",
  "KeyP",
  "BracketLeft",
  "BracketRight",
];

/** All 12 nodes, clockwise from 12 o'clock. */
export const CLOCK: ClockNode[] = CODES.map((code, index) => {
  const ratio = equalTemperamentRatioFor(index);
  return { code, index, label: equalTemperamentNameFor(ratio), ratio, hue: hueFor(ratio) };
});

const BY_CODE = new Map(CLOCK.map((node) => [node.code, node]));

export function clockNodeFor(code: string): ClockNode | undefined {
  return BY_CODE.get(code);
}

/** Double-mod wraparound built in, so callers never hit JS's sign-preserving
 *  `%` (e.g. `-1 % 12 === -1`, not `11`). */
export function clockNodeAt(index: number): ClockNode {
  return CLOCK[((index % 12) + 12) % 12]!;
}
