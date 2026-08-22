// A thin refcounting layer above Instrument, keyed by pitch class rather than
// by holder. Instrument keys voices by an opaque string and refuses a
// duplicate noteOn, but its noteOff releases immediately — wrong once two
// pointers (or a pointer and a key) hold the same pitch class. This class
// starts a voice at 0->1 holders and releases it at 1->0. See DESIGN.md
// "Refcounting". Backend-injected so tests need no AudioContext.

import { equalTemperamentRatioFor } from "./tuning.ts";

export interface VoiceBackend {
  noteOn(id: string, ratio: number): void;
  noteOff(id: string): void;
}

export class PitchClassVoices {
  #backend: VoiceBackend;
  #holdersByPc = new Map<number, Set<string>>();
  #pcsByHolder = new Map<string, Set<number>>();

  constructor(backend: VoiceBackend) {
    this.#backend = backend;
  }

  /** Full replace-and-diff for one holder: pitch classes newly in `pcs` start
   *  a voice (if nothing else already held them), pitch classes dropped from
   *  the holder's previous set release one (if nothing else still holds
   *  them), and the intersection is left untouched. This diff is the
   *  signature drag interaction — retriggering a common tone here is the bug
   *  that would make the instrument sound like a grid of buttons again. */
  press(holder: string, pcs: ReadonlySet<number>): void {
    const before = this.#pcsByHolder.get(holder) ?? new Set<number>();

    for (const p of pcs) {
      if (before.has(p)) continue;
      const holders = this.#holdersByPc.get(p) ?? new Set<string>();
      const wasEmpty = holders.size === 0;
      holders.add(holder);
      this.#holdersByPc.set(p, holders);
      if (wasEmpty) this.#backend.noteOn(`pc:${p}`, equalTemperamentRatioFor(p));
    }

    for (const p of before) {
      if (pcs.has(p)) continue;
      this.#releaseOne(holder, p);
    }

    if (pcs.size === 0) this.#pcsByHolder.delete(holder);
    else this.#pcsByHolder.set(holder, new Set(pcs));
  }

  /** `holder` lets go of everything it was holding — pointerup/keyup. */
  release(holder: string): void {
    this.press(holder, new Set());
  }

  /** Every holder lets go — window blur. */
  releaseAll(): void {
    for (const holder of [...this.#pcsByHolder.keys()]) this.release(holder);
  }

  #releaseOne(holder: string, p: number): void {
    const holders = this.#holdersByPc.get(p);
    if (!holders) return;
    holders.delete(holder);
    if (holders.size === 0) {
      this.#holdersByPc.delete(p);
      this.#backend.noteOff(`pc:${p}`);
    }
  }
}
