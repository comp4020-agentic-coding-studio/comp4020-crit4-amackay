// Poses the built page for the share card (agent-browser eval, driven by
// scripts/make-card.sh): title plate hidden, C-E-G-A held.
//
// It also judges its own work. The card is a screenshot, so a pose that
// silently stopped working still produces a PNG and still records a
// fingerprint for it — check-card.ts hashes the surface the card depicts, and
// cannot see the difference between a lit chord and a dark one. This is where
// that difference is visible, so this is where it is checked: make-card.sh
// refuses to shoot unless `ok`.
//
// The chord is chosen by the caps' own labels rather than by keyboard codes or
// pitch-class numbers written here — the QWERTY block can move without the card
// quietly becoming a different chord. Pressing any one cap of a pitch class
// lights every cap of it, so which of the wrapped copies gets the keydown does
// not matter.
(() => {
  const CHORD = ["C", "E", "G", "A"];
  const caps = [...document.querySelectorAll(".cap[data-note]")];
  const named = (name) => caps.find((cap) => cap.querySelector(".name")?.textContent.trim() === name);

  const style = document.createElement("style");
  style.textContent = "[data-about], [data-about-scrim] { display: none !important; }";
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
      problems.push(`no cap labelled ${name}`);
      continue;
    }
    window.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: cap.dataset.note }),
    );
    pressed.push({ name, code: cap.dataset.note, pc: Number(cap.dataset.pc) });
  }

  // Those keydowns are how the page learns a keyboard exists, and it responds
  // by showing the key hints. Nothing pressed this card's keys, so take it
  // back: the card is a picture of the instrument at rest, not of a session.
  document.documentElement.classList.remove("has-keyboard");

  const lit = new Set([...document.querySelectorAll(".cap.active")].map((cap) => cap.dataset.pc));
  const litPitchClasses = [...lit].map(Number).sort((a, b) => a - b);
  const plateHidden = getComputedStyle(document.querySelector("[data-about]")).display === "none";
  const keyHintsShown = [...document.querySelectorAll(".cap .key")].some(
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
  if (keyHintsShown) problems.push("the key hints are still showing");

  return {
    ok: problems.length === 0,
    problems,
    pressed,
    litPitchClasses,
    plateHidden,
    keyHintsShown,
  };
})();
