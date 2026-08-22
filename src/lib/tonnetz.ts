// The Tonnetz lattice, as plain functions over numbers. No DOM, no audio. See
// DESIGN.md "The lattice", "Touch model" and "Keyboard". Every formula here is
// verified numerically, independently, by scripts/tonnetz-check.ts — that
// script is not the contract, this module is.

/** Press radius and hysteresis, in twelfths. DESIGN.md "Touch model". */
export const R = 0.45;
export const H = 0.08;

export type Vec = [number, number];

/** The shared Voronoi hexagon's six vertex offsets, CCW, from a cell's node. */
export const HEX: Vec[] = [
  [2, 1],
  [1, 2],
  [-1, 2],
  [-2, -1],
  [-1, -2],
  [1, -2],
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

const F: Vec = [3, -1];
const B: Vec = [3, 3];

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

/** Distance from `point` to the Voronoi cell centred at `node`: 0 inside the
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
  const m0 = Math.floor((x - y) / 4);
  const n0 = Math.floor(x / 12 + y / 4);
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

export interface KeyedNode extends Cap {
  code: string;
}

// The previous instrument's exact QWERTY block, laid over the visible
// lattice. See DESIGN.md "Keyboard" and scripts/tonnetz-keys-wide.ts, which
// this is ported from verbatim.
const KEYS = [
  ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
  ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period"],
];
const KEY_COLS = [-6, -3, 0, 3, 6, 9, 12, 15, 18]; // centred on the domain (x=6)
const [KEY_Y0, KEY_Y1] = [-2, 13];

function buildKeyedNodes(): KeyedNode[] {
  const nodes: KeyedNode[] = [];
  KEY_COLS.forEach((x, col) => {
    const column = visibleCells(x, x, KEY_Y0, KEY_Y1).sort((a, b) => b.y - a.y);
    column.forEach((cap, row) => {
      const code = KEYS[row]?.[col];
      if (!code) return;
      nodes.push({ ...cap, code });
    });
  });
  return nodes;
}

/** All 36 keyed caps: the keyboard mapping and the DOM handle alike. */
export const KEYED_NODES: KeyedNode[] = buildKeyedNodes();

const NODE_BY_CODE = new Map(KEYED_NODES.map((node) => [node.code, node]));
const CODE_BY_CELL = new Map(KEYED_NODES.map((node) => [`${node.m},${node.n}`, node.code]));

export function nodeForCode(code: string): KeyedNode | undefined {
  return NODE_BY_CODE.get(code);
}

export function codeForCell(m: number, n: number): string | undefined {
  return CODE_BY_CELL.get(`${m},${n}`);
}
