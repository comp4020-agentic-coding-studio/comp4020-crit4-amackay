# Tonnetz Touch — implementation hand-off

A touch-screen instrument for the 12-TET Tonnetz. One fundamental domain of the
pitch-class torus is shown as an axis-aligned square with straight wrapping on
both axes, extended by a live margin on all sides so the wrap is visible at a
glance. Every pitch class is a Voronoi-cell button; a touch is modelled as a
disk, and it presses every button the disk overlaps — one button plays a note,
two play a dyad, three play a triad. The geometry guarantees those are the only
possibilities, and that every dyad is a fifth or third and every triad is major
or minor.

This document is self-contained and can seed PROJECT.md.

## 1. Locked decisions

| Decision | Value | Rationale |
|---|---|---|
| Wrap | Straight on both axes | Wrapping must be obvious to users at a glance |
| Aspect ratio | 1:1 (square fundamental domain) | Simplicity; makes all Voronoi geometry integer (see §3) |
| Press radius r | 0.45 twelfths | Balanced targets; keeps the ≤3-press invariant with margin |
| Max buttons per touch | 3 (geometric consequence, not a clamp) | Tetrads are played with two fingers — this is a multi-touch instrument |
| Margin | Live (tappable), rendered at reduced opacity | Ghost content resolves to the same pitch classes automatically |
| Triangle colour convention | Major = red tint, minor = blue tint | Matches standard Tonnetz renderings |

Deliberately rejected: single-touch tetrad presses (r > 0.707 would enable
maj7/m7 chords at Voronoi-edge midpoints — cut in favour of multi-touch);
equilateral triangles (impossible with straight wrap — proven, don't revisit);
the scalene 7:8:9 layout at aspect √5/2 (superseded by 1:1, though the code
should keep aspect as an internal parameter, since everything below
generalises).

## 2. Coordinate system and lattice

Work in "twelfth" units, y up, fundamental domain [0,12) × [0,12). Rendering
margin: PAD = 1.5 twelfths on all sides.

Lattice basis (fifth and minor-third steps):

```
F = (3, -1)    # +7 semitones (perfect fifth)
B = (3,  3)    # +3 semitones (minor third)
```

Vertex (m, n) has position `m*F + n*B = (3(m+n), 3n - m)` and pitch class:

```
pc(m, n) = (7m + 3n) mod 12
```

pc 0 sits at the origin. The derived major-third step is `F - B = (0, -4)`
(pc +4 is 4 twelfths *down*; columns ascend in descending major thirds — the
four augmented-triad columns at x = 0, 3, 6, 9). The pc formula is valid for
all integers (m, n), which is what makes the margin live with zero extra code:
never reduce coordinates into the fundamental domain.

Edge lengths: P5 = √10 ≈ 3.162, M3 = 4, m3 = √18 ≈ 4.243. The intended
ordering fifth < major third < minor third (shorter = simpler relationship)
holds. All triangles are acute, so the Delaunay triangulation equals the
Tonnetz mesh and every triangle is a major or minor triad:

- Lower triangle of cell (m,n): vertices (m,n), (m+1,n), (m,n+1) — the minor
  triad rooted at pc(m,n).
- Upper triangle: (m+1,n), (m+1,n+1), (m,n+1) — the major triad rooted at
  pc(m,n)+3.

## 3. Voronoi geometry (all integer at aspect 1:1)

Circumcenters (= Voronoi vertices = triad spots), as offsets from the cell's
origin vertex (m, n):

```
cc_lower = node + (2, 1)   # minor triad spot
cc_upper = node + (4, 1)   # major triad spot
```

Both at distance R = √5 ≈ 2.236 (the circumradius) from their three notes.

Each note's Voronoi cell is the hexagon with these vertex offsets from the
node, in CCW order:

```
(2, 1), (1, 2), (-1, 2), (-2, -1), (-1, -2), (1, -2)
```

Equivalently: intersection of six half-planes, one per neighbour vector
w ∈ {±F, ±B, ±(0,4)}, each at perpendicular distance |w|/2. Half-distances:
√10/2 ≈ 1.581 (P5, the tightest), 2 (M3), √18/2 ≈ 2.121 (m3).

Voronoi edge lengths (distance between the two triad spots flanking each
lattice edge): crossing a P5 edge √10 ≈ 3.162, an M3 edge 2, an m3 edge
√2 ≈ 1.414. Sliding a finger between the two triad spots across an edge is a
neo-Riemannian transformation: P across fifth edges, R across major-third
edges, L across minor-third edges.

Derived target sizes at r = 0.45 (twelfths):

| Target | Size |
|---|---|
| Note core (eroded hexagon min width) | 2·(√10/2 − 0.45) ≈ 2.262 |
| Dyad band width | 2r = 0.9 |
| Triad spot diameter | 2r = 0.9 |
| m3 dyad usable length | √2 − 2r ≈ 0.514 (the cramped one — known and accepted) |
| ≤3-press invariant | holds iff r < √2/2 ≈ 0.707 ✓ |

## 4. Touch model and hit-test

A touch at (x, y) (twelfths, margin included) presses button (m, n) iff
`dist((x,y), cell(m,n)) < r`. O(1) per touch:

```
alpha = (x - y) / 4          # fifth-steps      (general aspect s: (x/s - y)/4)
beta  = x / 12 + y / 4       # minor-third steps (general: x/(12s) + y/4)
m0, n0 = floor(alpha), floor(beta)
pressed = []
for i in -2..2, j in -2..2:
    if cellDist((x,y), node(m0+i, n0+j)) < r:
        pressed.append((m0+i, n0+j))
```

`cellDist`: translate the shared hexagon to the node; return 0 if the point is
inside (all six CCW cross products ≥ 0), else the min point-to-segment distance
over the six edges. The pressed pc set is `{pc(m,n)}` deduplicated — distinct
cells in the margin can share a pc with their wrapped twin; press each pc once.

Geometry guarantees |pressed pcs| ≤ 3 at r = 0.45; an assert is cheap and
worth keeping.

## 5. Multi-touch lifecycle

Use Pointer Events (`pointerdown/move/up/cancel`) with `touch-action: none` on
the surface; maintain `Map<pointerId, Set<pc>>`.

- The sounding set is the multiset union across pointers: refcount each pc.
  Voice starts when a pc's refcount goes 0→1, releases on 1→0. Two fingers on
  adjacent triad spots = a seventh-type tetrad; that is the intended tetrad
  path.
- On `pointermove`, recompute the pointer's set and diff: note-on the
  additions, note-off the removals, leave the intersection sounding. This is
  what makes a slow drag from cell core → dyad band → triad spot sound as
  voice leading with common tones sustained. It's the signature interaction —
  protect it.
- Hysteresis: a pc joins a pointer's set when cellDist < r and leaves only
  when cellDist > r + h, with h ≈ 0.08 twelfths, to prevent boundary flicker
  while holding.

## 6. Rendering

Layers, bottom to top:

1. Dyad bands: each Voronoi edge (segment between adjacent circumcenters)
   stroked 2r wide, neutral colour, low opacity, butt caps.
2. Triad spots: disks radius r at circumcenters; major red tint, minor blue.
3. Thin Voronoi cell outlines (the same segments, 1px).
4. Note caps: the hexagon eroded by r (same six half-planes with offsets
   |w|/2 − r; vertices by intersecting consecutive offset lines), filled with
   the pc colour — suggested `hsl(pc·30°, 62%, 50%)` for a chromatic wheel.
5. Note labels.
6. Fundamental-domain outline.

Margin content identical but at ~0.35 opacity; fully interactive. Pressed
feedback: highlight the pressed caps/spots (and optionally render touch disks
in a debug mode). All node and circumcenter coordinates are integers, so
geometry can be precomputed once per aspect/r change; only highlights are
per-frame.

## 7. Audio

Web Audio, AudioContext created lazily on first gesture. Base frequency
261.63 · 2^(pc/12) (single octave to start). For recognised sets, voice from
the root upward rather than pc-sorted clusters: templates
maj [0,4,7], min [0,3,7]; dyads [0,7], [0,4], [0,3] (interval class 5 → P5).
Simple attack/release envelope per voice; voices are refcounted per §5.
Octave strategy, sustain, and timbre are open — start minimal.

## 8. Sizing and tuning knobs

Fit `12 + 2·PAD` twelfths to the short viewport dimension. Physical targets at
scale u mm/twelfth: triad and dyad = 0.9u mm, note core = 2.26u mm. Meeting
the ~7 mm touch guideline for triads needs u ≈ 7.8, i.e. a ~93 mm fundamental
domain plus margins — tablet-first; on phones triad spots fall below guideline
size (known tradeoff, notes stay comfortable).

Expose as settings (defaults locked per §1): r (effective press radius —
smaller than a physical fingertip is correct; grows note cores and the m3 dyad
at the expense of triad spots; must stay < 0.707), hysteresis h, PAD, and
internally aspect s.

## 9. Acceptance checks

1. Exactly 12 distinct pitch classes; each node's six lattice neighbours are
   pc ±3, ±4, ±7.
2. Tapping a cell core / dyad band / triad spot yields 1 / 2 / 3 pcs with the
   correct identities, including everywhere in the margin (wrapped identity
   equals the in-domain twin).
3. No single touch ever exceeds 3 pcs at r = 0.45 (property test over a grid
   of touch points).
4. Dragging across an edge between two triad spots performs P/L/R: exactly one
   pc changes, two are sustained without retriggering.
5. Two simultaneous pointers on adjacent triads sound the 4-note union; lifting
   one releases only its non-shared pc (refcount correctness).
6. Holding a finger still on a boundary produces no on/off flicker.

## 10. Out of scope for v1

Octave selection, sustain pedal, velocity, non-12-TET generalisation, the
brick-wall (shifted-wrap) exact-equilateral variant, and MIDI out. The
geometry section is written to generalise over aspect s if the scalene layout
is ever revisited.
