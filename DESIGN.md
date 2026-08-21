# DESIGN.md — the instrument

The implementation authority for this prototype. `CLAUDE.md` governs how to work
in the repo; this file governs what to build. Where they disagree, `CLAUDE.md`
wins on process and this file wins on the artefact.

The design arrived as `tonnetz-touch-handoff.md`, written in a conversation that
had never seen this repo. Its geometry is verified numerically by
`scripts/tonnetz-check.ts` — every claim it makes holds. Its assumptions about
audio, input and testing did not survive contact with what is already here; the
"Reconciled from the hand-off" section below records what changed and why. This
file is the authority, not the hand-off.

## What it is

One fundamental domain of the 12-TET pitch-class torus, drawn as a square
Tonnetz that wraps straight on both axes and keeps going past the edges. Every
pitch class is a Voronoi cell. A touch is a disk, and it presses every cell the
disk overlaps: one cell sounds a note, two sound a dyad, three sound a triad.
The geometry — not a clamp — guarantees those are the only possibilities, that
every dyad is a third or a fifth, and that every triad is major or minor.

Sliding a finger from a cell into a band and on to a triad spot is the signature
gesture: notes join and leave underneath it while the common tones stay
sounding. Two fingers reach seventh chords. There is no score, no fail state,
no instructions, and no text on the page beyond the cap labels.

## The lattice

Work in *twelfths*, y up, fundamental domain [0,12) × [0,12).

```
F = (3, -1)    fifth,       +7 semitones
B = (3,  3)    minor third, +3 semitones
```

Vertex `(m, n)` sits at `m·F + n·B = (3(m+n), 3n − m)` and sounds

```
pc(m, n) = (7m + 3n) mod 12
```

The formula is valid for every integer pair, which is what makes the surface
outside the fundamental domain live at zero cost: **never reduce `(m, n)` into
the domain.** Translating by `(12, 0)` (i.e. `m+3, n+1`) or `(0, 12)`
(`m−3, n+3`) preserves the pitch class, so the square really is a fundamental
domain and it really does hold each of the twelve exactly once.

Edge lengths run fifth < major third < minor third — `√10 ≈ 3.162`, `4`,
`√18 ≈ 4.243` — so the shortest edge is the simplest relationship. All
triangles are acute, so the Delaunay triangulation *is* the Tonnetz mesh and
every triangle is a triad:

- lower triangle of cell `(m,n)`: `(m,n), (m+1,n), (m,n+1)` — **minor**, rooted
  at `pc(m,n)`
- upper triangle: `(m+1,n), (m+1,n+1), (m,n+1)` — **major**, rooted at
  `pc(m,n)+3`

The derived major-third step is `F − B = (0, −4)`: pitch class rises as the
screen descends, and the four columns at `x = 0, 3, 6, 9` are the four
augmented triads.

### Voronoi geometry — all integer

Because the aspect ratio is 1:1, every circumcenter is an integer offset from
its cell's origin vertex:

```
minor triad spot = node + (2, 1)
major triad spot = node + (4, 1)
```

both at circumradius `R = √5`. Each cell is the hexagon with vertex offsets

```
(2, 1), (1, 2), (-1, 2), (-2, -1), (-1, -2), (1, -2)     CCW
```

equivalently the intersection of six half-planes, one per neighbour
`w ∈ {±F, ±B, ±(0,4)}` at perpendicular distance `|w|/2`. Voronoi edges are
`√10` across a fifth, `2` across a major third, `√2` across a minor third;
crossing one is a neo-Riemannian move (P, R, L respectively).

**Every coordinate above is an integer.** The whole surface can be emitted once
as static geometry; nothing is recomputed per frame.

## Touch model

Press radius `r = 0.45` twelfths, hysteresis `h = 0.08`. A touch at `(x, y)`
presses cell `(m, n)` iff `cellDist((x,y), node(m,n)) < r`, found in O(1):

```
alpha = (x - y) / 4          fifth steps
beta  = x / 12 + y / 4       minor-third steps
scan (floor(alpha) + i, floor(beta) + j) for i, j in -2..2
```

`cellDist` translates the shared hexagon to the node, returns 0 inside (all six
CCW cross products ≥ 0) and otherwise the minimum point-to-segment distance
over its edges. Deduplicate the result **by pitch class**, not by cell: a cell
outside the domain and its wrapped twin are the same note and must sound once.

A pitch class joins a pointer's set at `cellDist < r` and leaves only at
`cellDist > r + h`, so a held finger on a boundary does not flicker.

At `r = 0.45` the surface divides **56.6% single note / 32.2% dyad / 11.2%
triad** by area. Triads are the scarce, deliberate target; the visual design
has to make them findable, because a stranger will not go looking. The
≤3 invariant holds for any `r < √2/2 ≈ 0.707` and breaks at 0.708 —
`scripts/tonnetz-check.ts` measures the threshold rather than assuming it.

Every point of the surface presses at least one cell. There is no gap, no dead
zone, and therefore no way to touch the instrument and get silence.

## Keyboard

The hand-off is silent on the keyboard; the published spec asks for mouse,
keyboard or touch, and `spec/crit-4.test.ts` already asserts keyboard
playability. Per instruction, keys map onto **lattice positions**, not onto a
chromatic run, so a chord shape under the hand is the same shape as the
triangle on screen.

The window below (see "Sizing") makes the visible lattice exactly five columns
of four — which is exactly QWERTY's left-hand block. Columns run left to right,
rows top to bottom:

| | | | | |
|---|---|---|---|---|
| `1` C | `2` G | `3` D | `4` F | `5` C |
| `Q` E | `W` B | `E` F♯ | `R` A | `T` E |
| `A` G♯ | `S` D♯ | `D` A♯ | `F` C♯ | `G` G♯ |
| `Z` C | `X` G | `C` D | `V` F | `B` C |

Twenty caps, twenty keys, twelve distinct pitch classes. **C lands on all four
corners** — `1`, `5`, `Z`, `B` — so both wraps are visible without a word of
explanation, and the repeats in between (`Q`/`T`, `A`/`G`, `2`/`X`) say the
same thing again.

All 21 triads whose three vertices are on the surface fit inside a 2×2 square
of keys — a minor triad is `A`+`S`+`W`, a major is `S`+`W`+`E` — so triads are
one-handed. `scripts/tonnetz-keys.ts` derives the table and checks the
compactness claim; do not hand-maintain it.

Held keys stack, so keyboard and touch reach the same chords by the same rule:
the sounding set is the union.

## Tuning and synthesis

12-TET throughout, per instruction. The torus only closes because twelve fifths
land within a schisma of seven octaves; just intonation would make the lattice
infinite and dissolve the wrap, the live margin and the wrapped-twin identity
along with it.

Pitch class `p` sounds `equalTemperamentRatioFor(p)` against the root, and pc 0
is **C**. The synthesis is unchanged from what is already in `instrument.ts` and
`tuning.ts`: one voice per sounding pitch class, eight octave-spaced sine
partials under a fixed Gaussian window in absolute log-frequency, which makes
the tone **octaveless**.

That is not a leftover — it is the reason this pairing works. The Tonnetz *is* a
pitch-class space: it has no octave anywhere in its geometry. A Shepard tone has
no octave anywhere in its spectrum. The hand-off's §7 left octave strategy,
voicing and register open, and asked for triads to be voiced from the root
upward; none of that has anything to answer here, because there is no register
to place a note in. Two adjacent triad spots sound a seventh chord without
anyone choosing an inversion.

The graph, envelope, master gain and explicit oscillator stop are all as
built — see `instrument.ts` and its comments. Silence remains the rest state:
the `AudioContext` is created lazily on the first gesture and resumed on every
gesture, and every voice is released on `window` blur.

### Refcounting

`Instrument` keys voices by an opaque string and refuses a duplicate `noteOn`,
but its `noteOff` releases immediately — which is wrong once two pointers hold
the same pitch class. A thin layer above it owns
`Map<pitchClass, Set<holder>>`: a voice starts when a pitch class goes 0→1
holders and releases at 1→0, where a holder is a `pointerId` or a
`KeyboardEvent.code`. This is plain-numbers logic and belongs behind the seam,
tested without an `AudioContext`.

On `pointermove`, recompute that pointer's set and diff it: start the
additions, release the removals, leave the intersection sounding untouched.
**This diff is the signature interaction — protect it.** Retriggering a common
tone during a drag is the bug that would make the instrument sound like a grid
of buttons again.

## Interaction

### DOM contract

- The playable surface carries **`data-instrument`**.
- Each cap carries **`data-note="<KeyboardEvent.code>"`** for the twenty keyed
  caps — both the keyboard mapping and the handle the spec tests hold.
  Unkeyed caps further out are touchable but carry no `data-note`.

### Two hit-test paths, one code path

The interesting hit test is coordinate-based, and coordinates are exactly what
the test harness cannot supply: **jsdom has no layout, so every
`getBoundingClientRect()` is zero-sized and any client-to-twelfths division
yields `NaN`** — which then throws when fed to an `AudioParam`. The previous
instrument avoided this by having no position mapping at all. This one cannot.

So resolve a gesture in two steps, and never let the first one throw:

1. **Element path.** `pointerdown`/`pointerenter` on a cap identifies one cell
   directly from its `data-note`. Always available, needs no geometry.
2. **Coordinate path.** If the surface reports a non-zero rect, map client
   coordinates into twelfths through the SVG `viewBox` and run the disk
   hit-test, which refines that one cell into the true set of one, two or three
   pitch classes.

Guard on `rect.width === 0` and fall back to the element path — degrade to
doing nothing extra rather than throwing. In a real browser the coordinate path
always wins; under jsdom the instrument behaves like a one-note-per-cap grid,
which is enough for the spec tests to drive it. The geometry itself is proved
by unit tests over plain functions, where it belongs.

### Pointer

Pointer Events with `touch-action: none` on the surface, `Map<pointerId, Set<pc>>`
per pointer. Touch pointers are implicitly captured to the element where
`pointerdown` happened, so call `releasePointerCapture(event.pointerId)` in the
`pointerdown` handler or nothing will fire on the caps a finger drags onto.
`pointerup`, `pointercancel` and `pointerleave` release that pointer's set; a
lift off the surface entirely is caught on `window`, and releasing is
idempotent.

### Keyboard

Listen on `window`, keyed by `event.code`. Hold a `Set` of active codes; ignore
`event.repeat`; `keydown` starts, `keyup` releases. Unmapped keys do nothing —
never throw, never scold. `preventDefault()` on mapped keys only, so Tab,
F-keys and modifier combinations still work and the page stays escapable.

### Input chrome

`lib/input-chrome.ts` is unchanged and still called from each page script: no
context menu on the playing surface (a held finger is the primary gesture and
the browser reads a long press as a right click), no browser zoom or
overscroll, and a focus ring that belongs only to whoever is tabbing.

## Visual design

Static SVG, in twelfth units with y negated so the drawing is upright. Every
coordinate is an integer, so the surface is emitted once at build time and
never redrawn; pressing a cap toggles a class.

Layers, bottom to top, per the hand-off's §6:

1. **Dyad bands** — each Voronoi edge stroked `2r = 0.9` wide, butt caps,
   neutral and low-opacity.
2. **Triad spots** — disks of radius `r` at the circumcenters. Major warm,
   minor cool.
3. **Cell outlines** — the same segments, hairline.
4. **Note caps** — the hexagon eroded by `r` (the same six half-planes at
   `|w|/2 − r`), filled with the pitch-class colour.
5. **Cap labels.**
6. **Fundamental-domain outline.**

Layers 1 and 2 are the whole affordance argument: they are the only thing that
tells a stranger the space *between* the caps is playable, and triads are only
11% of the area. If a triad is hard to find by eye, that is a bug in this
layer, not in the tuning.

- **Colour is pitch class**, as before: `hue = 25° + 360°·pc`, `oklch(75% 0.12
  hue)` fill on `oklch(18% 0.01 260)` ground, with a darker `oklch(45% 0.1 hue)`
  edge. Lightness and chroma are constant across caps — hue is the only varying
  channel, so equal pitch-class distances look equally different. The major/minor
  warm/cool split on layer 2 is a *different* layer answering a different
  question, and does not break that rule.
- **Active state** is colour only, as before: lightness → 88%, chroma → 0.16
  over the 15 ms attack, fading back over ~500 ms so the visual tail matches the
  audible one. Nothing scales; a cap that grew would shove its neighbours.
- **Outside the fundamental domain**, everything is identical at ~0.35 opacity
  and fully interactive. The ghosting is the only cue that says "this repeats",
  and it must not read as "this is disabled".
- **Motion.** Only the transition above. No idle animation.

### Sizing

Fit **15 twelfths to the short viewport axis**, and extend the long axis with
more lattice until it fills — the caps are the same size either way, there is
just more torus. The core window is `x ∈ [−1.5, 13.5]`, `y ∈ [−2, 13]`, chosen
because it is square and holds exactly the twenty keyed caps; the vertical
margin is asymmetric because the columns are staggered by one twelfth and a
symmetric window catches three caps in one column instead of four.

At the two marked viewports:

| Viewport | Twelfth | Triad spot | Note core |
|---|---|---|---|
| 1920×1080 | 72 px | 65 px | 163 px |
| 390×844 | 26 px | 23 px ≈ 6.2 mm | 59 px ≈ 15.6 mm |

Triad spots on the phone land just under the ~7 mm touch guideline. That is the
known trade the hand-off called out, and it is accepted: notes and dyads stay
comfortable, and `r` is the knob if a listen says otherwise.

Because the surface is square and extends on the long axis, **there is no
portrait special case** — the rotate-the-whole-stage hack the previous
instrument needed is gone, along with the risk that it had never been seen on a
real device.

## Accessibility floor

Unchanged. The invariants require a nav landmark, exactly one `<h1>`, a document
language, a title and a meta description on the built page; keep the `<h1>` and
nav in the markup, visually hidden. Avoid the words *score*, *streak*, *try
again*, *game over*, *you lose*, *wrong note* and *high score* in copy **and in
identifiers** — `spec/crit-4.test.ts` greps the built HTML and the page script
for them.

## Debug mode

`?debug` toggles a `.debug` class onto `<html>` from the page script, purely
client-side. It shows each cap's `(m, n)` and pitch class, and draws the touch
disks. Off by default and behind a flag nobody stumbles into, so it does not
count against "no self-explanation in the artefact".

## Shepard test page

`shepard.html` stays. It is a twelve-button clock face driving the same
synthesis in plain 12-TET, independent of the lattice, so an oddity heard while
testing cannot be blamed on the geometry — and now that the instrument is
itself 12-TET, it tests exactly the same notes. Re-rooting the chromatic naming
to C changes its labels and nothing else. Not part of the graded instrument.

## Reconciled from the hand-off

Recorded so a later session does not "restore" something that was dropped on
purpose. The hand-off is committed in the history as received.

| Hand-off says | This repo does | Why |
|---|---|---|
| §7 audio: `261.63 · 2^(pc/12)`, one octave, register open | Existing octaveless Shepard synthesis | A pitch-class torus and an octaveless tone are the same idea twice; there is no register to choose |
| §7 voice triads from the root upward | Nothing to do | Shepard tones have no inversion |
| §6 `hsl(pc·30°, 62%, 50%)` | Existing `hue = 25° + 360°·pc` in oklch | Already established, perceptually uniform, constant L and C |
| Seeds `PROJECT.md` | Seeds this file | The repo's authority is `DESIGN.md` |
| Silent on the keyboard | QWERTY block over the lattice | The spec asks for it and a green test already asserts it |
| Silent on testability | Two hit-test paths, §"Two hit-test paths" | jsdom has no layout; the coordinate path alone is undrivable |
| §8 fit `12 + 2·PAD` to the short axis | Same, plus extend the long axis | 390×844 would otherwise be half empty |
| §1 press radius, margin, wrap, colour convention | Taken as locked | Verified numerically; nothing to argue with |

Deliberately not revisited, per the hand-off: equilateral triangles (impossible
with straight wrap), the scalene √5/2 layout, single-touch tetrads. Aspect stays
an internal parameter even though it is 1 everywhere.

## Non-goals

No recorded audio; no octave controls or register management; no configurable
generators; no 7- or 11-limit axes; no sustain, velocity or portamento; no MIDI;
no `AudioWorklet`; no tuning-theory copy, instructions or self-explanation
anywhere in the artefact.

## Still open

- **Name and description.** `index.astro` still carries the template
  placeholders. Ships Wednesday, so this is not optional.
- **Cap labels.** Note name, key letter, both, or neither. Note names make the
  wrap legible at a glance; key letters make the keyboard discoverable; two
  labels on twenty caps may be one too many. Settle by eye.
- **Sharps or flats.** `CHROMATIC` currently spells with flats against an F
  root. Re-rooting to C wants a decision on spelling.
- **Whether triads are findable.** 11.2% of the area, and no test can tell.
  Needs a listen and a look.
- **`PROCESS.md`** describes the previous instrument and goes stale the moment
  `index` changes; rewrite it at the end, not before, since it cites commits.
- **`reflections/crit-4.md`** is missing and is the repo owner's alone. Never
  draft it.
