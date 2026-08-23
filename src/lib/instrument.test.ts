// instrument.ts is the one file that touches an AudioNode, so it is tested
// through the same recording fake the spec suite uses rather than left
// untested behind the seam. What is checkable here is the *shape* of the
// envelope automation — the order the events are scheduled in. Whether the
// result sounds like a release still needs ears.
import { beforeEach, describe, expect, it } from "vitest";
import { type AudioLog, FakeAudioContext, installFakeAudio } from "../../spec/support/fake-audio.ts";
import { Instrument } from "./instrument.ts";

let log: AudioLog;

beforeEach(() => {
  log = installFakeAudio(globalThis as unknown as Window & typeof globalThis);
});

/** The envelope is the only gain node whose gain is automated: the master and
 *  the per-partial gains are both set once, through the plain value setter. */
function envelopeAutomation(): string[] {
  const automated = log.created.filter((node) => node.kind === "gain" && node.automation.gain);
  expect(automated).toHaveLength(1);
  return automated[0]!.automation.gain!;
}

describe("noteOff", () => {
  it("cancels the pending attack before starting the release", () => {
    // Released inside ATTACK_S — the case a fast swipe across caps produces.
    // Without the cancel the attack ramp is still scheduled *after* this
    // release, so it runs, pulls the gain back to full and holds it there
    // until oscillator.stop() cuts it: the note hangs on and ends in a click.
    const instrument = new Instrument();
    instrument.noteOn("0:7", 1.5);
    instrument.noteOff("0:7");

    const events = envelopeAutomation();
    const attack = events.indexOf("linearRampToValueAtTime");
    const cancel = events.indexOf("cancelScheduledValues");
    const release = events.lastIndexOf("setTargetAtTime");

    expect(attack).toBeGreaterThanOrEqual(0);
    expect(cancel).toBeGreaterThan(attack);
    expect(release).toBeGreaterThan(cancel);
    // Nothing may be left scheduled after the release, or it will run too.
    expect(events.slice(release + 1)).toEqual([]);
  });

  it("pins the value the envelope has reached, so the release starts from there", () => {
    const instrument = new Instrument();
    instrument.noteOn("0:7", 1.5);
    instrument.noteOff("0:7");

    const events = envelopeAutomation();
    const cancel = events.indexOf("cancelScheduledValues");
    // A bare cancel would leave the gain wherever the cancelled events left
    // it; the pin is what makes the release continuous from the attack.
    expect(events[cancel + 1]).toBe("setValueAtTime");
    expect(events[cancel + 2]).toBe("setTargetAtTime");
  });

  it("releases a held note the same way once the attack has finished", () => {
    // Nothing about the fix may depend on the release being early: the same
    // cancel-and-pin has to be harmless for a note held past ATTACK_S.
    const instrument = new Instrument();
    instrument.noteOn("a:0", 1);
    const held = envelopeAutomation().length;
    instrument.noteOff("a:0");

    expect(envelopeAutomation().slice(held)).toEqual([
      "cancelScheduledValues",
      "setValueAtTime",
      "setTargetAtTime",
    ]);
  });
});

/** A context whose audio device takes its time, which is what a real one does
 *  on the first gesture after a reload. FakeAudioContext.resume() flips the
 *  state before it returns, so nothing else here can reach the wait. */
class StalledContext extends FakeAudioContext {
  static waiting: (() => void)[] = [];

  override async resume(): Promise<void> {
    if (this.state === "running") return;
    await new Promise<void>((settle) => StalledContext.waiting.push(settle));
  }

  /** The device opens: every resume() so far resolves. */
  static open(): Promise<void> {
    for (const context of StalledContext.instances) context.state = "running";
    const settling = StalledContext.waiting;
    StalledContext.waiting = [];
    for (const settle of settling) settle();
    return Promise.resolve();
  }

  static instances: StalledContext[] = [];
  constructor() {
    super();
    StalledContext.instances.push(this);
  }
}

describe("a context that is still opening", () => {
  beforeEach(() => {
    StalledContext.waiting = [];
    StalledContext.instances = [];
    (globalThis as unknown as Record<string, unknown>).AudioContext = StalledContext;
  });

  it("schedules nothing against a clock that is not running", async () => {
    // The whole bug: a suspended context's currentTime is frozen, so voices
    // scheduled against it stack up at one absolute time and play together
    // the moment the device opens.
    const instrument = new Instrument();
    instrument.noteOn("0:7", 1.5);
    await Promise.resolve();

    expect(log.started, "a voice was scheduled while the context was suspended").toHaveLength(0);
  });

  it("starts a note still held when the device opens", async () => {
    const instrument = new Instrument();
    instrument.noteOn("0:7", 1.5);
    await StalledContext.open();
    await Promise.resolve();

    expect(log.started.length, "the held note never started").toBeGreaterThan(0);
  });

  it("drops a note let go of before the device opened", async () => {
    // Starting it late would sound after the finger had left — a blurt at the
    // top of the next gesture is exactly the reported symptom.
    const instrument = new Instrument();
    instrument.noteOn("0:7", 1.5);
    instrument.noteOff("0:7");
    await StalledContext.open();
    await Promise.resolve();

    expect(log.started, "a released gesture sounded anyway").toHaveLength(0);
  });

  it("still refuses a duplicate while a note is waiting", async () => {
    const instrument = new Instrument();
    instrument.noteOn("0:7", 1.5);
    instrument.noteOn("0:7", 1.5);
    await StalledContext.open();
    await Promise.resolve();

    const partials = log.started.filter((node) => node.kind === "oscillator");
    expect(partials.length, "one gesture, one stack of partials").toBe(8);
  });
});

/** Stand in for `navigator.userActivation`, which node has no notion of.
 *  `undefined` removes it, which is what an older browser looks like. */
function withActivation(hasBeenActive: boolean | undefined, body: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value: hasBeenActive === undefined ? {} : { userActivation: { hasBeenActive, isActive: hasBeenActive } },
    configurable: true,
  });
  try {
    body();
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
  }
}

describe("canSound", () => {
  beforeEach(() => {
    StalledContext.waiting = [];
    StalledContext.instances = [];
    (globalThis as unknown as Record<string, unknown>).AudioContext = StalledContext;
  });

  it("is false while the context is shut and the page has never been activated", () => {
    // A first touch: the press itself grants nothing, so this gesture cannot
    // be heard however long it is held.
    withActivation(false, () => {
      expect(new Instrument().canSound()).toBe(false);
    });
  });

  it("is true once the page has been activated, before the device has opened", () => {
    // A first mouse press or keypress carries its own activation, so the
    // device will open and the note will sound — a beat late at worst.
    withActivation(true, () => {
      expect(new Instrument().canSound()).toBe(true);
    });
  });

  it("is true for a context the browser let start on its own", async () => {
    // High media engagement (a dev server played all week): permitted with no
    // activation at all, so activation alone would be the wrong question.
    const instrument = new Instrument();
    withActivation(false, () => instrument.canSound());
    await StalledContext.open();

    withActivation(false, () => {
      expect(instrument.canSound(), "a running context sounds whatever activation says").toBe(true);
    });
  });

  it("stays true once true", () => {
    const instrument = new Instrument();
    withActivation(true, () => instrument.canSound());
    withActivation(false, () => {
      expect(instrument.canSound(), "activation is sticky; this must not flap").toBe(true);
    });
  });

  it("assumes sound where the browser cannot be asked", () => {
    withActivation(undefined, () => {
      expect(new Instrument().canSound()).toBe(true);
    });
  });
});
