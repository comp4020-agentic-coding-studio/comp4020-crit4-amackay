# Patch: equilateral buttons + locked press radius

Two design changes to the Tonnetz touch instrument, superseding the Voronoi
button geometry from the original hand-off. The implementation has drifted
from that document, so everything below is phrased as target state — locate
the corresponding code rather than assuming it matches the old spec. All
coordinates are in "twelfth" units (fundamental domain 12 × 12, y up, pc 0 at
the origin, lattice basis F = (3,−1) fifth, B = (3,3) minor third,
pc(m,n) = (7m+3n) mod 12).

## Change 1 — button shape: Voronoi cell → equilateral hexagon

Buttons remain identical lattice translates of one hexagon, centrally
symmetric about their note. Only the shape changes. New vertex offsets from
the node, CCW (all half-integers):

```
(2, 1/2), (1, 5/2), (-1, 3/2), (-2, -1/2), (-1, -5/2), (1, -3/2)
```

This replaces the Voronoi hexagon (2,1), (1,2), (−1,2), (−2,−1), (−1,−2),
(1,−2). If the current code *derives* the cell — from perpendicular
bisectors, circumcenters, or half-distances |w|/2 — delete the derivation and
use the explicit constant list: the cell is intentionally no longer Voronoi,
so bisector-based construction is now wrong, not merely stale.

Properties of the new hexagon (update anything that assumed the old values):

- All six edges have length E = √5 ≈ 2.2361. Boundary → neighbour map:
  (2,½)–(1,5/2) separates pc x from x+3 (m3); (1,5/2)–(−1,3/2) from x+4 (M3);
  (−1,3/2)–(−2,−½) from x+7 (P5); opposite edges by central symmetry.
- Corners are still triple points: the (2,½) orbit is the minor-triad corner
  (buttons {x, x+3, x+7} meet); the node+(4,3/2) orbit is the major-triad
  corner ({x+3, x+7, x+10}).
- Node-to-boundary distances: 0.9√5 ≈ 2.012 (m3), 0.8√5 ≈ 1.789 (M3),
  0.7√5 ≈ 1.565 (P5). The old values were √18/2, 2, √10/2.
- There is no single node-to-corner radius any more (corner distances range
  ≈ 1.803–2.693). Any use of the old circumradius R = √5 for corner placement
  must switch to the explicit vertex list. Beware a numeric collision: √5 was
  the old *circumradius* and is the new *edge length* — a bare 2.236 in the
  code could be either; check intent before migrating it.
- The hexagon is still convex and CCW, so point-in-polygon and
  point-to-edge-distance hit-testing carries over unchanged.

## Change 2 — press radius: r = √5/4 ≈ 0.55902 (was 0.45)

Design rule: along every button boundary, the first quarter of the edge
presses one triad, the middle half presses the dyad, and the last quarter
presses the other triad — equivalently, adjacent triad corners (distance
E = √5) are exactly 4r apart. This 25/50/25 split is identical on all three
boundary types because the hexagon is equilateral.

- The ≤3-buttons-per-touch invariant now has a uniform threshold r < √5/2 on
  every edge; the locked r sits at exactly half that (2× margin). Keep or add
  the assert.
- Hysteresis: keep leave-threshold = r + h with absolute h ≈ 0.08; if h is
  currently expressed relative to r, recheck the resulting value.

## Derived constants (update wherever surfaced: debug overlays, sizing, docs)

- Triad spot diameter = 2r = √5/2 ≈ 1.118. Dyad zone = √5/2 wide × √5/2
  usable length, identical for all three interval types.
- Note core minimum widths: 0.9√5 ≈ 2.012 (P5 direction), 1.1√5 (M3),
  1.3√5 (m3).
- Physical sizing: 7 mm triad spots need u ≥ 14/√5 ≈ 6.26 mm/twelfth, i.e. a
  75 × 75 mm fundamental domain (was ~93 mm at r = 0.45 Voronoi).

Migration grep list — old values that must not survive: `0.45` (radius),
`0.707`/`0.7071` (old m3 4-press threshold), boundary lengths `1.4142` / `2` /
`3.1623` (√2, 2, √10), half-distances `1.5811` / `2.1213`, vertex constants
`(2,1)` and `(4,1)` as corner offsets. (`2` and `(2,1)` are common values —
verify context.)

## Tests

- Update tests pinned to Voronoi vertices, half-distances, or r = 0.45.
- New property test, run per boundary type (m3, M3, P5): sampling points along
  the boundary at parameter t, t ∈ (0, 0.25) ∪ (0.75, 1) presses 3 pcs and
  t ∈ (0.25, 0.75) presses 2, with a small exclusion band around t = 0.25 and
  0.75 for float/hysteresis tolerance. This one test pins the radius, the
  hexagon, and the hit-test simultaneously.
- Existing invariants that must still pass unchanged: 12 distinct pcs;
  lattice neighbours are pc ±3, ±4, ±7; single touch never exceeds 3 pcs;
  margin taps resolve to the wrapped in-domain identity; drag across a
  boundary between triad corners changes exactly one pc with two sustained
  (P across P5 boundaries, R across M3, L across m3); multi-touch refcount
  release correctness.

## Explicitly unchanged

Lattice basis and pc formula; straight wrap and the live margin; the hit-test
structure (alpha/beta cell lookup, 5×5 candidate scan, disk-vs-hexagon
distance); the multi-touch pointer/refcount/hysteresis lifecycle and the
drag-as-voice-leading behaviour; audio; buttons-only rendering.
