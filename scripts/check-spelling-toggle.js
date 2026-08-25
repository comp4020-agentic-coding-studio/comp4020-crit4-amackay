// One-off browser probe (agent-browser eval) for the HUD's spelling toggle:
// the button offers the spelling the caps are *not* in, one click swaps every
// drawn label and the twelve lit paths' data-name, and a window grown after
// the swap comes back in the same row.
(async () => {
  const stage = document.querySelector("[data-instrument]");
  const button = document.querySelector("[data-spelling-toggle]");
  const zoomOut = document.querySelector("[data-zoom-out]");
  const out = {};

  const click = (target) => target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  const names = () => [...new Set([...stage.querySelectorAll(".labels .name")].map((t) => t.textContent.trim()))].sort();
  const litNames = () => [...new Set([...stage.querySelectorAll(".lit [data-name]")].map((p) => p.dataset.name))].sort();
  const accidentals = (list) => list.filter((n) => n.length > 1);

  out.buttonInHud = button?.closest(".hud") !== null;
  out.rightOfInfo =
    button.compareDocumentPosition(document.querySelector("[data-about-toggle]")) & Node.DOCUMENT_POSITION_PRECEDING;
  out.startsFlat = stage.dataset.spelling === "flat";
  out.startGlyph = button.textContent.trim();
  out.startLabel = button.getAttribute("aria-label");
  out.startAccidentals = accidentals(names());
  out.startLitMatch = JSON.stringify(names()) === JSON.stringify(litNames());

  click(button);
  out.sharpAfterClick = stage.dataset.spelling === "sharp";
  out.sharpGlyph = button.textContent.trim();
  out.sharpLabel = button.getAttribute("aria-label");
  out.sharpAccidentals = accidentals(names());
  out.sharpLitMatch = JSON.stringify(names()) === JSON.stringify(litNames());

  // A zoom step grows the drawn window, which rebuilds every label from
  // scratch (surface.ts) — the rebuilt ones must not come back in flats.
  const before = stage.querySelectorAll(".labels .name").length;
  for (let i = 0; i < 7 && stage.querySelectorAll(".labels .name").length === before; i += 1) {
    click(zoomOut);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  out.windowGrew = stage.querySelectorAll(".labels .name").length > before;
  out.spellingSurvivedGrow = accidentals(names()).every((n) => n.includes("♯"));

  click(button);
  out.backToFlat = stage.dataset.spelling === "flat";
  out.flatAgainAccidentals = accidentals(names());

  return out;
})();
