import { describe, expect, it } from "vitest";
import {
  anchorCell,
  capPathData,
  capPaths,
  cellDist,
  containingCell,
  DOMAIN_SIZE,
  DOMAIN_X0,
  DOMAIN_Y0,
  domainRows,
  drawnCells,
  FIT_SIZE_INITIAL,
  FIT_SIZE_MAX,
  FIT_SIZE_MIN,
  fitSizeForStep,
  H,
  HEX,
  KEYED_NODES,
  KEYS,
  NEIGHBOURS,
  nodeForCell,
  nodeForCode,
  pc,
  pos,
  pressedPitchClasses,
  R,
  stepForFitSize,
  type Vec,
  visibleCells,
  ZOOM_RATIO,
  ZOOM_STEPS_OUT,
} from "./tonnetz.ts";

describe("the fundamental domain", () => {
  const inDomain: { m: number; n: number; pc: number }[] = [];
  for (let m = -20; m <= 20; m++) {
    for (let n = -20; n <= 20; n++) {
      const [x, y] = pos(m, n);
      if (x >= 0 && x < 12 && y >= 0 && y < 12) inDomain.push({ m, n, pc: pc(m, n) });
    }
  }

  it("[0,12)^2 holds exactly 12 vertices", () => {
    expect(inDomain).toHaveLength(12);
  });

  it("...one per pitch class", () => {
    expect(new Set(inDomain.map((v) => v.pc)).size).toBe(12);
  });

  it("wraps: translating by (12,0)=(m+3,n+1) or (0,12)=(m-3,n+3) preserves pc", () => {
    for (const { m, n, pc: p } of inDomain) {
      expect(pc(m + 3, n + 1)).toBe(p);
      expect(pc(m - 3, n + 3)).toBe(p);
    }
  });
});

describe("the zoom ladder", () => {
  it("the ratio is exactly what returns from max zoom-in to the initial view in one step", () => {
    expect(ZOOM_RATIO).toBe(5 / 4);
    expect(fitSizeForStep(0)).toBe(FIT_SIZE_MIN);
    expect(fitSizeForStep(1)).toBe(FIT_SIZE_INITIAL);
  });

  it("FIT_SIZE_MAX is an exact power of ZOOM_RATIO above FIT_SIZE_MIN, not a clamp of one", () => {
    expect(fitSizeForStep(ZOOM_STEPS_OUT)).toBe(FIT_SIZE_MAX);
    // Exact in floating point: ZOOM_RATIO's denominator (4) and
    // ZOOM_STEPS_OUT (7) combine to a power of two (4^7 = 2^14), so the
    // whole expression terminates in binary with nothing left to round.
    expect(FIT_SIZE_MAX).toBe(937500 / 16384);
  });

  it("k=7 is the closest integer step count to the old ~56 bound; k=6 is not close", () => {
    expect(Math.abs(FIT_SIZE_MAX - 56) / 56).toBeLessThan(0.03);
    expect(Math.abs(FIT_SIZE_MIN * ZOOM_RATIO ** 6 - 56) / 56).toBeGreaterThan(0.15);
  });

  it("zooming in maximally, then out once, lands exactly back on the initial view", () => {
    // "Maximally": more zoom-in clicks than there are steps, each one
    // snap-then-move-one-step — the same operation zoom.ts's button handler
    // performs.
    let fitSize = FIT_SIZE_MAX;
    for (let i = 0; i < ZOOM_STEPS_OUT + 3; i++) {
      fitSize = fitSizeForStep(Math.max(0, stepForFitSize(fitSize) - 1));
    }
    expect(fitSize).toBe(FIT_SIZE_MIN);

    fitSize = fitSizeForStep(Math.min(ZOOM_STEPS_OUT, stepForFitSize(fitSize) + 1));
    expect(fitSize).toBe(FIT_SIZE_INITIAL);
  });

  it("stepForFitSize round-trips every step with no drift", () => {
    for (let i = 0; i <= ZOOM_STEPS_OUT; i++) {
      expect(stepForFitSize(fitSizeForStep(i))).toBe(i);
    }
  });

  it("stepForFitSize clamps a value past either bound to the nearest valid step", () => {
    expect(stepForFitSize(FIT_SIZE_MIN / 2)).toBe(0);
    expect(stepForFitSize(FIT_SIZE_MAX * 2)).toBe(ZOOM_STEPS_OUT);
  });

  it("snaps a non-step value (e.g. left mid-continuous-hold) to its nearest step", () => {
    const geometricMidpoint = fitSizeForStep(2) * Math.sqrt(ZOOM_RATIO); // exactly between steps 2 and 3
    expect(stepForFitSize(geometricMidpoint)).toBe(3); // Math.round ties toward +Infinity
  });
});

describe("the domain as it reaches the screen", () => {
  // The layout the instrument is positioned around, top of the screen down and
  // each row left to right:
  //     Gb  D   Bb
  //     B   G   Eb
  //     E   C   Ab
  //     A   F   Db
  // Pinned as pitch classes because this is the thing that was wrong: the
  // corner sat on a B/Gb midpoint instead of a Gb/Db one, which shifted every
  // row by one and could not be seen by any test that only counted caps.
  const EXPECTED = [
    [1, 9, 5],
    [6, 2, 10],
    [11, 7, 3],
    [4, 0, 8],
  ];

  it("reads as four rows of three, in the intended order", () => {
    expect(domainRows().map((row) => row.map((cap) => cap.pc))).toEqual(EXPECTED);
  });

  it("puts the corner on a Gb/Db midpoint, a fifth apart", () => {
    // Gb (1,2) and its +F neighbour Db (2,2); the corner is their midpoint.
    expect(pc(1, 2)).toBe(1);
    expect(pc(2, 2)).toBe(8);
    const [gx, gy] = pos(1, 2);
    const [dx, dy] = pos(2, 2);
    expect([(gx + dx) / 2, (gy + dy) / 2]).toEqual([DOMAIN_X0, DOMAIN_Y0]);
  });

  it("rows run down the screen and each row runs left to right", () => {
    const rows = domainRows();
    for (let r = 1; r < rows.length; r++) {
      expect(rows[r]![0]!.y, "later rows sit lower on screen").toBeLessThan(rows[r - 1]![0]!.y);
    }
    for (const row of rows) {
      for (let i = 1; i < row.length; i++) expect(row[i]!.x).toBeGreaterThan(row[i - 1]!.x);
    }
  });
});

describe("neighbours and triads", () => {
  it("the six neighbour intervals are {3,4,5,7,8,9}", () => {
    const rel = NEIGHBOURS.map(([dm, dn]) => pc(dm, dn)).sort((a, b) => a - b);
    expect(rel).toEqual([3, 4, 5, 7, 8, 9]);
  });

  it("the lower triangle of (m,n) is a minor triad rooted at pc(m,n)", () => {
    for (const [m, n] of [[0, 0], [2, -1], [-3, 4]] as [number, number][]) {
      const tri = [pc(m, n), pc(m + 1, n), pc(m, n + 1)].map((p) => (p - pc(m, n) + 12) % 12);
      expect(tri.sort((a, b) => a - b)).toEqual([0, 3, 7]);
    }
  });

  it("the upper triangle of (m,n) is a major triad rooted at pc(m,n)+3", () => {
    for (const [m, n] of [[0, 0], [2, -1], [-3, 4]] as [number, number][]) {
      const root = (pc(m, n) + 3) % 12;
      const tri = [pc(m + 1, n), pc(m + 1, n + 1), pc(m, n + 1)].map((p) => (p - root + 12) % 12);
      expect(tri.sort((a, b) => a - b)).toEqual([0, 4, 7]);
    }
  });
});

describe("the button hexagon", () => {
  it("is equilateral: all six edges are sqrt(5)", () => {
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = HEX[i]!;
      const [bx, by] = HEX[(i + 1) % 6]!;
      expect(Math.hypot(bx - ax, by - ay)).toBeCloseTo(Math.sqrt(5), 12);
    }
  });

  it("is centrally symmetric about its node", () => {
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = HEX[i]!;
      const [bx, by] = HEX[i + 3]!;
      expect([bx, by]).toEqual([-ax, -ay]);
    }
  });

  it("has area 12, so it tiles the plane under F and B", () => {
    // The lattice's fundamental domain area is |det[F,B]| = 12. A cell of any
    // other area could not tile flush, which is what the caps do on screen.
    let twice = 0;
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = HEX[i]!;
      const [bx, by] = HEX[(i + 1) % 6]!;
      twice += ax * by - bx * ay;
    }
    expect(twice / 2).toBeCloseTo(12, 12);
  });

  it("is convex and wound CCW", () => {
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = HEX[i]!;
      const [bx, by] = HEX[(i + 1) % 6]!;
      const [cx, cy] = HEX[(i + 2) % 6]!;
      expect((bx - ax) * (cy - by) - (by - ay) * (cx - bx)).toBeGreaterThan(0);
    }
  });
});

describe("cellDist", () => {
  it("is 0 at the node itself", () => {
    expect(cellDist([5, 5], [5, 5])).toBe(0);
  });

  it("is 0 everywhere strictly inside the hexagon", () => {
    for (const [hx, hy] of HEX) {
      const inside: [number, number] = [hx * 0.5, hy * 0.5];
      expect(cellDist(inside, [0, 0])).toBe(0);
    }
  });

  it("is positive and grows outward past a vertex", () => {
    const [hx, hy] = HEX[0]!;
    const len = Math.hypot(hx, hy);
    const outward: [number, number] = [(hx / len) * (len + 1), (hy / len) * (len + 1)];
    const further: [number, number] = [(hx / len) * (len + 2), (hy / len) * (len + 2)];
    const near = cellDist(outward, [0, 0]);
    const far = cellDist(further, [0, 0]);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
  });
});

describe("the <=3 press invariant", () => {
  const STEP = 12 / 150;
  const counts = new Map<number, number>();
  let worst = 0;
  const bad3: string[] = [];
  const bad2: string[] = [];

  for (let x = 0; x < 12; x += STEP) {
    for (let y = 0; y < 12; y += STEP) {
      const cell = containingCell(x, y);
      const set = pressedPitchClasses([x, y], cell);
      const s = [...set].sort((a, b) => a - b);
      counts.set(s.length, (counts.get(s.length) ?? 0) + 1);
      worst = Math.max(worst, s.length);

      if (s.length === 3) {
        const iv = [1, 2].map((i) => (s[i]! - s[0]! + 12) % 12).sort((a, b) => a - b);
        const key = String(iv);
        if (!["3,7", "4,7", "4,9", "5,8", "3,8", "5,9"].includes(key)) bad3.push(String(s));
      }
      if (s.length === 2) {
        const iv = Math.min((s[1]! - s[0]! + 12) % 12, (s[0]! - s[1]! + 12) % 12);
        if (![3, 4, 5].includes(iv)) bad2.push(`${s} (${iv})`);
      }
    }
  }

  it("never presses more than 3 pitch classes", () => {
    expect(worst).toBeLessThanOrEqual(3);
  });

  it("reaches 1, 2 and 3 presses somewhere on the surface", () => {
    for (const k of [1, 2, 3]) expect(counts.get(k) ?? 0).toBeGreaterThan(0);
  });

  it("every two-press is a third or a fifth", () => {
    expect(bad2).toEqual([]);
  });

  it("every three-press is a major or minor triad", () => {
    expect(bad3).toEqual([]);
  });
});

describe("hysteresis", () => {
  it("keeps a held pitch class until cellDist exceeds R+H, but never admits an unheld one past R", () => {
    // Walk outward along the first hexagon edge's direction until we find a
    // point whose cellDist to the origin cell sits strictly between R and R+H.
    const [hx, hy] = HEX[0]!;
    const dirLen = Math.hypot(hx, hy);
    const dir: [number, number] = [hx / dirLen, hy / dirLen];
    let point: [number, number] | undefined;
    for (let t = 0; t < 6; t += 0.001) {
      const p: [number, number] = [dir[0] * t, dir[1] * t];
      const d = cellDist(p, [0, 0]);
      if (d > R && d < R + H) {
        point = p;
        break;
      }
    }
    expect(point, "no point found in the (R, R+H) band — test setup problem").toBeDefined();

    const p0 = pc(0, 0);
    const freshSet = pressedPitchClasses(point!, [0, 0], new Set());
    expect(freshSet.has(p0)).toBe(false);

    const heldSet = pressedPitchClasses(point!, [0, 0], new Set([p0]));
    expect(heldSet.has(p0)).toBe(true);
  });
});

describe("boundary presses: 25/50/25 split, one edge per boundary type", () => {
  // DESIGN.md "The hexagon": walking t from 0 to 1 along an
  // edge, the first and last quarter press the corner's triad (3 pcs) and
  // the middle half presses just the dyad (2 pcs) — identical on all three
  // boundary types because the hexagon is equilateral. HEX[0]-HEX[1] is the
  // m3 boundary, HEX[1]-HEX[2] is P5, HEX[2]-HEX[3] is M3 (DESIGN.md "The
  // hexagon"; the labels are checked against the neighbour vectors below,
  // because an equilateral hexagon makes the split itself blind to the
  // order). A small band around t=0.25 and t=0.75 is excluded for
  // float/hysteresis tolerance.
  const EDGES: [string, number][] = [
    ["m3", 0],
    ["P5", 1],
    ["M3", 2],
  ];

  it("each edge separates the neighbour its label names", () => {
    // Every edge's midpoint is exactly half the neighbour vector it crosses.
    const VECTOR: Record<string, Vec> = {
      P5: pos(1, 0),
      m3: pos(0, 1),
      M3: [pos(1, 0)[0] - pos(0, 1)[0], pos(1, 0)[1] - pos(0, 1)[1]],
    };
    for (const [label, i] of EDGES) {
      const [ax, ay] = HEX[i]!;
      const [bx, by] = HEX[(i + 1) % 6]!;
      expect([(ax + bx) / 2, (ay + by) / 2], label).toEqual([
        VECTOR[label]![0] / 2,
        VECTOR[label]![1] / 2,
      ]);
    }
  });
  const BAND = 0.02;

  for (const [label, i] of EDGES) {
    it(`${label} boundary: 3 presses in the outer quarters, 2 in the middle half`, () => {
      const [ax, ay] = HEX[i]!;
      const [bx, by] = HEX[(i + 1) % 6]!;
      for (let t = 0; t <= 1; t += 0.01) {
        if (Math.abs(t - 0.25) < BAND || Math.abs(t - 0.75) < BAND) continue;
        const point: [number, number] = [ax + t * (bx - ax), ay + t * (by - ay)];
        const set = pressedPitchClasses(point, [0, 0]);
        const expected = t < 0.25 || t > 0.75 ? 3 : 2;
        expect(set.size, `${label} t=${t.toFixed(2)}`).toBe(expected);
      }
    });
  }
});

describe("visibleCells", () => {
  it("margin=0 only includes cells centred inside the box", () => {
    const cells = visibleCells(-3, 3, -3, 3, 0);
    for (const cap of cells) {
      expect(cap.x).toBeGreaterThanOrEqual(-3);
      expect(cap.x).toBeLessThanOrEqual(3);
      expect(cap.y).toBeGreaterThanOrEqual(-3);
      expect(cap.y).toBeLessThanOrEqual(3);
    }
  });

  it("margin>0 additionally includes cells just outside the box", () => {
    const tight = visibleCells(-3, 3, -3, 3, 0);
    const padded = visibleCells(-3, 3, -3, 3, 2.3);
    expect(padded.length).toBeGreaterThan(tight.length);
    for (const cap of padded) {
      expect(cap.x).toBeGreaterThanOrEqual(-3 - 2.3);
      expect(cap.x).toBeLessThanOrEqual(3 + 2.3);
    }
  });

  it("excludes a cell far outside the box regardless of margin", () => {
    const cells = visibleCells(-3, 3, -3, 3, 2.3);
    expect(cells.some((cap) => cap.x > 100)).toBe(false);
  });
});

/** Walk a `d` of the shape capPathData emits back into absolute vertex lists,
 *  so a test can compare what a browser would reconstruct against pos()/HEX
 *  rather than against another copy of the same string-building. `z` returns
 *  the current point to the subpath's start, which is what the next `m` is
 *  measured from. */
const walkPath = (d: string): Vec[][] => {
  const shapes: Vec[][] = [];
  let shape: Vec[] = [];
  let [x, y] = [0, 0];
  let [startX, startY] = [0, 0];
  for (const token of d.match(/[MmlLz][^MmlLz]*/g) ?? []) {
    const op = token[0];
    if (op === "z") {
      shapes.push(shape);
      shape = [];
      [x, y] = [startX, startY];
      continue;
    }
    const [dx, dy] = token.slice(1).split(",").map(Number);
    [x, y] = op === "M" || op === "L" ? [dx, dy] : [x + dx, y + dy];
    if (op === "M" || op === "m") [startX, startY] = [x, y];
    shape.push([x, y]);
  }
  return shapes;
};

/** The hexagon capPathData should draw for `cap`, in screen space. */
const screenHexFor = (cap: { x: number; y: number }): Vec[] => HEX.map(([hx, hy]) => [cap.x + hx, -(cap.y + hy)]);

describe("the anchor a hit test cannot name", () => {
  // The lit layer hit-tests to a pitch class, not a cell, so the cell comes
  // from containingCell and is then corrected by anchorCell. That composition
  // is load-bearing for every press, so it gets swept rather than sampled.
  const points: Vec[] = [];
  for (let x = -20; x <= 40; x += 0.37) for (let y = -20; y <= 50; y += 0.41) points.push([x, y]);

  it("always lands on a cell whose hexagon really contains the point", () => {
    const misses: Vec[] = [];
    for (const point of points) {
      const cell = anchorCell(point, containingCell(point[0], point[1]));
      if (!cell || cellDist(point, pos(cell[0], cell[1])) !== 0) misses.push(point);
    }
    expect(misses.slice(0, 5)).toEqual([]);
  });

  it("agrees with a brute-force search over the whole neighbourhood", () => {
    for (const point of points.filter((_, i) => i % 97 === 0)) {
      const cell = anchorCell(point, containingCell(point[0], point[1]))!;
      const brute: [number, number][] = [];
      for (let m = -30; m <= 30; m++) {
        for (let n = -30; n <= 30; n++) if (cellDist(point, pos(m, n)) === 0) brute.push([m, n]);
      }
      // Hexagons tile, so a point is inside exactly one — except on a shared
      // edge, where both neighbours read distance 0 and either is a fair
      // anchor.
      expect(brute.some(([m, n]) => m === cell[0] && n === cell[1])).toBe(true);
    }
  });
});

describe("caps as one path per pitch class", () => {
  const paths = capPaths();

  it("is twelve paths, one per pitch class, ascending", () => {
    expect(paths.map((path) => path.pc)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("partitions the drawn caps, losing and duplicating none", () => {
    const drawn = drawnCells();
    expect(paths.reduce((total, path) => total + path.count, 0)).toBe(drawn.length);
    for (const path of paths) {
      expect(path.count).toBe(drawn.filter((cap) => cap.pc === path.pc).length);
    }
  });

  it("holds one closed subpath per cap, so a dropped z cannot hide", () => {
    for (const path of paths) {
      expect(path.d.match(/z/g) ?? []).toHaveLength(path.count);
      expect(path.d.match(/[Mm]/g) ?? []).toHaveLength(path.count);
    }
  });

  it("reconstructs exactly the hexagons pos() and HEX give, with no drift", () => {
    const drawn = drawnCells();
    for (const path of paths) {
      const expected = drawn
        .filter((cap) => cap.pc === path.pc)
        .map((cap) => JSON.stringify(screenHexFor(cap)))
        .sort();
      const actual = walkPath(path.d)
        .map((shape) => JSON.stringify(shape))
        .sort();
      // Exact string equality, not a tolerance: every delta is an integer and
      // every start point a half-integer, so accumulating them must be exact.
      expect(actual).toEqual(expected);
    }
  });

  it("repeats one identical hexagon body, which is what makes it compress", () => {
    // The property the encoding's byte cost rests on. If a future change makes
    // the bodies differ, the twelve paths stop being nearly free.
    const bodies = new Set(capPathData(drawnCells()).split(/[Mm][^lz]*/).filter(Boolean));
    expect(bodies).toEqual(new Set(["l-2,-1l-2,1l-1,2l2,1l2,-1z"]));
  });

  it("orders caps down the screen and then left to right", () => {
    const starts = walkPath(paths[0].d).map((shape) => shape[0]);
    for (const [[x0, y0], [x1, y1]] of starts.slice(1).map((s, i) => [starts[i], s])) {
      expect(y1 > y0 || (y1 === y0 && x1 > x0)).toBe(true);
    }
  });
});

describe("the keyed block", () => {
  it("has exactly 36 keyed caps", () => {
    expect(KEYED_NODES).toHaveLength(36);
  });

  it("gives every pitch class exactly three keys", () => {
    // An even split, because the block is the domain plus one horizontal
    // period either side and the period is exactly three columns wide.
    const byPc = new Map<number, number>();
    for (const node of KEYED_NODES) byPc.set(node.pc, (byPc.get(node.pc) ?? 0) + 1);
    expect(byPc.size).toBe(12);
    for (const count of byPc.values()) expect(count).toBe(3);
  });

  it("hints exactly the twelve caps inside the fundamental domain", () => {
    const hinted = KEYED_NODES.filter((node) => node.hint);
    expect(hinted).toHaveLength(12);
    for (const node of hinted) {
      expect(node.x).toBeGreaterThan(DOMAIN_X0);
      expect(node.x).toBeLessThan(DOMAIN_X0 + DOMAIN_SIZE);
      expect(node.y).toBeGreaterThan(DOMAIN_Y0);
      expect(node.y).toBeLessThan(DOMAIN_Y0 + DOMAIN_SIZE);
    }
    expect(new Set(hinted.map((node) => node.pc)).size).toBe(12);
  });

  it("keys only caps the page actually draws", () => {
    // The block reaches ~2.3 twelfths inside the drawn window's edge; a key on
    // a cap that was never emitted would be silently dead, since the page
    // finds its target by data-note.
    const drawn = new Set(drawnCells().map((cap) => `${cap.m},${cap.n}`));
    const missing = KEYED_NODES.filter((node) => !drawn.has(`${node.m},${node.n}`));
    expect(missing.map((node) => node.code)).toEqual([]);
  });

  it("round-trips code <-> cell", () => {
    for (const node of KEYED_NODES) {
      expect(nodeForCode(node.code)).toEqual(node);
      expect(nodeForCell(node.m, node.n)).toEqual(node);
    }
  });

  it("puts every fully-keyed triad inside a 2x2 square of keys", () => {
    // DESIGN.md "Keyboard": triads stay one-handed. A triangle whose three
    // vertices are all keyed must span at most two rows and two columns.
    const at = new Map<string, [number, number]>();
    KEYS.forEach((row, r) => row.forEach((code, c) => at.set(code, [r, c])));
    const keyed = new Map(KEYED_NODES.map((node) => [`${node.m},${node.n}`, node]));
    const spans: number[] = [];
    for (const node of KEYED_NODES) {
      const { m, n } = node;
      const triangles = [
        [[m, n], [m + 1, n], [m, n + 1]], // lower: minor
        [[m + 1, n], [m + 1, n + 1], [m, n + 1]], // upper: major
      ] as [number, number][][];
      for (const triangle of triangles) {
        const cells = triangle.map(([tm, tn]) => keyed.get(`${tm},${tn}`));
        if (cells.some((cell) => !cell)) continue;
        const at3 = cells.map((cell) => at.get(cell!.code)!);
        const rows = at3.map(([r]) => r);
        const cols = at3.map(([, c]) => c);
        spans.push(Math.max(...rows) - Math.min(...rows), Math.max(...cols) - Math.min(...cols));
      }
    }
    expect(spans.length, "no fully-keyed triads found at all").toBeGreaterThan(0);
    expect(Math.max(...spans)).toBeLessThanOrEqual(1);
  });

  it("returns undefined for an unmapped code or cell", () => {
    expect(nodeForCode("NoSuchCap")).toBeUndefined();
    expect(nodeForCell(999, 999)).toBeUndefined();
  });
});
