import { describe, expect, it } from "vitest";
import { equalTemperamentNameFor, hueFor, partialsFor, pitchClassFor, ratioFor, stackPositionFor } from "./tuning.ts";

describe("ratioFor", () => {
  it("is 1/1 at the root", () => {
    expect(ratioFor(0, 0)).toBe(1);
  });

  it("steps a fifth's pitch class per column, per DESIGN.md's a-row", () => {
    expect(pitchClassFor(ratioFor(1, 0))).toBeCloseTo(pitchClassFor(3 / 2), 10);
  });
});

describe("pitchClassFor", () => {
  it("puts the root at pitch class 0", () => {
    expect(pitchClassFor(ratioFor(0, 0))).toBeCloseTo(0, 10);
  });

  it("wraps to the 0-1 range regardless of octave", () => {
    for (const pc of [pitchClassFor(ratioFor(7, 0)), pitchClassFor(ratioFor(-7, 2))]) {
      expect(pc).toBeGreaterThanOrEqual(0);
      expect(pc).toBeLessThan(1);
    }
  });
});

describe("partialsFor", () => {
  it("returns eight partials spanning 32 Hz to 8192 Hz", () => {
    const partials = partialsFor(stackPositionFor(ratioFor(0, 0)));
    expect(partials).toHaveLength(8);
    expect(partials[0]!.freq).toBeGreaterThanOrEqual(32);
    expect(partials[0]!.freq).toBeLessThan(64);
    expect(partials.at(-1)!.freq).toBeGreaterThanOrEqual(4096);
    expect(partials.at(-1)!.freq).toBeLessThan(8192);
  });

  it("normalises amplitudes to sum to 1", () => {
    const total = partialsFor(stackPositionFor(ratioFor(2, 1))).reduce((sum, p) => sum + p.amp, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("equalTemperamentNameFor", () => {
  it("names the root F", () => {
    expect(equalTemperamentNameFor(ratioFor(0, 0))).toBe("F");
  });

  it("names a fifth up C, and a fifth down Bb, matching DESIGN.md's a-row", () => {
    expect(equalTemperamentNameFor(ratioFor(1, 0))).toBe("C");
    expect(equalTemperamentNameFor(ratioFor(-1, 0))).toBe("B♭");
    expect(equalTemperamentNameFor(ratioFor(-3, 0))).toBe("A♭");
    expect(equalTemperamentNameFor(ratioFor(-2, 0))).toBe("E♭");
  });

  it("always returns one of the twelve chromatic names", () => {
    const CHROMATIC = ["F", "G♭", "G", "A♭", "A", "B♭", "B", "C", "D♭", "D", "E♭", "E"];
    for (let a = -3; a <= 5; a += 1) {
      for (let b = -1; b <= 2; b += 1) {
        expect(CHROMATIC).toContain(equalTemperamentNameFor(ratioFor(a, b)));
      }
    }
  });
});

describe("hueFor", () => {
  it("puts the root at 25 degrees", () => {
    expect(hueFor(ratioFor(0, 0))).toBeCloseTo(25, 6);
  });

  it("stays within 0-360", () => {
    for (let a = -3; a <= 6; a += 1) {
      const hue = hueFor(ratioFor(a, 2));
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});
