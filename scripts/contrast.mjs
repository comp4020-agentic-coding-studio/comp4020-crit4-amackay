// One-off: contrast of black labels against the three cap states (oklch -> sRGB -> WCAG).
const oklchToSrgb = (L, C, H) => {
  const h = (H * Math.PI) / 180;
  const [a, b] = [C * Math.cos(h), C * Math.sin(h)];
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
// the matrix above already yields *linear* sRGB, so luminance is a plain dot
// product — no second gamma decode.
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
for (const [name, L, C] of [["rest", 0.64, 0.07], ["hover", 0.76, 0.115], ["active", 0.89, 0.175]]) {
  let worst = Infinity, worstH = 0;
  for (let H = 0; H < 360; H += 1) {
    const Y = lum(oklchToSrgb(L, C, H).map((c) => Math.min(1, Math.max(0, c))));
    const ratio = (Y + 0.05) / 0.05;
    if (ratio < worst) { worst = ratio; worstH = H; }
  }
  console.log(name, worst.toFixed(2) + ":1", "worst hue", worstH);
}
