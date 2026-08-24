// Poses the built page for the share card (agent-browser eval, driven by
// scripts/make-card.sh): title plate and HUD hidden, C-E-G-A held.
//
// It also judges its own work. The card is a screenshot, so a pose that
// silently stopped working still produces a PNG and still records a
// fingerprint for it — check-card.ts hashes the surface the card depicts, and
// cannot see the difference between a lit chord and a dark one. This is where
// that difference is visible, so this is where it is checked: make-card.sh
// refuses to shoot unless `ok`.
//
// The chord is chosen by pitch-class name rather than by keyboard codes or
// pitch-class numbers written here — the QWERTY block can move without the
// card quietly becoming a different chord.
(() => {
  const CHORD = ["C", "E", "G", "A"];
  const named = (name) => document.querySelector(`.lit [data-name="${name}"]`);

  const style = document.createElement("style");
  style.textContent = "[data-about], [data-about-scrim], [data-hud] { display: none !important; }";
  document.head.append(style);

  // Synthetic events grant no user activation, so the page correctly decides
  // that nothing it does can sound and declines to light a thing (DESIGN.md
  // "Synthesis"). Say what a real press would have said.
  Object.defineProperty(navigator, "userActivation", {
    value: { hasBeenActive: true, isActive: true },
    configurable: true,
  });

  const problems = [];

  const pressed = [];
  for (const name of CHORD) {
    const cap = named(name);
    // Collected rather than returned, so one run reports every fault instead
    // of the first one and then another run for the next.
    if (!cap) {
      problems.push(`no pitch class named ${name}`);
      continue;
    }
    window.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: cap.dataset.notes.split(" ")[0] }),
    );
    pressed.push({ name, code: cap.dataset.notes.split(" ")[0], pc: Number(cap.dataset.pc) });
  }

  // Those keydowns are how the page learns a keyboard exists, and it responds
  // by showing the key hints. Nothing pressed this card's keys, so take it
  // back: the card is a picture of the instrument at rest, not of a session.
  document.documentElement.classList.remove("has-keyboard");

  const lit = new Set([...document.querySelectorAll(".lit .active")].map((cap) => cap.dataset.pc));
  const litPitchClasses = [...lit].map(Number).sort((a, b) => a - b);
  const plateHidden = getComputedStyle(document.querySelector("[data-about]")).display === "none";
  const hudHidden = getComputedStyle(document.querySelector("[data-hud]")).display === "none";
  const keyHintsShown = [...document.querySelectorAll(".labels .key")].some(
    (hint) => getComputedStyle(hint).display !== "none",
  );

  // Every pressed pitch class lit, and nothing else: a press that reached the
  // page but no longer lights (as happened when canSound() landed) reads as an
  // empty set here, and a stray one reads as a chord nobody asked for.
  const wanted = [...new Set(pressed.map((p) => p.pc))].sort((a, b) => a - b);
  if (String(litPitchClasses) !== String(wanted)) {
    problems.push(`lit pitch classes are [${litPitchClasses}], expected [${wanted}]`);
  }
  if (!plateHidden) problems.push("the title plate is still showing");
  if (!hudHidden) problems.push("the HUD is still showing");
  if (keyHintsShown) problems.push("the key hints are still showing");

  return {
    ok: problems.length === 0,
    problems,
    pressed,
    litPitchClasses,
    plateHidden,
    hudHidden,
    keyHintsShown,
  };
})();
