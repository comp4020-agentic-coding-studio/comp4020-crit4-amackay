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
  #pending = new Map<string, number>();

  #ensureContext(): { context: AudioContext; master: GainNode } {
    if (!this.#context) {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = MASTER_GAIN;
      const compressor = context.createDynamicsCompressor();
      master.connect(compressor);
      compressor.connect(context.destination);
      // Opening the audio device can outlast the gesture that asked for it,
      // so the state change is a second chance to start whatever is waiting.
      context.addEventListener("statechange", () => this.#startPending());
      this.#context = context;
      this.#master = master;
    }
    // An AudioContext starts suspended; resuming is safe (and a no-op) once
    // running, and DESIGN.md asks for it on every gesture, not just the first.
    void this.#context.resume().then(
      () => this.#startPending(),
      () => undefined,
    );
    return { context: this.#context, master: this.#master! };
  }

  /** Start every gesture that arrived while the context was still suspended.
   *  Callable at any time: it does nothing unless the clock is running. */
  #startPending(): void {
    const context = this.#context;
    const master = this.#master;
    if (!context || !master || context.state !== "running") return;
    const waiting = [...this.#pending];
    this.#pending.clear();
    for (const [id, ratio] of waiting) this.#startVoice(id, ratio, context, master);
  }

  /** Open the audio device if the browser will now permit it.
   *
   *  Chrome grants a page the user activation an `AudioContext` needs on
   *  `pointerdown` only when the pointer is a mouse; for touch it is the lift
   *  that grants it (measured — `scripts/probe-touch-activation.js`). So the
   *  first touch on a page the browser has no engagement with is silent
   *  whatever this code does, and the point of unlocking at the lift is that
   *  the *second* touch is not: the device is already opening by the time it
   *  lands. */
  unlock(): void {
    this.#ensureContext();
  }

  /** Start a voice for `id` at `ratio`, unless `id` is already held. */
  noteOn(id: string, ratio: number): void {
    if (this.#voices.has(id) || this.#pending.has(id)) return;
    const { context, master } = this.#ensureContext();

    // A suspended context's clock is frozen, so a voice scheduled against it
    // lands at whatever absolute time the clock is stuck on — and so does
    // every other voice, and every release, until the audio device finally
    // opens and plays the lot in one burst. That is the first gesture after a
    // reload lighting caps in silence and then blurting at the start of the
    // second. Hold the gesture instead, and start it against a running clock.
    if (context.state !== "running") {
      this.#pending.set(id, ratio);
      return;
    }
    this.#startVoice(id, ratio, context, master);
  }

  #startVoice(id: string, ratio: number, context: AudioContext, master: GainNode): void {
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
    // Held only in the sense of waiting for the audio device: the gesture is
    // over before it ever sounded, so it is dropped rather than started late.
    // A note that arrives after the finger has left is worse than silence.
    if (this.#pending.delete(id)) return;

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
    for (const id of [...this.#voices.keys(), ...this.#pending.keys()]) this.noteOff(id);
  }
}
