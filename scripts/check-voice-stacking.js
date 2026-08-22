// One-off browser probe (agent-browser eval) for stacked voices: counts real
// oscillators to check that two holders of the same pitch class each get their
// own voice, and that one letting go does not cut the other short. Each voice
// is one Shepard stack of partials, so oscillator counts move in whole stacks.
(() => {
  const proto = window.AudioContext.prototype;
  if (!proto.__probed) {
    const createOscillator = proto.createOscillator;
    proto.createOscillator = function (...args) {
      const oscillator = createOscillator.apply(this, args);
      window.__made = (window.__made ?? 0) + 1;
      const stop = oscillator.stop.bind(oscillator);
      oscillator.stop = (...stopArgs) => {
        window.__stopped = (window.__stopped ?? 0) + 1;
        return stop(...stopArgs);
      };
      return oscillator;
    };
    proto.__probed = true;
  }
  window.__made = 0;
  window.__stopped = 0;

  const surface = document.querySelector("[data-instrument]");
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { type, code, key: code, bubbles: true }));
  const pointer = (target, type, pointerId) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: !/^pointer(enter|leave)$/.test(type),
        cancelable: true,
        pointerId,
        pointerType: "touch",
        isPrimary: pointerId === 1,
        buttons: 1,
      }),
    );

  const capA = surface.querySelector('[data-note="KeyA"]'); // Eb
  const capG = surface.querySelector('[data-note="KeyG"]'); // Eb again, a period away
  const out = { pcA: capA.dataset.pc, pcG: capG.dataset.pc };
  const made = () => window.__made;

  // 1. One key down: one voice.
  key("keydown", "KeyA");
  out.afterKey = made();

  // 2. A second key on the SAME pitch class: a second voice, not a no-op.
  key("keydown", "KeyG");
  out.afterSecondKey = made();

  // 3. Two touch pointers on that same cap: two more voices.
  pointer(capA, "pointerdown", 11);
  out.afterFirstTouch = made();
  pointer(capA, "pointerdown", 12);
  out.afterSecondTouch = made();

  // 4. One holder lets go; the others must keep sounding.
  const stoppedBefore = window.__stopped;
  pointer(capA, "pointerup", 11);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 11, pointerType: "touch", bubbles: true }));
  out.stoppedByOneLift = window.__stopped - stoppedBefore;
  out.litAfterOneLift = document.querySelectorAll(`.cap.active[data-pc="${capA.dataset.pc}"]`).length > 0;

  // Clean up so the probe leaves nothing sounding.
  key("keyup", "KeyA");
  key("keyup", "KeyG");
  pointer(capA, "pointerup", 12);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 12, pointerType: "touch", bubbles: true }));
  out.litAtEnd = document.querySelectorAll(".cap.active").length;

  return JSON.stringify(out);
})();
