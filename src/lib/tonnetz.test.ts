import { describe, expect, it } from "vitest";
import {
  cellDist,
  codeForCell,
  containingCell,
  H,
  HEX,
  KEYED_NODES,
  NEIGHBOURS,
  nodeForCode,
  pc,
  pos,
  pressedPitchClasses,
  R,
  visibleCells,
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
  // tonnetz-equilateral-patch.md "Tests": walking t from 0 to 1 along an
  // edge, the first and last quarter press the corner's triad (3 pcs) and
  // the middle half presses just the dyad (2 pcs) — identical on all three
  // boundary types because the hexagon is equilateral. HEX[0]-HEX[1] is the
  // m3 boundary, HEX[1]-HEX[2] is M3, HEX[2]-HEX[3] is P5 (DESIGN.md "The
  // hexagon"). A small band around t=0.25 and t=0.75 is excluded for
  // float/hysteresis tolerance.
  const EDGES: [string, number][] = [
    ["m3", 0],
    ["M3", 1],
    ["P5", 2],
  ];
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

describe("the keyed block", () => {
  it("has exactly 36 keyed caps", () => {
    expect(KEYED_NODES).toHaveLength(36);
  });

  it("covers all twelve pitch classes", () => {
    // Not an even 3-per-note split — 9 columns isn't a multiple of the
    // 4-column horizontal period, so some notes land more often than others
    // (e.g. the note at column phase 0 gets 3 hits per row, others 2). What
    // matters is every pitch class is reachable from the keyboard at all.
    const byPc = new Map<number, number>();
    for (const node of KEYED_NODES) byPc.set(node.pc, (byPc.get(node.pc) ?? 0) + 1);
    expect(byPc.size).toBe(12);
    for (const count of byPc.values()) expect(count).toBeGreaterThan(0);
  });

  it("round-trips code <-> cell", () => {
    for (const node of KEYED_NODES) {
      expect(nodeForCode(node.code)).toEqual(node);
      expect(codeForCell(node.m, node.n)).toBe(node.code);
    }
  });

  it("returns undefined for an unmapped code or cell", () => {
    expect(nodeForCode("NoSuchCap")).toBeUndefined();
    expect(codeForCell(999, 999)).toBeUndefined();
  });
});
