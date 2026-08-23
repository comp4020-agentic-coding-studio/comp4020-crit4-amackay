// A recording stand-in for the Web Audio API.
//
// jsdom implements no audio at all, so the shipped page cannot run under test
// unless something answers to `new AudioContext()`. This is that something: it
// records what the page asks for — contexts resumed, voices started, frequencies
// and gains set — so a test can assert that a gesture produced sound, and that
// two gestures produced *different* sound, without anyone hearing it.
//
// It deliberately implements only what a page can reasonably use. An unknown
// node type throws, loudly, rather than silently recording nothing: a test that
// passes because the fake quietly swallowed the real work is worse than no test.

export interface Started {
  /** The node type the page created, e.g. "oscillator". */
  kind: string;
  /** Values set on the node's AudioParams, most recent last. */
  params: Record<string, number[]>;
  /** The automation methods called on each AudioParam, in order. Values alone
   *  cannot tell an envelope apart from one whose pending ramps were never
   *  cancelled, because both set the same numbers. */
  automation: Record<string, string[]>;
  /** Non-param properties set on the node, e.g. an oscillator's `type`. */
  settings: Record<string, unknown>;
  when: number;
}

export class AudioLog {
  contexts = 0;
  resumes = 0;
  created: Started[] = [];
  started: Started[] = [];
  stopped: Started[] = [];

  /** Every distinct frequency the page has actually sounded. */
  get frequencies(): number[] {
    const all = this.started.flatMap((voice) => voice.params.frequency ?? []);
    return [...new Set(all)];
  }

  /** A coarse fingerprint of everything sounded so far. Two players whose
   *  gestures differ should not produce the same string. */
  get signature(): string {
    return JSON.stringify(
      this.started.map((voice) => [voice.kind, voice.params, voice.settings]),
    );
  }

  reset(): void {
    this.created = [];
    this.started = [];
    this.stopped = [];
  }
}

class FakeParam {
  // Written out longhand rather than as constructor parameter properties:
  // node's strip-only TypeScript mode rejects those, and this repo runs .ts
  // through node directly (scripts/check-evidence.ts, scripts/*).
  readonly #record: Started;
  readonly #name: string;

  constructor(record: Started, name: string, initial: number) {
    this.#record = record;
    this.#name = name;
    this.#record.params[this.#name] = [initial];
  }

  #push(value: number): void {
    (this.#record.params[this.#name] ??= []).push(value);
  }

  #note(method: string): void {
    (this.#record.automation[this.#name] ??= []).push(method);
  }

  get value(): number {
    const seen = this.#record.params[this.#name] ?? [0];
    return seen[seen.length - 1] ?? 0;
  }

  set value(next: number) {
    this.#push(next);
  }

  setValueAtTime(value: number): this {
    this.#note("setValueAtTime");
    this.#push(value);
    return this;
  }
  linearRampToValueAtTime(value: number): this {
    this.#note("linearRampToValueAtTime");
    this.#push(value);
    return this;
  }
  exponentialRampToValueAtTime(value: number): this {
    this.#note("exponentialRampToValueAtTime");
    this.#push(value);
    return this;
  }
  setTargetAtTime(value: number): this {
    this.#note("setTargetAtTime");
    this.#push(value);
    return this;
  }
  cancelScheduledValues(): this {
    this.#note("cancelScheduledValues");
    return this;
  }
}

const PARAMS: Record<string, Record<string, number>> = {
  oscillator: { frequency: 440, detune: 0 },
  gain: { gain: 1 },
  biquadfilter: { frequency: 350, Q: 1, gain: 0, detune: 0 },
  stereopanner: { pan: 0 },
  delay: { delayTime: 0 },
  constantsource: { offset: 1 },
  bufferSource: { playbackRate: 1, detune: 0 },
};

function makeNode(log: AudioLog, kind: string, context: FakeAudioContext) {
  const record: Started = { kind, params: {}, automation: {}, settings: {}, when: 0 };
  log.created.push(record);

  const node: Record<string, unknown> = {
    context,
    connect: (target: unknown) => target,
    disconnect: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    start: (when = context.currentTime) => {
      record.when = when;
      log.started.push(record);
    },
    stop: (when = context.currentTime) => {
      record.when = when;
      log.stopped.push(record);
    },
  };

  for (const [name, initial] of Object.entries(PARAMS[kind] ?? {})) {
    node[name] = new FakeParam(record, name, initial);
  }

  // Anything else the page sets (an oscillator's `type`, a buffer, a curve) is
  // recorded rather than dropped: it is part of what makes two players differ.
  return new Proxy(node, {
    set(target, key, value) {
      if (typeof key === "string" && !(key in target)) {
        record.settings[key] = value;
      }
      target[key as string] = value;
      return true;
    },
  });
}

export class FakeAudioContext {
  state: "suspended" | "running" | "closed" = "suspended";
  currentTime = 0;
  sampleRate = 48000;
  destination: unknown;
  listener = {};

  static log = new AudioLog();

  constructor() {
    FakeAudioContext.log.contexts += 1;
    this.destination = makeNode(FakeAudioContext.log, "destination", this);
  }

  get #log(): AudioLog {
    return FakeAudioContext.log;
  }

  // A real page listens for "statechange" to find out when the audio device
  // has actually opened. Recorded nowhere: what matters to a test is that
  // reaching for it does not throw.
  addEventListener(): void {}
  removeEventListener(): void {}

  // The state flips before the promise is handed back, so a page that starts
  // its voices straight after resume() finds a running clock. A real device
  // can take far longer than that to open, which is its own hazard — the
  // tests that need it stall resume() themselves (src/lib/instrument.test.ts).
  async resume(): Promise<void> {
    this.#log.resumes += 1;
    this.state = "running";
  }
  async suspend(): Promise<void> {
    this.state = "suspended";
  }
  async close(): Promise<void> {
    this.state = "closed";
  }

  createOscillator() {
    return makeNode(this.#log, "oscillator", this);
  }
  createGain() {
    return makeNode(this.#log, "gain", this);
  }
  createBiquadFilter() {
    return makeNode(this.#log, "biquadfilter", this);
  }
  createStereoPanner() {
    return makeNode(this.#log, "stereopanner", this);
  }
  createDelay() {
    return makeNode(this.#log, "delay", this);
  }
  createConstantSource() {
    return makeNode(this.#log, "constantsource", this);
  }
  createBufferSource() {
    return makeNode(this.#log, "bufferSource", this);
  }
  createAnalyser() {
    return makeNode(this.#log, "analyser", this);
  }
  createConvolver() {
    return makeNode(this.#log, "convolver", this);
  }
  createWaveShaper() {
    return makeNode(this.#log, "waveshaper", this);
  }
  createDynamicsCompressor() {
    return makeNode(this.#log, "dynamicscompressor", this);
  }
  createPeriodicWave() {
    return {};
  }
  createBuffer(channels = 1, length = 1) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate: this.sampleRate,
      duration: length / this.sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
  decodeAudioData() {
    return Promise.resolve(this.createBuffer());
  }
}

/** Install the fake on a jsdom window, under every name a page might reach
 *  for, and hand back the log it writes to. */
export function installFakeAudio(window: Window & typeof globalThis): AudioLog {
  const log = new AudioLog();
  FakeAudioContext.log = log;

  const target = window as unknown as Record<string, unknown>;
  target.AudioContext = FakeAudioContext;
  target.webkitAudioContext = FakeAudioContext;
  target.OfflineAudioContext = FakeAudioContext;

  // Constructor-style node creation (`new OscillatorNode(ctx, { … })`) is the
  // modern spelling and just as likely as the factory methods above.
  for (const [name, kind] of [
    ["OscillatorNode", "oscillator"],
    ["GainNode", "gain"],
    ["BiquadFilterNode", "biquadfilter"],
    ["StereoPannerNode", "stereopanner"],
    ["DelayNode", "delay"],
    ["ConstantSourceNode", "constantsource"],
    ["AudioBufferSourceNode", "bufferSource"],
  ] as const) {
    target[name] = class {
      constructor(context: FakeAudioContext, options: Record<string, unknown> = {}) {
        const node = makeNode(log, kind, context) as Record<string, unknown>;
        for (const [key, value] of Object.entries(options)) {
          const param = node[key];
          if (param instanceof FakeParam) param.value = value as number;
          else node[key] = value;
        }
        return node;
      }
    };
  }

  return log;
}
