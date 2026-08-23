// The Web Audio side of the seam: turns a ratio into a held voice. All the
// note-choice and timbre math lives in tuning.ts as plain numbers; this file
// is the only place that touches an AudioNode. See DESIGN.md "Synthesis".

import { partialsFor, stackPositionFor } from "./tuning.ts";

const ATTACK_S = 0.015;
const RELEASE_TIME_CONSTANT_S = 0.12;
const STOP_AFTER_S = RELEASE_TIME_CONSTANT_S * 6; // ~720 ms; setTargetAtTime never reaches zero.
const MASTER_GAIN = 0.25;

interface Voice {
  oscillators: OscillatorNode[];
  envelope: GainNode;
}

/** One player's worth of held notes, sharing a lazily-created AudioContext,
 *  master gain and compressor. Voices are keyed by whatever the caller uses
 *  to identify a held gesture (a pointerId, a KeyboardEvent.code, ...). */
export class Instrument {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;
  #voices = new Map<string, Voice>();

  #ensureContext(): { context: AudioContext; master: GainNode } {
    if (!this.#context) {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = MASTER_GAIN;
      const compressor = context.createDynamicsCompressor();
      master.connect(compressor);
      compressor.connect(context.destination);
      this.#context = context;
      this.#master = master;
    }
    // An AudioContext starts suspended; resuming is safe (and a no-op) once
    // running, and DESIGN.md asks for it on every gesture, not just the first.
    void this.#context.resume();
    return { context: this.#context, master: this.#master! };
  }

  /** Start a voice for `id` at `ratio`, unless `id` is already held. */
  noteOn(id: string, ratio: number): void {
    if (this.#voices.has(id)) return;
    const { context, master } = this.#ensureContext();

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.linearRampToValueAtTime(1, context.currentTime + ATTACK_S);
    envelope.connect(master);

    const oscillators = partialsFor(stackPositionFor(ratio)).map(({ freq, amp }) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = freq;

      const partialGain = context.createGain();
      partialGain.gain.value = amp;

      oscillator.connect(partialGain);
      partialGain.connect(envelope);
      oscillator.start();
      return oscillator;
    });

    this.#voices.set(id, { oscillators, envelope });
  }

  /** Release the voice held by `id`, if any. */
  noteOff(id: string): void {
    const voice = this.#voices.get(id);
    if (!voice || !this.#context) return;
    this.#voices.delete(id);

    const context = this.#context;
    const now = context.currentTime;

    // A gesture released inside ATTACK_S leaves the attack's
    // linearRampToValueAtTime scheduled *later* in the automation timeline
    // than this release, and an event later in the timeline still runs: the
    // gain decays for a few milliseconds, the ramp then pulls it back to 1,
    // and there it stays until oscillator.stop() below cuts it at full
    // amplitude. That is the note that hangs on and ends in a click. So drop
    // whatever is still pending and pin the value the envelope has actually
    // reached — gain.value reads the ramp mid-flight — and the release always
    // starts from where the note is rather than from where it was going.
    const gain = voice.envelope.gain;
    const reached = gain.value;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(reached, now);
    gain.setTargetAtTime(0, now, RELEASE_TIME_CONSTANT_S);

    const stopAt = now + STOP_AFTER_S;
    for (const oscillator of voice.oscillators) {
      oscillator.addEventListener("ended", () => oscillator.disconnect());
      oscillator.stop(stopAt);
    }
  }

  /** Release every held voice — DESIGN.md asks for this on window blur. */
  releaseAll(): void {
    for (const id of [...this.#voices.keys()]) this.noteOff(id);
  }
}
