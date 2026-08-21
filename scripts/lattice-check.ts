// Checks handback.md's lattice numerically: pitch-class spacing, hue spacing,
// and the peak amplitude a phase-coherent Shepard voice reaches.
const CENTS = (ratio: number): number => 1200 * Math.log2(ratio);

interface LatticeNode {
  a: number;
  b: number;
  label: string;
  pc: number;
}

const ROWS: Array<{ b: number; keys: string }> = [
  { b: -1, keys: "123456789" },
  { b: 0, keys: "qwertyuio" },
  { b: 1, keys: "asdfghjkl" },
  { b: 2, keys: "zxcvbnm,." },
];

const nodes: LatticeNode[] = [];
for (const { b, keys } of ROWS) {
  for (let i = 0; i < keys.length; i += 1) {
    const a = i - 3;
    const ratio = 3 ** a * 5 ** b;
    nodes.push({ a, b, label: keys[i] ?? "?", pc: ((Math.log2(ratio) % 1) + 1) % 1 });
  }
}

// Pitch-class distance on the circle, in cents.
function apart(x: LatticeNode, y: LatticeNode): number {
  const d = Math.abs(x.pc - y.pc);
  return Math.min(d, 1 - d) * 1200;
}

const pairs: Array<{ x: LatticeNode; y: LatticeNode; cents: number }> = [];
for (let i = 0; i < nodes.length; i += 1) {
  for (let j = i + 1; j < nodes.length; j += 1) {
    const x = nodes[i]!;
    const y = nodes[j]!;
    pairs.push({ x, y, cents: apart(x, y) });
  }
}
pairs.sort((p, q) => p.cents - q.cents);

const near = pairs.filter((p) => p.cents < 30);
console.log(`nodes: ${nodes.length}, distinct pitch classes: ${new Set(nodes.map((n) => n.pc.toFixed(9))).size}`);
console.log(`pairs closer than 30 cents: ${near.length}`);
for (const p of near.slice(0, 8)) {
  console.log(
    `  ${p.x.label} (3^${p.x.a}·5^${p.x.b}) ~ ${p.y.label} (3^${p.y.a}·5^${p.y.b}): ` +
      `${p.cents.toFixed(1)} cents, hue apart ${(p.cents / 1200 * 360).toFixed(1)}°`,
  );
}
console.log(`closest overall: ${pairs[0]!.cents.toFixed(2)} cents`);
console.log(`syntonic comma for reference: ${CENTS(81 / 80).toFixed(2)} cents`);

// Peak amplitude of one voice: eight sines, all starting at phase 0, so they
// sum coherently at t = 0 --- the loudest instant is the attack.
function partials(pc: number): number[] {
  const amps: number[] = [];
  for (let k = 0; k < 8; k += 1) {
    const f = 32 * 2 ** (pc + k);
    amps.push(Math.exp(-((Math.log2(f / 260)) ** 2) / (2 * 1.5 ** 2)));
  }
  const sum = amps.reduce((t, v) => t + v, 0);
  return amps.map((v) => v / sum);
}

const rms = nodes.map((n) => {
  const a = partials(n.pc);
  return Math.sqrt(a.reduce((t, v) => t + v * v, 0) / 2);
});
console.log(`\nper-voice coherent peak (normalised): 1.000  -> ten voices: 10.000`);
console.log(`per-voice RMS spread: ${Math.min(...rms).toFixed(4)} .. ${Math.max(...rms).toFixed(4)}`);
console.log(`loudness spread across nodes: ${(20 * Math.log10(Math.max(...rms) / Math.min(...rms))).toFixed(2)} dB`);
