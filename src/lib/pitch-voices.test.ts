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
    expect(backend.noteOn).toHaveBeenCalledWith("p1:0", equalTemperamentRatioFor(0));
    expect(backend.noteOn).toHaveBeenCalledWith("p1:3", equalTemperamentRatioFor(3));
    expect(backend.noteOn).toHaveBeenCalledWith("p1:7", equalTemperamentRatioFor(7));
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
    expect(backend.noteOff).toHaveBeenCalledWith("p1:7");
    expect(backend.noteOn).toHaveBeenCalledTimes(1);
    expect(backend.noteOn).toHaveBeenCalledWith("p1:8", equalTemperamentRatioFor(8));
  });

  it("gives two holders of the same pitch class a voice each", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    // Two fingers on one cap, or a key and a mouse on the same note.
    voices.press("p1", new Set([0]));
    voices.press("p2", new Set([0]));

    expect(backend.noteOn).toHaveBeenCalledTimes(2);
    expect(backend.noteOn).toHaveBeenCalledWith("p1:0", equalTemperamentRatioFor(0));
    expect(backend.noteOn).toHaveBeenCalledWith("p2:0", equalTemperamentRatioFor(0));
  });

  it("lets one holder go without cutting another's note short", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0]));
    voices.press("p2", new Set([0]));

    voices.release("p1");
    expect(backend.noteOff).toHaveBeenCalledTimes(1);
    expect(backend.noteOff).toHaveBeenCalledWith("p1:0");

    voices.release("p2");
    expect(backend.noteOff).toHaveBeenCalledTimes(2);
    expect(backend.noteOff).toHaveBeenCalledWith("p2:0");
  });

  it("keeps a holder's own voice through a drag another holder shares", () => {
    const backend = fakeBackend();
    const voices = new PitchClassVoices(backend);

    voices.press("p1", new Set([0]));
    voices.press("p2", new Set([0, 4]));
    backend.noteOn.mockClear();
    backend.noteOff.mockClear();

    // p2 slides off the shared tone. p1 is still holding it and must not be
    // disturbed; p2's own voice on it must stop.
    voices.press("p2", new Set([4]));

    expect(backend.noteOff.mock.calls.map((call) => call[0])).toEqual(["p2:0"]);
    expect(backend.noteOn).not.toHaveBeenCalled();
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
    expect(backend.noteOff).toHaveBeenCalledWith("p1:0");
    expect(backend.noteOff).toHaveBeenCalledWith("p2:4");
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
    expect(onIds).toEqual(["p1:7"]);
    expect(offIds).toEqual(["p1:0"]);
  });
});
