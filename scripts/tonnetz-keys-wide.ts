// Prints the 4x9 key block over the reoriented lattice and checks the claims
// DESIGN.md "Keyboard" makes about it, as an independent second opinion on
// src/lib/tonnetz.ts — its own copy of the geometry on purpose.

const pos = (m: number, n: number): [number, number] => [3 * n - m, 3 * (m + n)];
const pcOf = (m: number, n: number): number => ((7 * m + 3 * n) % 12 + 12) % 12;
const NAMES = ["F", "Gb", "G", "Ab", "A", "Bb", "B", "C", "Db", "D", "Eb", "E"];
// pc is measured in semitones above the lattice origin; the repo's root is F.

interface V { m: number; n: number; x: number; y: number; pc: number }
const visible = (x0: number, x1: number, y0: number, y1: number): V[] => {
  const out: V[] = [];
  for (let m = -40; m <= 40; m++) for (let n = -40; n <= 40; n++) {
    const [x, y] = pos(m, n);
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) out.push({ m, n, x, y, pc: pcOf(m, n) });
  }
  return out;
};

const KEYS = [
  ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
  ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period"],
];
// The domain's twelve caps are the block's middle three columns; the outer six
// are those same caps one horizontal period out, since (m-3,n+3) is (+12,0).
const [X0, Y0, SIZE] = [4.5, 10.5, 12];
const rows = (() => {
  const caps = visible(X0, X0 + SIZE, Y0, Y0 + SIZE);
  const ys = [...new Set(caps.map((c) => c.y))].sort((a, b) => b - a);
  return ys.map((y) => caps.filter((c) => c.y === y).sort((a, b) => a.x - b.x));
})();

const keyOf = new Map<string, string>();
const capOf = new Map<string, V>();
const hinted = new Set<string>();
rows.forEach((row, r) => row.forEach((cap, i) => {
  for (const k of [-1, 0, 1]) {
    const code = KEYS[r]?.[i + 3 + 3 * k];
    if (!code) continue;
    const [m, n] = [cap.m - 3 * k, cap.n + 3 * k];
    const [x, y] = pos(m, n);
    keyOf.set(`${m},${n}`, code);
    capOf.set(code, { m, n, x, y, pc: pcOf(m, n) });
    if (k === 0) hinted.add(code);
  }
}));

console.log(`${capOf.size} keys placed, ${new Set([...capOf.values()].map((c) => c.pc)).size} distinct pitch classes\n`);
for (const row of KEYS) {
  console.log("  " + row.map((c) => {
    const cap = capOf.get(c);
    return `${c.replace(/^Key|^Digit/, "")}=${cap ? NAMES[cap.pc]!.padEnd(2) : "--"}${hinted.has(c) ? "*" : " "}`;
  }).join(" "));
}
console.log("  (* = hinted, i.e. inside the fundamental domain)");

// What each marked viewport actually shows, at FIT_SIZE twelfths on the short axis.
const FIT_SIZE = 14, [CX, CY] = [X0 + SIZE / 2, Y0 + SIZE / 2];
console.log(`\nvisible caps at the marked viewports (${FIT_SIZE} twelfths short axis, centred on ${CX}, ${CY}):`);
for (const [label, w, h] of [["1920x1080", 1920, 1080], ["390x844", 390, 844]] as [string, number, number][]) {
  const short = Math.min(w, h);
  const [tw, th] = [FIT_SIZE * w / short, FIT_SIZE * h / short];
  const v = visible(CX - tw / 2, CX + tw / 2, CY - th / 2, CY + th / 2);
  const keyed = v.filter((c) => keyOf.has(`${c.m},${c.n}`)).length;
  const rowCount = new Set(v.map((c) => c.y)).size;
  console.log(`  ${label.padEnd(10)} ${tw.toFixed(1)}x${th.toFixed(1)} twelfths -> ${v.length} caps in ${rowCount} rows, ${keyed} of them keyed`);
}

// Compactness, and whether every code the spec suite presses still exists.
let compact = 0, on = 0;
for (const cap of visible(-12, 32, 6, 26)) {
  for (const cells of [[[0, 0], [1, 0], [0, 1]], [[1, 0], [1, 1], [0, 1]]]) {
    const ks = cells.map(([dm, dn]) => keyOf.get(`${cap.m + dm!},${cap.n + dn!}`));
    if (ks.some((k) => !k)) continue;
    on++;
    const seats = ks.map((k) => {
      const r = KEYS.findIndex((row) => row.includes(k!));
      return [r, KEYS[r]!.indexOf(k!)] as [number, number];
    });
    const span = (i: 0 | 1) => Math.max(...seats.map((s) => s[i])) - Math.min(...seats.map((s) => s[i]));
    if (span(0) <= 1 && span(1) <= 1) compact++;
  }
}
console.log(`\n${compact}/${on} fully-keyed triads fit a 2x2 key square`);

const USED = ["KeyF", "KeyG", "KeyA", "KeyL", "KeyZ", "Digit9", "Digit1", "KeyQ", "Digit5",
  "KeyU", "KeyH", "KeyN", "KeyS", "KeyD", "Comma", "Period"];
const missing = USED.filter((c) => !capOf.has(c));
console.log(`spec/crit-4.test.ts presses ${USED.length} codes; ${missing.length ? `MISSING ${missing.join(",")}` : "all present as caps"}`);

// Existence isn't enough: the spec suite also assumes certain pairs of caps
// sound *different*. On a torus, "opposite corners" can be the same note.
const pcName = (c: string) => NAMES[capOf.get(c)!.pc]!;
for (const [a, b, why] of [
  ["KeyA", "KeyS", "drag() expects two voices"],
  ["KeyZ", "KeyD", "expects two different sounds"],
] as [string, string, string][]) {
  const same = capOf.get(a)!.pc === capOf.get(b)!.pc;
  console.log(`  ${same ? "CLASH" : "ok   "} ${a}=${pcName(a)} vs ${b}=${pcName(b)} — ${why}`);
}
export {};
