// The tab icon: the button cell's outline and nothing else. Derived from HEX
// rather than drawn, for the same reason index.astro derives its polygon points
// and its clip-path from it — there is one hexagon in this repo and it is in
// tonnetz.ts.
//
// Emitted as a `data:` URI rather than a file in public/, so there is no
// BASE_URL to join and therefore no way for the icon to work locally and 404
// under the Pages base path.
import { HEX } from "./tonnetz.ts";

/** Stroke width in the hexagon's own units. The hexagon's box is 5 x 4, so
 *  this is ~9% of its width — about 1.4px once the icon renders at 16px. The
 *  playing surface's own `stroke-width: 0.09` is a seam between flush caps and
 *  disappears entirely at icon size. */
const STROKE = 0.5;

/** Clear space between the stroke's outer edge and the viewBox. */
const MARGIN = 0.15;

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** The icon as an SVG document. Transparent apart from the stroke: no fill,
 *  no background. Black, flipping to white on a dark tab bar — honoured by
 *  Chrome and Firefox, ignored by Safari, which keeps the black. */
export function faviconSvg(): string {
  // y negated once, as index.astro does per cap: lattice y is up, SVG y down.
  const screenHex: [number, number][] = HEX.map(([hx, hy]) => [hx, -hy]);
  const points = screenHex.map(([x, y]) => `${x},${y}`).join(" ");

  // A square box centred on the node, big enough for the widest half-extent
  // plus the half of the stroke that sits outside the path. The round join
  // never overshoots that, so nothing clips.
  const reach = Math.max(...screenHex.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]));
  const half = round(reach + STROKE / 2 + MARGIN);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${half * 2} ${half * 2}">`,
    "<style>polygon{stroke:#000}",
    "@media (prefers-color-scheme: dark){polygon{stroke:#fff}}</style>",
    `<polygon points="${points}" fill="none" stroke-width="${STROKE}" stroke-linejoin="round"/>`,
    "</svg>",
  ].join("");
}

/** The same document as an `href`. The encoding is load-bearing, not tidiness:
 *  an unescaped `#` in the colours would end the URI at the fragment. */
export function faviconDataUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(faviconSvg())}`;
}
