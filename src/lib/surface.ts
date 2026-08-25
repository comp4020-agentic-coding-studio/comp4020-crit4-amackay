// Resizing the drawn window at runtime. The page ships a small lattice — big
// enough for the load state at any sane viewport shape, so the first paint is
// right before any script runs — and this grows it when the viewport or the
// zoom asks for more. See DESIGN.md "The drawn window is not a constant".
//
// The twelve lit paths and the seam path are never replaced, only re-`d`-ed:
// they carry the played state, the pointer listeners and any running restrike,
// and a note held across a resize has to stay held. Only the labels, which
// carry nothing, are rebuilt.

import { capPaths, drawnCells, nodeForCell, requiredExtent, viewBoxFor, windowSizeFor } from "./tonnetz.ts";
import { equalTemperamentNameFor, equalTemperamentRatioFor } from "./tuning.ts";
import { spellingOf } from "./spelling.ts";

const shortKey = (code: string): string => code.replace(/^Key|^Digit/, "");

/** Grow-only, and in whole twelfths: a drag-resize fires continuously, and a
 *  window that shrank back would rebuild on every pixel. Rounding up to a step
 *  also means a slow drag crosses a threshold a few times rather than
 *  hundreds. */
const STEP = 8;

export function extentStepFor(fitSize: number, ratio: number): number {
  return Math.ceil(requiredExtent(fitSize, ratio) / STEP) * STEP;
}

export interface Surface {
  /** Resize the drawn window to hold `extent` twelfths either side of the
   *  camera. Returns false when the window already covers it. */
  grow: (extent: number) => boolean;
  /** The half-side currently drawn. */
  extent: () => number;
}

export function installSurface(stage: HTMLElement, initialExtent: number): Surface {
  const svg = stage.querySelector<SVGSVGElement>("svg");
  const lit = svg?.querySelector<SVGGElement>(".lit");
  const seams = svg?.querySelector<SVGPathElement>(".seams");
  const labels = svg?.querySelector<SVGGElement>(".labels");
  let current = initialExtent;

  // Labels are cloned from the ones the page shipped rather than built from
  // scratch, so whatever Astro's scoped CSS hung on them — a data-astro-cid-*
  // attribute its selectors match on — comes along. Build them by hand and a
  // resize silently drops every label's font, fill and pointer-events.
  const nameTemplate = labels?.querySelector<SVGTextElement>(".name");
  const keyTemplate = labels?.querySelector<SVGTextElement>(".key");

  if (!svg || !lit || !seams || !labels || !nameTemplate) {
    return { grow: () => false, extent: () => current };
  }

  const grow = (extent: number): boolean => {
    if (extent <= current) return false;
    current = extent;

    // Geometry first, DOM second, so a throw leaves the surface as it was.
    const paths = capPaths(extent);
    const labelCaps = drawnCells(extent);

    for (const path of paths) {
      lit.querySelector(`[data-pc="${path.pc}"]`)?.setAttribute("d", path.d);
    }
    seams.setAttribute("d", paths.map((path) => path.d).join(""));

    const spelling = spellingOf(stage);
    const next = document.createDocumentFragment();
    for (const cap of labelCaps) {
      const name = nameTemplate.cloneNode(false) as SVGTextElement;
      name.setAttribute("x", String(cap.x));
      name.setAttribute("y", String(-cap.y));
      // The spelling is read off the stage every rebuild rather than captured
      // once: the HUD's toggle may have swapped it since (DESIGN.md
      // "Spelling"), and a grown window must not come back in the other row.
      name.textContent = equalTemperamentNameFor(equalTemperamentRatioFor(cap.pc), spelling);
      next.append(name);

      const node = nodeForCell(cap.m, cap.n);
      if (!node?.hint || !keyTemplate) continue;
      const key = keyTemplate.cloneNode(false) as SVGTextElement;
      key.setAttribute("x", String(cap.x + 0.9));
      key.setAttribute("y", String(-cap.y + 0.9));
      key.textContent = shortKey(node.code);
      next.append(key);
    }
    labels.replaceChildren(next);

    svg.setAttribute("viewBox", viewBoxFor(extent));
    stage.style.setProperty("--window-size", String(windowSizeFor(extent)));
    return true;
  };

  return { grow, extent: () => current };
}
