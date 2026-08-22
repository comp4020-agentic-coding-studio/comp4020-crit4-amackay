// Checks the lattice, button-hexagon geometry and press invariants
// numerically, as an independent second opinion on src/lib/tonnetz.ts — not
// the contract, DESIGN.md "Build order".

const F: [number, number] = [3, -1];   // perfect fifth, +7 semitones
const B: [number, number] = [3, 3];    // minor third,   +3 semitones
const HEX: [number, number][] = [[2, 0.5], [1, 2.5], [-1, 1.5], [-2, -0.5], [-1, -2.5], [1, -1.5]];
const R = Math.sqrt(5) / 4;

const pos = (m: number, n: number): [number, number] => [m * F[0] + n * B[0], m * F[1] + n * B[1]];
const pc = (m: number, n: number): number => ((7 * m + 3 * n) % 12 + 12) % 12;
const sub = (a: [number, number], b: [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]];
const len = (v: [number, number]): number => Math.hypot(v[0], v[1]);

const fails: string[] = [];
const check = (label: string, ok: boolean, detail = ""): void => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) fails.push(label);
};

// 1. The square [0,12)^2 is a fundamental domain holding each pc exactly once.
const inDomain: { m: number; n: number; pc: number }[] = [];
for (let m = -20; m <= 20; m++) {
  for (let n = -20; n <= 20; n++) {
    const [x, y] = pos(m, n);
    if (x >= 0 && x < 12 && y >= 0 && y < 12) inDomain.push({ m, n, pc: pc(m, n) });
  }
}
check("[0,12)^2 holds 12 vertices", inDomain.length === 12, `got ${inDomain.length}`);
check("...one per pitch class", new Set(inDomain.map((v) => v.pc)).size === 12);
check("cell area 12 => 144/12 = 12 vertices", Math.abs(F[0] * B[1] - F[1] * B[0]) === 12);

// 2. Straight wrap: translating by 12 in x or y lands on the same pitch class.
const wrapOk = inDomain.every(({ m, n, pc: p }) => pc(m + 3, n + 1) === p && pc(m - 3, n + 3) === p);
check("wrap by (12,0) = (m+3,n+1) and (0,12) = (m-3,n+3) preserve pc", wrapOk);
check("...those translations really are (12,0) and (0,12)",
  String(sub(pos(3, 1), pos(0, 0))) === "12,0" && String(sub(pos(-3, 3), pos(0, 0))) === "0,12");

// 3. Six lattice neighbours are pc +/-3, +/-4, +/-7.
const NEIGHBOURS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const rel = NEIGHBOURS.map(([dm, dn]) => pc(dm, dn)).sort((a, b) => a - b);
check("neighbour intervals are {3,4,5,7,8,9} = +/-3,+/-4,+/-7", String(rel) === "3,4,5,7,8,9", String(rel));
const nbVecs = NEIGHBOURS.map(([dm, dn]) => len(sub(pos(dm, dn), [0, 0])).toFixed(3));
check("edge lengths P5=3.162 M3=4.000 m3=4.243", new Set(nbVecs).size === 3, nbVecs.join(" "));

// 4. Triangle circumcenters at integer offsets, all at circumradius sqrt(5).
// That sqrt(5) is the triangulation's, not the button's — the press radius R
// above is a different quantity that happens to be derived from the same
// surd (tonnetz-equilateral-patch.md warns about exactly this collision).
const ccLower: [number, number] = [2, 1];
const ccUpper: [number, number] = [4, 1];
const lowerTri: [number, number][] = [pos(0, 0), pos(1, 0), pos(0, 1)];
const upperTri: [number, number][] = [pos(1, 0), pos(1, 1), pos(0, 1)];
const equidistant = (c: [number, number], tri: [number, number][]) =>
  tri.every((v) => Math.abs(len(sub(c, v)) - Math.SQRT2 * Math.sqrt(2.5)) < 1e-12);
check("lower circumcenter (2,1) equidistant sqrt(5) from its triad", equidistant(ccLower, lowerTri));
check("upper circumcenter (4,1) equidistant sqrt(5) from its triad", equidistant(ccUpper, upperTri));
check("lower triangle is a minor triad rooted at pc(m,n)",
  String(lowerTri.map((_, i) => pc([0, 1, 0][i]!, [0, 0, 1][i]!)).sort((a, b) => a - b)) === "0,3,7");
check("upper triangle is a major triad rooted at pc(m,n)+3",
  String([pc(1, 0), pc(1, 1), pc(0, 1)].map((p) => (p - 3 + 12) % 12).sort((a, b) => a - b)) === "0,4,7");

// 5. The button hexagon is equilateral — deliberately not the Voronoi cell
// (see tonnetz-equilateral-patch.md): every edge is the same length, sqrt(5).
const hexEdges = HEX.map((v, i) => len(sub(HEX[(i + 1) % 6]!, v)).toFixed(3));
check("all six edges equal length sqrt(5)=2.236", new Set(hexEdges).size === 1, hexEdges.join(" "));

// Node-to-edge (apothem) distances differ by boundary type, per the patch:
// 0.9*sqrt(5) (m3), 0.8*sqrt(5) (M3), 0.7*sqrt(5) (P5).
const apothem = (a: [number, number], b: [number, number]) =>
  Math.abs(a[0] * b[1] - a[1] * b[0]) / len(sub(b, a));
const [ap01, ap12, ap23] = [apothem(HEX[0]!, HEX[1]!), apothem(HEX[1]!, HEX[2]!), apothem(HEX[2]!, HEX[3]!)];
check("m3 apothem 0.9*sqrt(5)=2.012", Math.abs(ap01 - 0.9 * Math.sqrt(5)) < 1e-9, ap01.toFixed(4));
check("M3 apothem 0.8*sqrt(5)=1.789", Math.abs(ap12 - 0.8 * Math.sqrt(5)) < 1e-9, ap12.toFixed(4));
check("P5 apothem 0.7*sqrt(5)=1.565", Math.abs(ap23 - 0.7 * Math.sqrt(5)) < 1e-9, ap23.toFixed(4));

// 6. The hit test of section 4, and the <=3-press invariant.
const cellDist = (p: [number, number], node: [number, number]): number => {
  const q = sub(p, node);
  let inside = true;
  let best = Infinity;
  for (let i = 0; i < 6; i++) {
    const a = HEX[i]!, b = HEX[(i + 1) % 6]!;
    const e = sub(b, a), w = sub(q, a);
    if (e[0] * w[1] - e[1] * w[0] < 0) inside = false;
    const t = Math.max(0, Math.min(1, (w[0] * e[0] + w[1] * e[1]) / (e[0] ** 2 + e[1] ** 2)));
    best = Math.min(best, len(sub(w, [e[0] * t, e[1] * t])));
  }
  return inside ? 0 : best;
};

const pressed = (x: number, y: number, r: number): number[] => {
  const m0 = Math.floor((x - y) / 4), n0 = Math.floor(x / 12 + y / 4);
  const out = new Set<number>();
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      if (cellDist([x, y], pos(m0 + i, n0 + j)) < r) out.add(pc(m0 + i, n0 + j));
    }
  }
  return [...out].sort((a, b) => a - b);
};

const counts = new Map<number, number>();
let worst = 0;
for (let x = 0; x < 12; x += 12 / 700) {
  for (let y = 0; y < 12; y += 12 / 700) {
    const k = pressed(x, y, R).length;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    worst = Math.max(worst, k);
  }
}
const total = [...counts.values()].reduce((a, b) => a + b, 0);
const share = [...counts.entries()].sort().map(([k, v]) => `${k}:${(100 * v / total).toFixed(1)}%`).join(" ");
check(`no touch at r=${R} presses more than 3 pitch classes`, worst <= 3, `max ${worst}; area split ${share}`);
check("every count 1..3 is reachable", [1, 2, 3].every((k) => (counts.get(k) ?? 0) > 0));

// 7. Every 3-press is a major or minor triad; every 2-press a third or a fifth.
const bad3: string[] = [], bad2: string[] = [];
for (let x = 0; x < 12; x += 12 / 400) {
  for (let y = 0; y < 12; y += 12 / 400) {
    const s = pressed(x, y, R);
    if (s.length === 3) {
      const iv = [1, 2].map((i) => (s[i]! - s[0]! + 12) % 12).sort((a, b) => a - b);
      if (String(iv) !== "3,7" && String(iv) !== "4,7" && String(iv) !== "4,9" && String(iv) !== "5,8" &&
          String(iv) !== "3,8" && String(iv) !== "5,9") bad3.push(String(s));
    }
    if (s.length === 2) {
      const iv = Math.min((s[1]! - s[0]! + 12) % 12, (s[0]! - s[1]! + 12) % 12);
      if (![3, 4, 5].includes(iv)) bad2.push(`${s} (${iv})`);
    }
  }
}
check("every three-press is a major or minor triad", bad3.length === 0, bad3.slice(0, 3).join(" "));
check("every two-press is a third or a fifth", bad2.length === 0, bad2.slice(0, 3).join(" "));

// 8. The <=3 invariant's threshold: should break just above sqrt(5)/2 = 1.118
// (uniform across all three edge types, unlike the old per-edge apothems —
// tonnetz-equilateral-patch.md "Change 2").
let threshold = 0;
for (let r = 0.40; r < 1.30; r += 0.001) {
  let over = false;
  for (let x = 0; x < 12 && !over; x += 12 / 300) {
    for (let y = 0; y < 12 && !over; y += 12 / 300) if (pressed(x, y, r).length > 3) over = true;
  }
  if (over) { threshold = r; break; }
}
check("invariant breaks just above sqrt(5)/2 = 1.118", Math.abs(threshold - Math.sqrt(5) / 2) < 0.02, `broke at r=${threshold.toFixed(3)}`);
check("locked r sits at exactly half the threshold (2x margin)", Math.abs(R - (Math.sqrt(5) / 2) / 2) < 1e-12);

// 9. Derived target sizes from tonnetz-equilateral-patch.md "Derived constants".
check("triad spot diameter 2r = sqrt(5)/2 = 1.118", Math.abs(2 * R - Math.sqrt(5) / 2) < 1e-9);
const E = len(sub(HEX[1]!, HEX[0]!));
check("dyad zone usable length E/2 = sqrt(5)/2 = 1.118", Math.abs(E / 2 - Math.sqrt(5) / 2) < 1e-9);
check("P5 note core width 2*(0.7*sqrt(5) - r) = 0.9*sqrt(5) = 2.012",
  Math.abs(2 * (ap23 - R) - 0.9 * Math.sqrt(5)) < 1e-9);
check("M3 note core width 2*(0.8*sqrt(5) - r) = 1.1*sqrt(5) = 2.460",
  Math.abs(2 * (ap12 - R) - 1.1 * Math.sqrt(5)) < 1e-9);
check("m3 note core width 2*(0.9*sqrt(5) - r) = 1.3*sqrt(5) = 2.907",
  Math.abs(2 * (ap01 - R) - 1.3 * Math.sqrt(5)) < 1e-9);

// 10. Is a 5x5 scan needed, or do the containing cell and its six neighbours
// suffice? SVG hit-tests the hexagon for us, so the cheaper form ships.
const nearestNode = (x: number, y: number): [number, number] => {
  const m0 = Math.floor((x - y) / 4), n0 = Math.floor(x / 12 + y / 4);
  let best: [number, number] = [m0, n0], bestD = Infinity;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const d = len(sub([x, y], pos(m0 + i, n0 + j)));
    if (d < bestD) { bestD = d; best = [m0 + i, n0 + j]; }
  }
  return best;
};
const scanCells = (x: number, y: number, r: number): string[] => {
  const m0 = Math.floor((x - y) / 4), n0 = Math.floor(x / 12 + y / 4);
  const out: string[] = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
    if (cellDist([x, y], pos(m0 + i, n0 + j)) < r) out.push(`${m0 + i},${n0 + j}`);
  return out.sort();
};
const nbrCells = (x: number, y: number, r: number): string[] => {
  const [cm, cn] = nearestNode(x, y);
  return [[0, 0], ...NEIGHBOURS]
    .map(([dm, dn]) => [cm + dm!, cn + dn!] as [number, number])
    .filter(([m, n]) => cellDist([x, y], pos(m, n)) < r)
    .map(([m, n]) => `${m},${n}`)
    .sort();
};
let agree = true;
for (let x = 0; x < 12 && agree; x += 12 / 500)
  for (let y = 0; y < 12 && agree; y += 12 / 500)
    if (String(scanCells(x, y, R)) !== String(nbrCells(x, y, R))) agree = false;
check(`containing cell + 6 neighbours == 5x5 scan at r=${R}`, agree);

let nbrLimit = 0;
for (let r = R; r < 2.2; r += 0.02) {
  let ok = true;
  for (let x = 0; x < 12 && ok; x += 12 / 90)
    for (let y = 0; y < 12 && ok; y += 12 / 90)
      if (String(scanCells(x, y, r)) !== String(nbrCells(x, y, r))) ok = false;
  if (!ok) { nbrLimit = r; break; }
}
check("...and keeps agreeing well past the <=3 press limit", nbrLimit > 1.3,
  `diverges only at r=${nbrLimit.toFixed(3)}, vs the r<1.118 the design needs`);

console.log(fails.length ? `\n${fails.length} FAILED` : "\nall checks passed");
export {};
