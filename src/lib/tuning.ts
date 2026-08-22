// The tuning and timbre math, kept as plain numeric functions so it can be
// tested without an AudioContext. See DESIGN.md "Tuning" and "Synthesis".

export const ROOT_HZ = 349.2282;
export const PARTIAL_COUNT = 8;

function frac(v: number): number {
  return ((v % 1) + 1) % 1;
}

/** Pitch class of a ratio relative to the root (0–1, wraps at the octave).
 *  Drives colour: DESIGN.md's `hue = 25° + 360° · pc`. */
export function pitchClassFor(ratio: number): number {
  return frac(Math.log2(ratio));
}

/** Position of a ratio's pitch class within the fixed 32–8192 Hz partial
 *  stack, in absolute frequency terms — what makes the tone octaveless.
 *  DESIGN.md: `x = frac(log2(349.2282 · ratio / 32))`. */
export function stackPositionFor(ratio: number): number {
  return frac(Math.log2((ROOT_HZ * ratio) / 32));
}

export interface Partial {
  freq: number;
  amp: number;
}

/** Eight octave-spaced sine partials under a fixed Gaussian window in
 *  log-frequency, normalised to sum to 1. DESIGN.md: `f_k = 32 · 2^(x + k)`,
 *  `A_k = exp(−(log2(f_k / 260))² / (2 · 1.5²))`. */
export function partialsFor(stackPosition: number): Partial[] {
  const raw = Array.from({ length: PARTIAL_COUNT }, (_, k) => {
    const freq = 32 * 2 ** (stackPosition + k);
    const amp = Math.exp(-(Math.log2(freq / 260) ** 2) / (2 * 1.5 ** 2));
    return { freq, amp };
  });
  const total = raw.reduce((sum, p) => sum + p.amp, 0);
  return raw.map((p) => ({ freq: p.freq, amp: p.amp / total }));
}

/** Colour hue for a ratio's pitch class. DESIGN.md "Visual design". */
export function hueFor(ratio: number): number {
  return (25 + 360 * pitchClassFor(ratio)) % 360;
}

// Chromatic scale ascending in semitones from the root, F, spelled with flats
// to match DESIGN.md's own fifths-chain naming (Ab Eb Bb F C G D A E). These
// are the names the caps carry.
const CHROMATIC = ["F", "G♭", "G", "A♭", "A", "B♭", "B", "C", "D♭", "D", "E♭", "E"];

/** The nearest 12-tone-equal-temperament name for a ratio's pitch class. */
export function equalTemperamentNameFor(ratio: number): string {
  const index = Math.round(pitchClassFor(ratio) * 12) % 12;
  return CHROMATIC[index]!;
}

/** 12-TET ratio for a semitone index, relative to the same root F as the
 *  just-intonation lattice above, and independent of the 3-limit/5-limit
 *  lattice. Every cap's ratio, hue and name is derived from this. */
export function equalTemperamentRatioFor(semitoneIndex: number): number {
  return 2 ** (semitoneIndex / 12);
}
