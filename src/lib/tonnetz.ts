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

/** Horizontal spacing between adjacent hexagons in a screen row, in
 *  twelfths: F-B = (-4, 0), a purely horizontal vector. Derived rather than
 *  hand-copied, since the zoom bounds below are counted in this unit. */
export const H_SPACING = Math.abs(F[0] - B[0]); // 4

/** The fundamental domain's low corner, in twelfths, and its side. The corner
 *  is the midpoint between Gb (m,n)=(1,2) at (5,9) and its +F (P5) neighbour
 *  Db (2,2) at (4,12); all four corners of the square are Gb/Db midpoints, by
 *  the (12,0)/(0,12) periodicity. The page's camera is derived from these, so
 *  the domain and what is drawn around it cannot drift apart. */
export const DOMAIN_X0 = (5 + 4) / 2; // 4.5
export const DOMAIN_Y0 = (9 + 12) / 2; // 10.5
export const DOMAIN_SIZE = 12;

/** Padding, in twelfths, around the fundamental domain that sets the page's
 *  *initial* zoom level — not one of the zoom bounds below, but the anchor
 *  the discrete zoom ladder is built from. DESIGN.md "Sizing". */
export const FIT_PADDING = 1.5;

/** The zoom level the page loads at: the fundamental domain plus a fixed
 *  padding, in twelfths on the viewport's short axis. Both index.astro's
 *  initial --fit-size and ZOOM_RATIO below are derived from this, so a
 *  zoom-out from max zoom-in always lands here exactly. */
export const FIT_SIZE_INITIAL = DOMAIN_SIZE + 2 * FIT_PADDING; // 15

/** Zoom bounds, in FIT_SIZE's own unit (twelfths on the viewport's short
 *  axis) — DESIGN.md "Sizing"/"Zoom". Max zoom in is the fundamental domain
 *  itself, a product decision independent of the ratio below. */
export const FIT_SIZE_MIN = DOMAIN_SIZE; // 12, most zoomed in

/** Multiplicative step ratio: the one ratio that returns from max zoom-in
 *  (FIT_SIZE_MIN) to the initial view in exactly one click, so the two
 *  landmarks a player already knows — "as zoomed in as it goes" and "where
 *  it opened" — are always exactly one discrete step apart, in either
 *  direction, regardless of how the domain/padding numbers above are ever
 *  retuned. */
export const ZOOM_RATIO = FIT_SIZE_INITIAL / FIT_SIZE_MIN; // 15/12 = 1.25 = 5/4

/** How many ratio-steps out from FIT_SIZE_MIN reach FIT_SIZE_MAX. A product
 *  decision — "roughly the old 56" — resolved by picking whichever integer
 *  power of ZOOM_RATIO lands closest: k=7 gives 57.22... (+2.2%), k=6 gives
 *  45.78 (-18.3%) — not close. */
export const ZOOM_STEPS_OUT = 7;

/** Most zoomed out. An exact power of ZOOM_RATIO above FIT_SIZE_MIN — never
 *  a clamp of one — which is what lets repeated zoom-out clicks land on it
 *  exactly with no rounding to absorb. Exact in floating point too:
 *  ZOOM_RATIO's denominator (4) and ZOOM_STEPS_OUT (7) combine to a power of
 *  two (4^7 = 2^14), so 12 * 1.25^7 terminates in binary with nothing left
 *  over. */
export const FIT_SIZE_MAX = FIT_SIZE_MIN * ZOOM_RATIO ** ZOOM_STEPS_OUT; // 57.220458984375, most zoomed out

/** Fit size at ratio-step `i` from max zoom-in — i=0 is FIT_SIZE_MIN, i=1 is
 *  FIT_SIZE_INITIAL, i=ZOOM_STEPS_OUT is FIT_SIZE_MAX. Not clamped: callers
 *  clamp the *index*, so a step at either boundary is always the bound's own
 *  exact value, never a clamp() of a close-but-not-exact one. */
export function fitSizeForStep(i: number): number {
  return FIT_SIZE_MIN * ZOOM_RATIO ** i;
}

/** The step index nearest `fitSize`, clamped to [0, ZOOM_STEPS_OUT].
 *  log_RATIO(fitSize/FIT_SIZE_MIN), rounded. This is what makes a discrete
 *  zoom move exact regardless of interaction history — e.g. a value left
 *  mid-continuous-hold, or ordinary float drift: snap to the nearest step,
 *  then the caller moves exactly one whole step, rather than multiplying
 *  whatever's currently there by ZOOM_RATIO directly (which would drift a
 *  hair further from a step every time it started from a non-step value). */
export function stepForFitSize(fitSize: number): number {
  const raw = Math.round(Math.log(fitSize / FIT_SIZE_MIN) / Math.log(ZOOM_RATIO));
  return Math.min(ZOOM_STEPS_OUT, Math.max(0, raw));
}

/** The drawn window, centred on the domain. Sized for the worst case of a
 *  runtime zoom range: at FIT_SIZE_MAX, neither marked viewport may show
 *  blank canvas past the lattice's edge, including on the long axis.
 *  Portrait 390x844 is the binding case (long/short = 844/390 ~= 2.1641):
 *  long axis needs FIT_SIZE_MAX * 2.1641 ~= 123.8 twelfths. EXTENT=64 (window
 *  side 128) leaves ~3.3% slack. Re-verified, not just asserted here —
 *  scripts/tonnetz-check.ts recomputes this and also checks that
 *  visibleCells' fixed m,n scan (-40..40 below) still covers the window.
 *  MARGIN is just past the hexagon's farthest corner (sqrt(7.25) ~= 2.693 —
 *  no single circumradius any more) so a hexagon merely intersecting the
 *  window still gets drawn. */
export const CENTRE_X = DOMAIN_X0 + DOMAIN_SIZE / 2;
export const CENTRE_Y = DOMAIN_Y0 + DOMAIN_SIZE / 2;
export const EXTENT = 64;
export const MARGIN = 2.8;

/** The drawn window's side, in twelfths — what index.astro delivers to CSS
 *  as --window-size, so .stage's size is never a hand-copied number either. */
export const WINDOW_SIZE = EXTENT * 2;

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

/** The lattice vertex nearest (x, y), by inverting the F/B basis.
 *
 *  This is where a gesture's anchor cell comes from. The SVG hit test names a
 *  *pitch class* — a pitch class's caps are one path — and a pitch class is
 *  121 cells, so the cell itself has to be derived. Nearest vertex is not the
 *  same question as containing hexagon (the cap is not the Voronoi cell), so
 *  callers pass the answer through `anchorCell`, which walks to whichever of
 *  the seven candidates actually contains the point. `tonnetz.test.ts` checks
 *  that walk never comes up empty. See DESIGN.md "Two hit-test paths". */
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
 *  build time, never per frame. -40..40 is verified sufficient for the drawn
 *  window at the current EXTENT by scripts/tonnetz-check.ts, not just
 *  asserted here — re-run it after changing EXTENT. */
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

/** One pitch class's caps as a single SVG path. Twelve of these draw the whole
 *  surface's fill, so lighting a pitch class is one class on one element
 *  rather than a class on each of its ~121 caps — see DESIGN.md "The lit
 *  layer". `count` is the number of hexagons the path holds, one subpath each. */
export interface CapPath {
  pc: number;
  d: string;
  count: number;
}

/** The `d` for a set of caps: each hexagon a closed subpath, disjoint from the
 *  rest, so the path fills and hit-tests per hexagon exactly as separate
 *  polygons did.
 *
 *  **Screen space** — y is negated here as it is for the caps themselves
 *  (lattice y is up, SVG y is down). This is the only function in this module
 *  that leaves lattice orientation, and it does so because the string it
 *  returns goes straight into an attribute.
 *
 *  Encoded relative, caps ordered by screen row: every hexagon's body is then
 *  the same twenty-six characters and almost every hop between two of them is
 *  `m12,0`, so the twelve paths add ~150 bytes to the gzipped page instead of
 *  ~22 KB. Every delta is an exact integer and every start point an exact
 *  half-integer, so accumulating them is exact in double precision — the
 *  vertices a browser reconstructs are the same numbers `pos()` gives, which
 *  `tonnetz.test.ts` checks rather than assumes. */
export function capPathData(caps: readonly Cap[]): string {
  // One body for every hexagon, since they are all the same shape: the five
  // edges from HEX[0] round to HEX[5], with `z` closing the sixth.
  const body = HEX.slice(1)
    .map(([x, y], i) => `l${x - HEX[i][0]},${-(y - HEX[i][1])}`)
    .join("");

  // Top of the screen first, then left to right — the order that makes
  // consecutive hexagons one horizontal period apart.
  const ordered = [...caps].sort((a, b) => b.y - a.y || a.x - b.x);

  let d = "";
  let [cx, cy] = [0, 0];
  for (const cap of ordered) {
    const [sx, sy] = [cap.x + HEX[0][0], -(cap.y + HEX[0][1])];
    d += `${d ? "m" : "M"}${sx - cx},${sy - cy}${body}z`;
    [cx, cy] = [sx, sy];
  }
  return d;
}

/** Every drawn cap, grouped into one path per pitch class, ascending. The
 *  groups are not even: the drawn window holds 121 caps of most pitch classes
 *  and 132 of two of them. */
export function capPaths(): CapPath[] {
  const byPc = new Map<number, Cap[]>();
  for (const cap of drawnCells()) {
    const group = byPc.get(cap.pc) ?? [];
    group.push(cap);
    byPc.set(cap.pc, group);
  }
  return [...byPc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pc, group]) => ({ pc, d: capPathData(group), count: group.length }));
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

