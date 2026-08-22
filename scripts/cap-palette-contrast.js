// One-off: WCAG contrast of the cap labels against each cap state, for the
// darker/duller resting palette. Oklab L is cube-root-ish in luminance, so
// Y ~= L**3 for the achromatic case, which is close enough to rank candidates
// before looking at them in a browser.
const ratio = (la, lb) => {
  const [ya, yb] = [la ** 3, lb ** 3];
  const [hi, lo] = ya > yb ? [ya, yb] : [yb, ya];
  return (hi + 0.05) / (lo + 0.05);
};

const label = 0.25;
const states = { rest: 0.64, hover: 0.76, active: 0.89 };
const current = { rest: 0.75, hover: 0.81, active: 0.88 };

console.log("label L =", label, "(was 0.28)\n");
for (const [name, l] of Object.entries(states)) {
  console.log(`${name.padEnd(7)} L=${l}  ratio ${ratio(l, label).toFixed(2)}:1   (key glyph at 0.6 alpha ~ ${ratio(l, l + (label - l) * 0.6).toFixed(2)}:1)`);
}
console.log("\nfor comparison, today:");
for (const [name, l] of Object.entries(current)) {
  console.log(`${name.padEnd(7)} L=${l}  ratio ${ratio(l, 0.28).toFixed(2)}:1`);
}
console.log("\nstate separation (oklch L steps):");
console.log("  new:", states.hover - states.rest, "then", (states.active - states.hover).toFixed(2));
console.log("  old:", (current.hover - current.rest).toFixed(2), "then", (current.active - current.hover).toFixed(2));
