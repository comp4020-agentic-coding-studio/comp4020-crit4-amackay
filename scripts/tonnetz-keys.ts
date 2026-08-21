// Works out the visible lattice for a given render window and fits a QWERTY
// block to it, for DESIGN.md's keyboard mapping. Planning aid, not shipped.

const pos = (m: number, n: number): [number, number] => [3 * (m + n), 3 * n - m];
const pc = (m: number, n: number): number => ((7 * m + 3 * n) % 12 + 12) % 12;
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface Vertex { m: number; n: number; x: number; y: number; pc: number }

const visible = (x0: number, x1: number, y0: number, y1: number): Vertex[] => {
  const out: Vertex[] = [];
  for (let m = -30; m <= 30; m++) {
    for (let n = -30; n <= 30; n++) {
      const [x, y] = pos(m, n);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) out.push({ m, n, x, y, pc: pc(m, n) });
    }
  }
  return out;
};

for (const [label, x0, x1, y0, y1] of [
  ["symmetric PAD 1.5", -1.5, 13.5, -1.5, 13.5],
  ["x PAD 1.5, y [-2,13]", -1.5, 13.5, -2, 13],
  ["x PAD 1.5, y [-1,14]", -1.5, 13.5, -1, 14],
] as [string, number, number, number, number][]) {
  const v = visible(x0, x1, y0, y1);
  const cols = [...new Set(v.map((p) => p.x))].sort((a, b) => a - b);
  const per = cols.map((c) => v.filter((p) => p.x === c).length);
  console.log(`${label.padEnd(24)} ${String(v.length).padStart(2)} caps  ${v.length / 15 ** 2 * 144 > 0 ? "" : ""}columns x=${cols.join(",")} holding ${per.join(",")}  ${x1 - x0}x${y1 - y0}`);
}

// The chosen window, and the QWERTY block laid over it.
const [X0, X1, Y0, Y1] = [-1.5, 13.5, -2, 13];
const caps = visible(X0, X1, Y0, Y1);
const COLS = [...new Set(caps.map((c) => c.x))].sort((a, b) => a - b);
const KEYS = [
  ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"],
  ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB"],
];

const keyOf = new Map<string, string>();
const capOf = new Map<string, Vertex>();
COLS.forEach((x, col) => {
  // Screen top first: lattice y is up, so descending y is top-to-bottom.
  const column = caps.filter((c) => c.x === x).sort((a, b) => b.y - a.y);
  column.forEach((cap, row) => {
    const code = KEYS[row]?.[col];
    if (!code) return;
    keyOf.set(`${cap.m},${cap.n}`, code);
    capOf.set(code, cap);
  });
});

console.log(`\n${caps.length} caps, ${capOf.size} keyed, ${new Set(caps.map((c) => c.pc)).size} distinct pitch classes\n`);
const short = (c: string) => c.replace(/^Key|^Digit/, "");
for (const row of KEYS) {
  console.log("  " + row.map((code) => {
    const cap = capOf.get(code);
    return cap ? `${short(code)}=${NAMES[cap.pc]!.padEnd(2)}` : `${short(code)}=--`;
  }).join("  "));
}

// Are the on-screen triads compact clusters of keys?
console.log("\ntriads as key clusters (root cell -> keys):");
let compact = 0, total = 0, offSurface = 0;
for (const cap of caps) {
  for (const [kind, cells] of [
    ["min", [[0, 0], [1, 0], [0, 1]]],
    ["maj", [[1, 0], [1, 1], [0, 1]]],
  ] as [string, number[][]][]) {
    const keys = cells.map(([dm, dn]) => keyOf.get(`${cap.m + dm!},${cap.n + dn!}`));
    total++;
    if (keys.some((k) => !k)) { offSurface++; continue; }
    const seats = keys.map((k) => {
      const r = KEYS.findIndex((row) => row.includes(k!));
      return [r, KEYS[r]!.indexOf(k!)] as [number, number];
    });
    const dr = Math.max(...seats.map((s) => s[0])) - Math.min(...seats.map((s) => s[0]));
    const dc = Math.max(...seats.map((s) => s[1])) - Math.min(...seats.map((s) => s[1]));
    if (dr <= 1 && dc <= 1) compact++;
    else console.log(`  NOT COMPACT ${kind} ${keys.map((k) => short(k!)).join("+")}`);
  }
}
console.log(`  ${compact}/${total - offSurface} on-surface triads fit a 2x2 key square (${offSurface} run off the surface)`);

export {};
