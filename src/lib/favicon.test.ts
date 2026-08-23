import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { faviconDataUri, faviconSvg } from "./favicon.ts";
import { HEX } from "./tonnetz.ts";

const { DOMParser } = new JSDOM().window;

// Parsed rather than string-matched: the icon has to be a real SVG document,
// and an assertion about its shape should fail if the markup is malformed.
const parse = (svg: string): Document => {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.querySelector("parsererror"), svg).toBeNull();
  return doc;
};

describe("the tab icon", () => {
  it("draws the button hexagon, y negated for screen space", () => {
    const polygon = parse(faviconSvg()).querySelector("polygon");
    expect(polygon?.getAttribute("points")).toBe(
      HEX.map(([hx, hy]) => `${hx},${-hy}`).join(" "),
    );
  });

  it("draws nothing else", () => {
    const root = parse(faviconSvg());
    expect(root.querySelectorAll("polygon").length).toBe(1);
    // Transparent inside and out: an outline, no fill and no ground behind it.
    expect(root.querySelector("polygon")?.getAttribute("fill")).toBe("none");
    expect(root.querySelectorAll("rect, circle, path, image").length).toBe(0);
  });

  it("carries a colour for each tab bar", () => {
    const css = parse(faviconSvg()).querySelector("style")?.textContent ?? "";
    expect(css).toContain("#000");
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/);
    expect(css).toContain("#fff");
  });

  it("keeps the whole stroke inside the viewBox", () => {
    const root = parse(faviconSvg());
    const [minX, minY, width, height] = (root.documentElement.getAttribute("viewBox") ?? "")
      .split(" ")
      .map(Number) as [number, number, number, number];
    const stroke = Number(root.querySelector("polygon")?.getAttribute("stroke-width"));

    // Square and centred on the node, so the hexagon's lean reads the same
    // whichever way the icon is scaled.
    expect(width).toBe(height);
    expect(minX).toBeCloseTo(-width / 2, 10);
    expect(minY).toBeCloseTo(-height / 2, 10);

    // A round join never reaches past half the stroke width from the vertex.
    for (const [hx, hy] of HEX) {
      expect(Math.abs(hx) + stroke / 2).toBeLessThanOrEqual(width / 2);
      expect(Math.abs(hy) + stroke / 2).toBeLessThanOrEqual(height / 2);
    }
  });

  it("survives being an href", () => {
    const uri = faviconDataUri();
    expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
    // A raw `#` would end the URI at the fragment and strip the colours.
    expect(uri).not.toContain("#");
    expect(decodeURIComponent(uri.slice("data:image/svg+xml,".length))).toBe(faviconSvg());
  });
});
