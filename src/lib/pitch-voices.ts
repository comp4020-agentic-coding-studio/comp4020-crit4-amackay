// One voice per (holder, pitch class). Instrument keys voices by an opaque
// string and refuses a duplicate noteOn, so the id has to carry both halves:
// two fingers on the same cap, or a key and a mouse and a finger on the same
// note, are distinct gestures and each is owed its own voice that starts and
// stops with it. See DESIGN.md "One voice per gesture". Backend-injected so
// tests need no AudioContext.

import { equalTemperamentRatioFor } from "./tuning.ts";

export interface VoiceBackend {
  noteOn(id: string, ratio: number): void;
  noteOff(id: string): void;
}

/** One holder's hold on one pitch class. Holders are pointerIds (digits) or
 *  KeyboardEvent.codes (letters and digits), neither of which can contain a
 *  colon, so this is injective and two holders can never collide on an id. */
function voiceId(holder: string, p: number): string {
  return `${holder}:${p}`;
}

export class PitchClassVoices {
  #backend: VoiceBackend;
  #pcsByHolder = new Map<string, Set<number>>();

  constructor(backend: VoiceBackend) {
    this.#backend = backend;
  }

  /** Full replace-and-diff for one holder: pitch classes newly in `pcs` start
   *  that holder's voice, pitch classes dropped from its previous set release
   *  it, and the intersection is left untouched. This diff is the signature
   *  drag interaction — retriggering a common tone here is the bug that would
   *  make the instrument sound like a grid of buttons again.
   *
   *  Other holders are never consulted. A holder owns its voices outright, so
   *  one letting go can never cut another's note short, and two arriving on
   *  the same pitch class sound twice rather than once. */
  press(holder: string, pcs: ReadonlySet<number>): void {
    const before = this.#pcsByHolder.get(holder) ?? new Set<number>();

    for (const p of pcs) {
      if (!before.has(p)) this.#backend.noteOn(voiceId(holder, p), equalTemperamentRatioFor(p));
    }
    for (const p of before) {
      if (!pcs.has(p)) this.#backend.noteOff(voiceId(holder, p));
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
}
