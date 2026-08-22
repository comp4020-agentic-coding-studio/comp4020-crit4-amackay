// The Tonnetz lattice, as plain functions over numbers. No DOM, no audio. See
// DESIGN.md "The lattice", "Touch model" and "Keyboard". Every formula here is
// verified numerically, independently, by scripts/tonnetz-check.ts — that
// script is not the contract, this module is.

/** Press radius and hysteresis, in twelfths. DESIGN.md "Touch model". */
export const R = Math.sqrt(5) / 4;
export const H = 0.08;

export type Vec = [number, number];

/** The shared button hexagon's six vertex offsets, CCW, from a cell's node.
 *  Equilateral (all edges √5) but not Voronoi — deliberately not the
 *  perpendicular-bisector cell. DESIGN.md "The hexagon". Edge HEX[0]-HEX[1]
 *  crosses the minor third, HEX[1]-HEX[2] the fifth, HEX[2]-HEX[3] the major
 *  third: each edge's midpoint is half the neighbour vector it separates, so
 *  the order is a fact about the basis, not a convention to carry around. */
export const HEX: Vec[] = [
  [2.5, 1],
  [0.5, 2],
  [-1.5, 1],
  [-2.5, -1],
  [-0.5, -2],
  [1.5, -1],
];

/** The six lattice neighbours of (m, n), as (dm, dn) offsets. */
export const NEIGHBOURS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

const F: Vec = [-1, 3];
const B: Vec = [3, 3];

/** The fundamental domain's low corner, in twelfths, and its side. The corner
 *  is the midpoint between Gb (m,n)=(1,2) at (5,9) and its +F (P5) neighbour
 *  Db (2,2) at (4,12); all four corners of the square are Gb/Db midpoints, by
 *  the (12,0)/(0,12) periodicity. The page's camera is derived from these, so
 *  the domain and what is drawn around it cannot drift apart. */
export const DOMAIN_X0 = (5 + 4) / 2; // 4.5
export const DOMAIN_Y0 = (9 + 12) / 2; // 10.5
export const DOMAIN_SIZE = 12;

/** The drawn window, centred on the domain. EXTENT covers both marked
 *  viewports' long axis with slack at FIT_SIZE = 15; MARGIN is just past the
 *  hexagon's farthest corner (sqrt(7.25) ~= 2.693 — no single circumradius any
 *  more) so a hexagon merely intersecting the window still gets drawn.
 *  DESIGN.md "Sizing". */
export const CENTRE_X = DOMAIN_X0 + DOMAIN_SIZE / 2;
export const CENTRE_Y = DOMAIN_Y0 + DOMAIN_SIZE / 2;
export const EXTENT = 17;
export const MARGIN = 2.8;

/** Screen position of lattice vertex (m, n), in twelfths. */
export function pos(m: number, n: number): Vec {
  return [m * F[0] + n * B[0], m * F[1] + n * B[1]];
}

/** Pitch class (0-11) sounded by lattice vertex (m, n). Valid for every
 *  integer pair — never reduce (m, n) into the fundamental domain first. */
export function pc(m: number, n: number): number {
  return (((7 * m + 3 * n) % 12) + 12) % 12;
}

function sub(a: Vec, b: Vec): Vec {
  return [a[0] - b[0], a[1] - b[1]];
}

function len(v: Vec): number {
  return Math.hypot(v[0], v[1]);
}

/** Distance from `point` to the button hexagon centred at `node`: 0 inside the
 *  hexagon, otherwise the minimum point-to-segment distance over its six
 *  edges. Ported verbatim from scripts/tonnetz-check.ts. */
export function cellDist(point: Vec, node: Vec): number {
  const q = sub(point, node);
  let inside = true;
  let best = Infinity;
  for (let i = 0; i < 6; i++) {
    const a = HEX[i]!;
    const b = HEX[(i + 1) % 6]!;
    const e = sub(b, a);
    const w = sub(q, a);
    if (e[0] * w[1] - e[1] * w[0] < 0) inside = false;
    const t = Math.max(0, Math.min(1, (w[0] * e[0] + w[1] * e[1]) / (e[0] ** 2 + e[1] ** 2)));
    best = Math.min(best, len(sub(w, [e[0] * t, e[1] * t])));
  }
  return inside ? 0 : best;
}

/** The lattice vertex nearest (x, y), by inverting the F/B basis. Test-support
 *  only — the shipped page never calls this, because the SVG hit test already
 *  names a containing cell via each cap's own data-m/data-n. See DESIGN.md
 *  "Touch model". */
export function containingCell(x: number, y: number): [number, number] {
  const m0 = Math.floor((y - x) / 4);
  const n0 = Math.floor(y / 12 + x / 4);
  let best: [number, number] = [m0, n0];
  let bestD = Infinity;
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const d = len(sub([x, y], pos(m0 + i, n0 + j)));
      if (d < bestD) {
        bestD = d;
        best = [m0 + i, n0 + j];
      }
    }
  }
  return best;
}

/** The pitch classes a point at `point` presses, given the cell it's known to
 *  be inside (`cell`) and — for hysteresis — the pitch classes it was already
 *  holding. Tests only the containing cell and its six neighbours (seven
 *  cellDist calls), proven equivalent to a full 5x5 scan up to r=1.47.
 *  Deduplicates by pitch class: a cell outside the fundamental domain and its
 *  wrapped twin are the same note. A held pc survives until cellDist > R+H; an
 *  unheld pc joins only at cellDist < R. */
/** Which of `cell` and its six neighbours' hexagons actually contains
 *  `point`, if any. A drag's anchor should follow this every move: re-anchoring
 *  to whichever adjacent cell the point has stepped into is what lets a chain
 *  of coordinate-only pointermoves walk arbitrarily far across the lattice one
 *  hex at a time, without depending on `pointerenter` retargeting to each cap
 *  — which touch input does not reliably do. Null when point is inside none of
 *  the seven (the gaps between hexagons, or a jump of more than one hex since
 *  the last move) — callers should keep the previous anchor in that case. */
export function anchorCell(point: Vec, cell: [number, number]): [number, number] | null {
  const [cm, cn] = cell;
  for (const [dm, dn] of [[0, 0], ...NEIGHBOURS] as [number, number][]) {
    const m = cm + dm;
    const n = cn + dn;
    if (cellDist(point, pos(m, n)) === 0) return [m, n];
  }
  return null;
}

export function pressedPitchClasses(
  point: Vec,
  cell: [number, number],
  held: ReadonlySet<number> = new Set(),
): Set<number> {
  const [cm, cn] = cell;
  const out = new Set<number>();
  for (const [dm, dn] of [[0, 0], ...NEIGHBOURS] as [number, number][]) {
    const m = cm + dm;
    const n = cn + dn;
    const p = pc(m, n);
    const d = cellDist(point, pos(m, n));
    const threshold = held.has(p) ? R + H : R;
    if (d < threshold) out.add(p);
  }
  return out;
}

export interface Cap {
  m: number;
  n: number;
  x: number;
  y: number;
  pc: number;
}

/** Every lattice vertex whose centre falls in [x0,x1]x[y0,y1], inflated by
 *  `margin` on every side first. margin=0 gives "centre inside the box" (the
 *  key-table derivation below); margin>0 gives a cheap superset of "the
 *  hexagon intersects the box" (rendering — over-inclusion costs nothing
 *  since SVG clips). A fixed m,n scan range is fine: this runs once at Astro
 *  build time, never per frame. */
export function visibleCells(x0: number, x1: number, y0: number, y1: number, margin = 0): Cap[] {
  const out: Cap[] = [];
  const lo = { x: x0 - margin, y: y0 - margin };
  const hi = { x: x1 + margin, y: y1 + margin };
  for (let m = -40; m <= 40; m++) {
    for (let n = -40; n <= 40; n++) {
      const [x, y] = pos(m, n);
      if (x >= lo.x && x <= hi.x && y >= lo.y && y <= hi.y) out.push({ m, n, x, y, pc: pc(m, n) });
    }
  }
  return out;
}

/** Every cap the page draws. One definition, so a test can check the keyed
 *  block against exactly what gets rendered. */
export function drawnCells(): Cap[] {
  return visibleCells(CENTRE_X - EXTENT, CENTRE_X + EXTENT, CENTRE_Y - EXTENT, CENTRE_Y + EXTENT, MARGIN);
}

export interface KeyedNode extends Cap {
  code: string;
  /** Whether this cap carries a visible key hint — true for the twelve inside
   *  the fundamental domain and nothing else. The other twenty-four play
   *  silently. DESIGN.md "Keyboard". */
  hint: boolean;
}

/** The domain's twelve caps as four screen rows, top of the screen first
 *  (descending y, since the drawing negates it) and each row left to right.
 *  Both the key block and the hint labels are laid out in this order. */
export function domainRows(): Cap[][] {
  const caps = visibleCells(DOMAIN_X0, DOMAIN_X0 + DOMAIN_SIZE, DOMAIN_Y0, DOMAIN_Y0 + DOMAIN_SIZE);
  const ys = [...new Set(caps.map((cap) => cap.y))].sort((a, b) => b - a);
  return ys.map((y) => caps.filter((cap) => cap.y === y).sort((a, b) => a.x - b.x));
}

// The previous instrument's exact QWERTY block. Its middle three columns are
// the fundamental domain and carry the hints; the outer six are the same caps
// one horizontal period away. DESIGN.md "Keyboard".
export const KEYS: readonly (readonly string[])[] = [
  ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
  ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period"],
];
const HINT_COL = 3; // the domain occupies columns 3-5 of the block

function buildKeyedNodes(): KeyedNode[] {
  const nodes: KeyedNode[] = [];
  domainRows().forEach((row, r) => {
    row.forEach((cap, i) => {
      // (m-3, n+3) is exactly (+12, 0) in twelfths — one horizontal period —
      // and preserves pc, so the outer columns are the domain's own caps
      // shifted a period either way. That is what makes the block cover each
      // pitch class exactly three times, evenly.
      for (const period of [-1, 0, 1]) {
        const code = KEYS[r]?.[i + HINT_COL + 3 * period];
        if (!code) continue;
        const m = cap.m - 3 * period;
        const n = cap.n + 3 * period;
        const [x, y] = pos(m, n);
        nodes.push({ m, n, x, y, pc: pc(m, n), code, hint: period === 0 });
      }
    });
  });
  return nodes;
}

/** All 36 keyed caps: the keyboard mapping and the DOM handle alike. */
export const KEYED_NODES: KeyedNode[] = buildKeyedNodes();

const NODE_BY_CODE = new Map(KEYED_NODES.map((node) => [node.code, node]));
const NODE_BY_CELL = new Map(KEYED_NODES.map((node) => [`${node.m},${node.n}`, node]));

export function nodeForCode(code: string): KeyedNode | undefined {
  return NODE_BY_CODE.get(code);
}

export function nodeForCell(m: number, n: number): KeyedNode | undefined {
  return NODE_BY_CELL.get(`${m},${n}`);
}

