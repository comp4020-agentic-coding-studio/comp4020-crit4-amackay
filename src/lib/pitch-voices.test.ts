import { describe, expect, it, vi } from "vitest";
import { equalTemperamentRatioFor } from "./tuning.ts";
import { PitchClassVoices, type VoiceBackend } from "./pitch-voices.ts";

function fakeBackend(): VoiceBackend & {
  noteOn: ReturnType<typeof vi.fn<(id: string, ratio: number) => void>>;
  noteOff: ReturnType<typeof vi.fn<(id: string) => void>>;
} {
  return { noteOn: vi.fn(), noteOff: vi.fn() };
}

describe("PitchClassVoices", () => {
  it("starts one voice per newly-pressed pitch class, at the right ratio", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0, 3, 7]));

    expect(backend.noteOn).toHaveBeenCalledTimes(3);
    expect(backend.noteOn).toHaveBeenCalledWith("pc:0", equalTemperamentRatioFor(0));
    expect(backend.noteOn).toHaveBeenCalledWith("pc:3", equalTemperamentRatioFor(3));
    expect(backend.noteOn).toHaveBeenCalledWith("pc:7", equalTemperamentRatioFor(7));
    expect(backend.noteOff).not.toHaveBeenCalled();
  });

  it("does not retrigger when the same set is pressed again", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0, 3, 7]));
    backend.noteOn.mockClear();
    backend.noteOff.mockClear();

    voices.press("p1", new Set([0, 3, 7]));

    expect(backend.noteOn).not.toHaveBeenCalled();
    expect(backend.noteOff).not.toHaveBeenCalled();
  });

  it("diffs a changed set: releases what's dropped, starts what's added, leaves the rest", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0, 3, 7]));
    backend.noteOn.mockClear();
    backend.noteOff.mockClear();

    voices.press("p1", new Set([0, 3, 8]));

    expect(backend.noteOff).toHaveBeenCalledTimes(1);
    expect(backend.noteOff).toHaveBeenCalledWith("pc:7");
    expect(backend.noteOn).toHaveBeenCalledTimes(1);
    expect(backend.noteOn).toHaveBeenCalledWith("pc:8", equalTemperamentRatioFor(8));
  });

  it("collapses two holders of the same pitch class into one voice", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0]));
    voices.press("p2", new Set([0]));

    expect(backend.noteOn).toHaveBeenCalledTimes(1);

    voices.release("p1");
    expect(backend.noteOff).not.toHaveBeenCalled();

    voices.release("p2");
    expect(backend.noteOff).toHaveBeenCalledTimes(1);
    expect(backend.noteOff).toHaveBeenCalledWith("pc:0");
  });

  it("release() lets go of everything a holder had", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0, 4, 7]));
    backend.noteOff.mockClear();

    voices.release("p1");

    expect(backend.noteOff).toHaveBeenCalledTimes(3);
  });

  it("releaseAll() lets go of every holder", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0]));
    voices.press("p2", new Set([4]));
    backend.noteOff.mockClear();

    voices.releaseAll();

    expect(backend.noteOff).toHaveBeenCalledTimes(2);
    expect(backend.noteOff).toHaveBeenCalledWith("pc:0");
    expect(backend.noteOff).toHaveBeenCalledWith("pc:4");
  });

  it("release() and releaseAll() are no-ops for a holder that pressed nothing", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    expect(() => voices.release("nobody")).not.toThrow();
    expect(() => voices.releaseAll()).not.toThrow();
    expect(backend.noteOn).not.toHaveBeenCalled();
    expect(backend.noteOff).not.toHaveBeenCalled();
  });

  it("orders a diff as releases-then-starts is not required, but every add/drop fires exactly once", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0, 3]));
    backend.noteOn.mockClear();

    voices.press("p1", new Set([3, 7]));

    const onIds = backend.noteOn.mock.calls.map((call) => call[0]);
    const offIds = backend.noteOff.mock.calls.map((call) => call[0]);
    expect(onIds).toEqual(["pc:7"]);
    expect(offIds).toEqual(["pc:0"]);
  });
});
