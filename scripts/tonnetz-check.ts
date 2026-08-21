// Checks tonnetz-touch-handoff.md's lattice, Voronoi geometry and press
// invariants numerically, before any of it is trusted as a design authority.

const F: [number, number] = [3, -1];   // perfect fifth, +7 semitones
const B: [number, number] = [3, 3];    // minor third,   +3 semitones
const HEX: [number, number][] = [[2, 1], [1, 2], [-1, 2], [-2, -1], [-1, -2], [1, -2]];
const R = 0.45;

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

// 4. Circumcenters at integer offsets, all at R = sqrt(5).
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

// 5. The shared hexagon really is the Voronoi cell of the origin.
const hexIsVoronoi = HEX.every((v) => {
  const d0 = len(v);
  for (let m = -6; m <= 6; m++) {
    for (let n = -6; n <= 6; n++) {
      if (m === 0 && n === 0) continue;
      if (len(sub(v, pos(m, n))) < d0 - 1e-9) return false;
    }
  }
  return true;
});
check("all six hexagon vertices are Voronoi vertices of the origin cell", hexIsVoronoi);
const hexEdges = HEX.map((v, i) => len(sub(HEX[(i + 1) % 6]!, v)).toFixed(3));
check("Voronoi edge lengths sqrt(10)=3.162, 2.000, sqrt(2)=1.414", new Set(hexEdges).size === 3, hexEdges.join(" "));

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

// 8. The <=3 invariant's threshold: should break just above sqrt(2)/2 = 0.7071.
let threshold = 0;
for (let r = 0.40; r < 0.90; r += 0.001) {
  let over = false;
  for (let x = 0; x < 12 && !over; x += 12 / 300) {
    for (let y = 0; y < 12 && !over; y += 12 / 300) if (pressed(x, y, r).length > 3) over = true;
  }
  if (over) { threshold = r; break; }
}
check("invariant breaks just above sqrt(2)/2 = 0.707", Math.abs(threshold - Math.SQRT2 / 2) < 0.02, `broke at r=${threshold.toFixed(3)}`);

// 9. Derived target sizes quoted in section 3.
check("note core width 2*(sqrt(10)/2 - r) = 2.262", Math.abs(2 * (Math.sqrt(10) / 2 - R) - 2.262) < 5e-4);
check("m3 dyad usable length sqrt(2) - 2r = 0.514", Math.abs(Math.SQRT2 - 2 * R - 0.514) < 5e-4);

console.log(fails.length ? `\n${fails.length} FAILED` : "\nall checks passed");

export {};
