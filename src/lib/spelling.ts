// The accidental spelling toggle: one HUD button (index.astro) that swaps
// every cap's pitch name between the flat and sharp rows. See DESIGN.md
// "Spelling".
//
// The state lives on the stage as `data-spelling`, not in a variable here,
// because surface.ts's grow() rebuilds every label from scratch on a resize
// or a zoom step and has to build them in whatever spelling is showing —
// same "one number, read back off the element" idiom zoom.ts uses for
// --fit-size.
//
// `const` arrow functions rather than `function` declarations, per the Annex B
// hoisting hazard that bit main.ts twice (CLAUDE.md, "Two build quirks").

import { respellName, type Spelling } from "./tuning.ts";

/** The glyph a button offers, which is the spelling it switches *to* — flats
 *  showing, the button offers a sharp. */
const GLYPH: Record<Spelling, string> = { flat: "♭", sharp: "♯" };
const ACTION_LABEL: Record<Spelling, string> = { flat: "Show flats", sharp: "Show sharps" };

export interface SpellingControl {
  /** The spelling currently on the caps. */
  current: () => Spelling;
  /** Pull the button out of the tab order (About panel open) or back in
   *  (closed), exactly as zoom.ts does for the zoom pair: the scrim covers it
   *  visually and intercepts its clicks, but stacking order says nothing to a
   *  screen reader. */
  setEnabled: (enabled: boolean) => void;
}

export const spellingOf = (stage: Element | null): Spelling =>
  stage?.getAttribute("data-spelling") === "sharp" ? "sharp" : "flat";

export const installSpelling = (): SpellingControl => {
  const stage = document.querySelector<HTMLElement>("[data-instrument]");
  const button = document.querySelector<HTMLButtonElement>("[data-spelling-toggle]");
  if (!stage || !button) return { current: () => "flat", setEnabled: () => {} };

  const current = (): Spelling => spellingOf(stage);

  // The button always offers the spelling the caps are *not* in, so it reads
  // as an offer rather than a readout of the current state.
  const showOffer = (spelling: Spelling): void => {
    const other: Spelling = spelling === "flat" ? "sharp" : "flat";
    button.textContent = GLYPH[other];
    button.setAttribute("aria-label", ACTION_LABEL[other]);
  };

  const apply = (spelling: Spelling): void => {
    stage.setAttribute("data-spelling", spelling);

    // Every drawn cap's name, plus the twelve lit paths' data-name. The labels
    // are per-cap elements (the one layer that is), so this is the only thing
    // on the page priced by the zoom — a click, not a gesture, and the caps'
    // own state is untouched, so nothing that sounds a note pays for it.
    //
    // Each label is respelled from what it already says, so nothing here has
    // to know a cap's pitch class. Trimmed first: the ones the page shipped
    // carry Astro's own indentation around the name, which SVG collapses when
    // it draws them but a string lookup would not.
    for (const label of stage.querySelectorAll(".labels .name")) {
      label.textContent = respellName((label.textContent ?? "").trim(), spelling);
    }
    for (const path of stage.querySelectorAll(".lit path[data-name]")) {
      path.setAttribute("data-name", respellName(path.getAttribute("data-name") ?? "", spelling));
    }

    showOffer(spelling);
  };

  // Load does not touch a single label: the page ships in the spelling
  // `data-spelling` already claims, so only the button needs stating.
  showOffer(current());
  button.addEventListener("click", () => apply(current() === "flat" ? "sharp" : "flat"));

  return {
    current,
    setEnabled: (enabled: boolean): void => {
      button.tabIndex = enabled ? 0 : -1;
    },
  };
};
