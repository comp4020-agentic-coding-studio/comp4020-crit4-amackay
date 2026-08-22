import { describe, expect, it } from "vitest";
import {
  equalTemperamentNameFor,
  equalTemperamentRatioFor,
  hueFor,
  partialsFor,
  pitchClassFor,
  stackPositionFor,
} from "./tuning.ts";

describe("pitchClassFor", () => {
  it("puts the root at pitch class 0", () => {
    expect(pitchClassFor(1)).toBeCloseTo(0, 10);
  });

  it("wraps to the 0-1 range regardless of octave", () => {
    for (const pc of [pitchClassFor(3 ** 7), pitchClassFor(3 ** -7 * 5 ** 2)]) {
      expect(pc).toBeGreaterThanOrEqual(0);
      expect(pc).toBeLessThan(1);
    }
  });
});

describe("partialsFor", () => {
  it("returns eight partials spanning 32 Hz to 8192 Hz", () => {
    const partials = partialsFor(stackPositionFor(1));
    expect(partials).toHaveLength(8);
    expect(partials[0]!.freq).toBeGreaterThanOrEqual(32);
    expect(partials[0]!.freq).toBeLessThan(64);
    expect(partials.at(-1)!.freq).toBeGreaterThanOrEqual(4096);
    expect(partials.at(-1)!.freq).toBeLessThan(8192);
  });

  it("normalises amplitudes to sum to 1", () => {
    const total = partialsFor(stackPositionFor(3 ** 2 * 5 ** 1)).reduce((sum, p) => sum + p.amp, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("equalTemperamentNameFor", () => {
  it("names the root F", () => {
    expect(equalTemperamentNameFor(1)).toBe("F");
  });

  it("names a fifth up C, and a fifth down Bb, matching DESIGN.md's q-row", () => {
    expect(equalTemperamentNameFor(3)).toBe("C");
    expect(equalTemperamentNameFor(1 / 3)).toBe("B♭");
    expect(equalTemperamentNameFor(3 ** -3)).toBe("A♭");
    expect(equalTemperamentNameFor(3 ** -2)).toBe("E♭");
  });

  it("always returns one of the twelve chromatic names", () => {
    const CHROMATIC = ["F", "G♭", "G", "A♭", "A", "B♭", "B", "C", "D♭", "D", "E♭", "E"];
    for (let a = -3; a <= 5; a += 1) {
      for (let b = -1; b <= 2; b += 1) {
        expect(CHROMATIC).toContain(equalTemperamentNameFor(3 ** a * 5 ** b));
      }
    }
  });
});

describe("equalTemperamentRatioFor", () => {
  it("is 1/1 at index 0", () => {
    expect(equalTemperamentRatioFor(0)).toBe(1);
  });

  it("is exactly a semitone-scaled power of two", () => {
    expect(equalTemperamentRatioFor(12)).toBeCloseTo(2, 10);
    expect(equalTemperamentRatioFor(7)).toBeCloseTo(2 ** (7 / 12), 10);
  });

  // The Shepard/12-TET test page labels each of its 12 buttons by composing
  // this with equalTemperamentNameFor rather than exporting CHROMATIC
  // separately — this pins that composition down as a guaranteed contract.
  it("composes with equalTemperamentNameFor to name all twelve semitones, in order, from the root", () => {
    const names = Array.from({ length: 12 }, (_, i) => equalTemperamentNameFor(equalTemperamentRatioFor(i)));
    expect(names).toEqual(["F", "G♭", "G", "A♭", "A", "B♭", "B", "C", "D♭", "D", "E♭", "E"]);
    expect(new Set(names).size).toBe(12);
  });
});

describe("hueFor", () => {
  it("puts the root at 25 degrees", () => {
    expect(hueFor(1)).toBeCloseTo(25, 6);
  });

  it("stays within 0-360", () => {
    for (let a = -3; a <= 6; a += 1) {
      const hue = hueFor(3 ** a * 5 ** 2);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});
