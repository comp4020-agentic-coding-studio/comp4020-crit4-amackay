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

Sliding a finger from the middle of a cell toward a corner where three of them
meet is the signature gesture: notes join and leave underneath it while the
common tones stay sounding. Two fingers reach seventh chords. There is no
score, no fail state, no instructions, and no text on the page beyond the cap
labels and the title. The page is called **Touch-Tonnetz**, and per instruction
that name is shown: a small centred plate at the top edge, out of flow and
click-through, so it names the thing without becoming a header the instrument
has to live underneath. It is a name, not an explanation — the rule that the
artefact carries no exposition about itself is untouched.

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
presses cell `(m, n)` iff `cellDist((x,y), node(m,n)) < r`.

The hand-off's §4 finds the candidates by inverting the basis
(`alpha = (x−y)/4`, `beta = x/12 + y/4`) and scanning a 5×5 neighbourhood.
**The shipped code does not need that.** SVG hit-tests the hexagon, so a
`pointerdown` or `pointermove` already names the containing cell, and only that
cell plus its six lattice neighbours can also be within `r`. Seven `cellDist`
calls, no basis inversion, and no way for the arithmetic to disagree with what
the browser hit-tested. `scripts/tonnetz-check.ts` confirms the two forms agree
exactly, and keeps agreeing up to `r = 1.47` — twice the 0.707 this design is
allowed. The inversion stays in the check script, where it earns its keep as an
independent second opinion.

`cellDist` translates the shared hexagon to the node, returns 0 inside (all six
CCW cross products ≥ 0) and otherwise the minimum point-to-segment distance
over its edges. Deduplicate the result **by pitch class**, not by cell: a cell
outside the domain and its wrapped twin are the same note and must sound once.

A pitch class joins a pointer's set at `cellDist < r` and leaves only at
`cellDist > r + h`, so a held finger on a boundary does not flicker.

At `r = 0.45` the surface divides **56.6% single note / 32.2% dyad / 11.2%
triad** by area — and per instruction **none of that is drawn as fixed
geometry on the caps**. The caps tile flush and the chords live in the seams
between them, so a player who taps gets notes and a player who moves gets
chords. That is discovery rather than instruction, and it is the same bargain
the previous instrument made: the thing looks simpler than it is, and rewards
moving. Per later instruction, the one visible trace of `r` is the mouse
cursor itself — see "Mouse preview" below — which only a pointer that has no
size of its own needs.

The ≤3 invariant holds for any `r < √2/2 ≈ 0.707` and breaks at 0.708 —
`scripts/tonnetz-check.ts` measures the threshold rather than assuming it.

Every point of the surface presses at least one cell. There is no gap, no dead
zone, and therefore no way to touch the instrument and get silence.

## Keyboard

The hand-off is silent on the keyboard; the published spec asks for mouse,
keyboard or touch, and `spec/crit-4.test.ts` already asserts keyboard
playability. Per instruction, keys map onto **lattice positions**, not onto a
chromatic run, so a chord shape under the hand is the same shape as the
triangle on screen.

The block is **the previous instrument's, unchanged**: four rows of nine, laid
over nine lattice columns centred on the fundamental domain. Columns run left
to right, rows top to bottom.

| | | | | | | | | |
|---|---|---|---|---|---|---|---|---|
| `1` G | `2` B♭ | `3` F | `4` C | `5` G | `6` B♭ | `7` F | `8` C | `9` G |
| `Q` B | `W` D | `E` A | `R` E | `T` B | `Y` D | `U` A | `I` E | `O` B |
| `A` E♭ | `S` G♭ | `D` D♭ | `F` A♭ | `G` E♭ | `H` G♭ | `J` D♭ | `K` A♭ | `L` E♭ |
| `Z` G | `X` B♭ | `C` F | `V` C | `B` G | `N` B♭ | `M` F | `,` C | `.` G |

Thirty-six keys, twelve pitch classes, so **every note has exactly three keys**.
That redundancy is not slack: the block spans three horizontal periods, and the
top and bottom rows are one vertical period apart, so the keyboard repeats
exactly where the screen repeats. At 1920×1080 the visible caps and the keyed
block are the same 36 cells; at 390×844 the middle five columns are on screen
and the outer four hang off, which costs nothing because a phone has no
keyboard.

All 48 triads whose three vertices are keyed fit inside a 2×2 square of keys —
a minor triad is `A`+`S`+`W`, a major is `S`+`W`+`E` — so triads are one-handed.
`scripts/tonnetz-keys-wide.ts` derives the table and checks the compactness
claim; do not hand-maintain it. (`scripts/tonnetz-keys.ts` works the same
problem for a 4×5 left-hand block, kept because it is where the window
arithmetic is derived.)

Held keys stack, so keyboard and touch reach the same chords by the same rule:
the sounding set is the union.

### Two spec tests rest on an assumption the torus breaks

`spec/crit-4.test.ts` inherited two pairs of caps from the 9×4 grid, chosen
because they sat far apart on it:

- `drag("KeyA", "KeyL")` — both E♭, eight columns apart is exactly two
  horizontal periods, so the drag starts no second voice.
- `press("KeyZ")` against `press("Digit9")` — both G, for the same reason.

On a torus, far apart is not different. Both need new endpoints (`KeyA`→`KeyF`
gives E♭/A♭, `KeyZ`→`KeyD` gives G/D♭, a tritone). These are edits to *which
caps the test points at*, made necessary by the artefact, not softenings of
what the spec asks — own commit, body says so. Every other code the suite
presses lands on a real cap and needs nothing.

## Tuning and synthesis

12-TET throughout, per instruction. The torus only closes because twelve fifths
land within a schisma of seven octaves; just intonation would make the lattice
infinite and dissolve the wrap, the live margin and the wrapped-twin identity
along with it.

Pitch class `p` sounds `equalTemperamentRatioFor(p)` against the existing root,
and **the root stays F**. The hand-off's 261.63 Hz would put C at the lattice
origin, which is the Tonnetz convention — but nothing here depends on it. The
tone is octaveless, there is no drone and no tonic, so which pitch class sits at
hue 25° is arbitrary; re-rooting would cost a constant, a test rewrite and the
shepard page's labels for no musical difference. `tuning.ts` therefore only
loses `ratioFor`, the 3-limit/5-limit function, along with the lattice it served.

The synthesis is otherwise unchanged from what is already in `instrument.ts` and
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

### One voice per gesture

`Instrument` keys voices by an opaque string and refuses a duplicate `noteOn`,
so what that string is made of decides how the instrument behaves when two
gestures meet on one note. **Per instruction it is `holder:pitchClass`**, where
a holder is a `pointerId` or a `KeyboardEvent.code` — so two fingers on the same
cap in different spots, or a key and a mouse and a finger on the same note all
at once, are three gestures and sound as three voices, each starting and
stopping with the gesture that owns it. A holder owning its voices outright is
also what makes one letting go unable to cut another's note short.

The obvious alternative — refcounting holders per pitch class, one voice that
starts at 0→1 and releases at 1→0 — solves that same cut-short problem, and is
what this repo did until it was asked for the other thing. It costs the
stacking: two fingers on a cap sound exactly like one.

`PitchClassVoices` is that layer. It is plain logic over numbers and strings,
belongs behind the seam, and is tested without an `AudioContext`.

Recompute a holder's set on every move and diff it: start the additions,
release the removals, leave the intersection sounding untouched. **This diff is
the signature interaction — protect it.** Retriggering a common tone during a
drag is the bug that would make the instrument sound like a grid of buttons
again. The diff is per holder and consults no other, so stacking and
no-retrigger are independent properties and neither can break the other.

**Stacked unisons are not simply louder.** Two voices on one pitch class are
two independent oscillator stacks at identical frequencies, started at
different times, so each partial pair meets at whatever phase relation the gap
between the two gestures produced: some reinforce, some cancel, and the result
is a colouration that varies per press rather than a clean doubling. Total
silence is not a risk — the eight partials are at different frequencies and so
land at different phase offsets — but "quieter and hollower than one voice" is
possible. If that turns out to matter when someone listens, the usual remedy is
a few cents of unison spread per voice, which trades exact 12-TET for a
predictable, gently beating reinforcement. **Not done, because nothing here can
hear it.**

## Interaction

### DOM contract

- The playable surface carries **`data-instrument`**.
- Each cap carries **`data-note="<KeyboardEvent.code>"`** for the thirty-six
  keyed caps — both the keyboard mapping and the handle the spec tests hold.
  Caps further out are touchable but carry no `data-note`.
- Each cap also carries its lattice position, so the coordinate refinement below
  needs no basis inversion.

### Two hit-test paths, one code path

The interesting hit test is coordinate-based, and coordinates are exactly what
the test harness cannot supply: **jsdom has no layout, so every
`getBoundingClientRect()` is zero-sized and any client-to-twelfths division
yields `NaN`** — which then throws when fed to an `AudioParam`. The previous
instrument avoided this by having no position mapping at all. This one cannot.

So resolve a gesture in two steps, and never let the first one throw:

1. **Element path.** `pointerdown`/`pointerenter`/`pointermove` on a cap names
   one cell — SVG has already done the point-in-hexagon test. Always available,
   needs no geometry of our own.
2. **Coordinate path.** If the surface reports a non-zero rect, map client
   coordinates into twelfths through the SVG `viewBox` and measure `cellDist`
   against that cell and its six neighbours, refining the one cell into the
   true set of one, two or three pitch classes.

Guard on `rect.width === 0` and fall back to the element path — degrade to
doing nothing extra rather than throwing. In a real browser the coordinate path
always wins; under jsdom the instrument behaves like a one-note-per-cap grid,
which is enough for the spec tests to drive it. The geometry itself is proved
by unit tests over plain functions, where it belongs.

Note that step 2 *refines* step 1 rather than replacing it. Neither path can
produce a cell the other did not, which is why there is no reconciliation
logic and no way for them to disagree.

### Pointer

Pointer Events with `touch-action: none` on the surface, `Map<pointerId, Set<pc>>`
per pointer. Touch pointers are implicitly captured to the element where
`pointerdown` happened, so call `releasePointerCapture(event.pointerId)` in the
`pointerdown` handler or nothing will fire on the caps a finger drags onto.
`pointerup`, `pointercancel` and `pointerleave` release that pointer's set; a
lift off the surface entirely is caught on `window`, and releasing is
idempotent.

**Drag is `pointermove` and nothing else.** Recomputing the pointer's pitch-class
set on every move and diffing it against the last one *is* the drag: additions
start, removals release, the intersection keeps sounding. The previous
instrument needed a second `elementFromPoint` path because a cap was a discrete
trigger with no position mapping; here the position mapping is the whole
mechanism, so **`elementFromPoint` is not used anywhere**. `pointerenter` on
caps survives only because it is the path the jsdom harness can drive — and
because `spec/support/instrument-page.ts` dispatches it with `bubbles: true`,
check that a bubbled `pointerenter` reaching the surface cannot clear state
(this exact shape produced a false failure on the shepard page once).

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

### Mouse preview

Per instruction, the mouse gets what a finger already has for free: a visible
sense of how big a press is. A finger covers `r`'s disk by being a finger; a
mouse pointer has no size until it clicks, so two things stand in for that:

- **A disk rides with the cursor.** A circle of diameter `2r`
  (`--press-diameter` in `index.astro`, read from `R` in `tonnetz.ts` rather
  than hand-typed) follows the pointer at the same px-per-twelfth scale as the
  caps, drawn only once a mouse is confirmed present (`pointermove` carrying
  `pointerType: "mouse"`).

### The page never owns the cursor

**No `cursor: none`, no pointer lock, no `setPointerCapture` — ever.** The disk
is drawn *around* the real pointer and never in place of it. The pointer itself
is a **crosshair**, per instruction: symmetrical, so it sits concentrically
inside the disk instead of fighting it, and it marks the exact point the disk
is centred on.

This is a rule about trust rather than about looks. A page that hides the OS
cursor and draws its own has taken something it cannot reliably give back: the
substitute only moves while the script is running, only while the pointer is
over the surface, and only if nothing has thrown. Every one of those is a way
for a visitor to end up with no cursor at all, on a page they did not choose to
hand their pointer to. A stuck or missing cursor reads as a site that has
seized control, and that impression is worth more than any gain from styling
it.

The disk stays because it says something true about *this* instrument — how big
a press is — and it costs nothing to be wrong about, because the real pointer
is right there underneath it the whole time.
- **Hover previews the click.** The same `pressedPitchClasses` geometry that
  drives a real press — element path, then coordinate refine, with the same
  hysteresis — runs on hover too, but only ever reaches a `.hover` DOM class,
  never `Instrument` or `PitchClassVoices`. It draws as an intermediate step
  along the *same* channels the played state uses — see the state table under
  "Visual design". A preview is the played state's quieter cousin, not a
  different kind of mark.
- **Hover and pressed are not exclusive.** `.hover` tracks where the cursor
  is, button down or not; `.active` outranks it in CSS for as long as a press
  lasts. Clearing hover on `pointerdown` instead leaves a cap that was clicked
  and not moved off showing neither class, so it drops all the way to rest
  while the mouse is still on it — and no `pointermove` follows a still mouse
  to put it back.
- **The preview lights every copy** of each pitch class, exactly as pressing
  does, because a wrapped cap *is* its twin. Pressing therefore changes how
  brightly the caps are lit, never which ones — and since every copy moves
  together there is no unlit twin left on screen to compare against, so the
  step has to read on its own rather than by contrast.

**A preview that lied would be worse than none**, so the press it predicts must
be the press that happens. That is why the coordinate refine runs on
`pointerdown` too and not only on `pointermove`: the element path alone names
one cell, so a press in a seam used to sound a single note until the pointer
first moved, quietly under-pressing every tap on a boundary — touch included.

Touch and keyboard need neither: a finger already covers what it is about to
press, and a key has no position to preview. Gated on `event.pointerType`, so
this is the one visible trace of `r` anywhere on the surface, and only for the
one input that has no footprint of its own.

## Visual design

**Per instruction, the caps are the only thing drawn.** The hand-off's §6
layers the surface six deep; five of those layers go. No dyad bands, no triad
spots, no fundamental-domain outline. What is left is the previous
instrument's aesthetic carried over intact — flush caps, solid colour, no
gaps, no ornament — with the hexagonal shapes and the wrapping as the only
things that differ.

Static SVG in twelfth units with y negated so the drawing is upright. Every
coordinate is an integer, so the surface is emitted once at build time and
never redrawn; pressing a cap toggles a class.

- **Caps are whole Voronoi hexagons**, tiling flush edge to edge. Not eroded by
  `r`: the erosion existed to show where the single-note core stopped, and
  nothing here shows that.
- **Colour is pitch class**: `hue = 25° + 360°·pc`. At any one state lightness
  and chroma are constant across caps — hue is the only channel that varies
  between caps, so equal pitch-class distances look equally different.
- **The surface rests dark and dull, and blooms as it is played**, per
  instruction. Lightness *and* chroma carry the state together, so a played cap
  differs in vividness as well as brightness:

  | | lightness | chroma |
  |---|---|---|
  | rest | 64% | 0.07 |
  | hover (mouse preview) | 76% | 0.115 |
  | sounding | 89% | 0.175 |

  The wide resting-to-sounding range is the point: it is what makes a held
  triad read across the whole surface, and what gives the hover preview room
  to be obvious without being mistaken for a played note. Resting chroma has a
  floor, though — below about 0.06 the twelve hues stop being tellable apart
  and the colour stops encoding pitch class at all. 0.07 is just above it.
  Resting lightness has a floor too: the labels are dark, and 64% keeps the
  pitch name at 4.8:1 against its cap.
- **The edge is one constant dark**, `oklch(36% 0.02 260)`, shared by every cap
  rather than derived from each cap's own hue. It is not decoration: two flush
  caps of equal lightness and chroma vibrate at the seam without one. A
  constant edge does that separating job *equally* for every pair, where a
  hue-varying one separated some pairs better than others and gave the surface
  a chromatic grain that had nothing to do with the music. Per instruction.
- **Effects stay inside the cap.** Nothing drawn on a cap may render outside
  its own hexagon — no glow, no spill, nothing that grows past its border. The
  reason is that caps tile flush, so anything crossing a border is resolved by
  paint order, and paint order is an artefact of the emission loop rather than
  anything the player should be able to see. A centred SVG stroke breaks this
  rule by construction — half of every stroke lands on the neighbour — so
  `.cap polygon` carries a `clip-path` of its own hexagon, derived from `HEX`
  and applied over `fill-box`. This is the same instinct as "nothing scales"
  below, and as the inward `outline-offset` on the focus ring in `global.css`.
- **No reduced opacity anywhere**, per instruction. A cap outside the
  fundamental domain is drawn exactly like its twin inside it, because it *is*
  its twin — same note, same colour, same name. The wrap shows itself by
  repetition, and the surface reads as one continuous thing rather than a tile
  with a decorated border.
- **Two labels per cap.** The pitch name centred and prominent; the keyboard key
  bottom-right and quieter. Caps outside the keyed block carry the pitch name
  alone — on desktop there are none, so this only shows on a tall viewport.
- **Active state** is colour only, as before: it arrives over the 15 ms attack
  and fades back over ~500 ms, so the visual tail matches the audible one.
  Nothing scales; a cap that grew would break the tiling.
- **Restrike flash.** A cap already lit gains nothing visible when a second
  holder arrives on the same pitch class, yet a second voice really did start —
  so it flashes: `brightness(1.3)` decaying back over 220 ms. This is the one
  place a `filter` is used, chosen over a `fill` animation so the transient
  lives in one line of script rather than as a second copy of the palette; it
  is on the `polygon`, so the clip contains it. Only ever on a *re*-strike; a
  first strike already has the 15 ms attack to announce it.
- **Motion.** Only those transitions. No idle animation. One asymmetry is
  deliberate: a released cap that the mouse is *still sitting on* returns to
  the hover colour over 200 ms rather than decaying to rest over 500 ms. The
  full tail belongs to a cap you have left; a cap under the cursor should go
  on saying "you are here" instead of pretending it isn't hovered.

The major/minor warm/cool convention the hand-off locked in its §1 applies only
to the triad spots, so it has nothing to colour and is dropped. Hue stays the
single varying channel across the whole surface.

### Sizing

Fit **15 twelfths to the short viewport axis**, and extend the long axis with
more lattice until it fills — the caps are the same size either way, there is
just more torus. The core window is `x ∈ [−1.5, 13.5]`, `y ∈ [−2, 13]`, chosen
because it is square and gives each column four caps; the vertical margin is
asymmetric because the columns are staggered by one twelfth, and a symmetric
window catches three caps in one column instead of four. That comes to **36
caps at 1920×1080 and 40 at 390×844** — the same density as the 9×4 grid it
replaces.

**Draw every cell that intersects the viewport, not every centre inside it**,
and let SVG clip. Caps cut off at the edge are correct and wanted: they say the
surface continues.

Extending the long axis is what carries the "make the wrapping obvious"
job, now that opacity no longer marks the margin. At 1920×1080 the surface is
about 2.2 fundamental domains wide by 1.25 tall; at 390×844 it is 1.25 wide by
2.7 tall. Each marked viewport shows the repeat clearly along one axis. Whether
that is enough is a question for the eye, not for a test.

At the two marked viewports:

| Viewport | Twelfth | Cap across (min) | Triad region (undrawn) |
|---|---|---|---|
| 1920×1080 | 72 px | 228 px | 65 px |
| 390×844 | 26 px | 82 px ≈ 22 mm | 23 px ≈ 6.2 mm |

Caps are generous at both sizes. The triad region on the phone lands just under
the ~7 mm touch guideline — the known trade the hand-off called out, accepted
here because notes and dyads stay comfortable and `r` is the knob if a listen
says otherwise.

Because the surface is square and extends on the long axis, **there is no
portrait special case** — the rotate-the-whole-stage hack the previous
instrument needed is gone, along with the risk that it had never been seen on a
real device.

## Accessibility floor

The invariants require a nav landmark, exactly one `<h1>`, a document language,
a title and a meta description on the built page. The `<h1>` is now the visible
title plate; the nav stays in the markup, visually hidden. Avoid the words *score*, *streak*, *try
again*, *game over*, *you lose*, *wrong note* and *high score* in copy **and in
identifiers** — `spec/crit-4.test.ts` greps the built HTML and the page script
for them.

## Debug mode

`?debug` toggles a `.debug` class onto `<html>` from the page script, purely
client-side. **None of it needs to be polished** — it is a tuning aid for
whoever is building the thing, not a second design. Off by default and behind a
flag nobody stumbles into, so it does not count against "no self-explanation in
the artefact".

Build only what the tuning actually needs: each cap's `(m, n)` and pitch class,
and the touch disks, which are what makes `r` judgeable. The dyad bands, triad
spots and fundamental-domain outline are worth drawing only if `r` turns out to
need real work; the geometry is already proved by the check script, so they
would be a convenience, not evidence. Skip them unless they earn it.

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
| §4 invert the basis, scan 5×5 | Containing cell + its six neighbours | SVG already hit-tested the hexagon; verified equivalent to `r = 1.47` |
| §7 root at 261.63 Hz (C) | Root stays F, `tuning.ts` untouched | Octaveless and tonic-less, so the root is arbitrary and re-rooting is unpaid work |
| §8 fit `12 + 2·PAD` to the short axis | Same, plus extend the long axis | 390×844 would otherwise be half empty |
| §6 six drawn layers | One: the caps | Per instruction — the previous instrument's aesthetic, flush and solid |
| §6 note caps eroded by `r` | Whole hexagons, tiling flush | Nothing else is drawn, so there is no core to mark the edge of |
| §6 margin at ~0.35 opacity | Full opacity, no distinction | Per instruction — a wrapped cap *is* its twin, and repetition is the cue |
| §6 fundamental-domain outline | Not drawn (debug only) | Per instruction — the wrap needs margin, not emphasis |
| §1 major = red, minor = blue | Dropped | It only ever coloured the triad spots, which are gone |
| §1 press radius, margin, wrap | Taken as locked | Verified numerically; nothing to argue with |

Deliberately not revisited, per the hand-off: equilateral triangles (impossible
with straight wrap), the scalene √5/2 layout, single-touch tetrads. Aspect stays
an internal parameter even though it is 1 everywhere.

## Build order

`main` is green and complete, and the cutoff is Wednesday 07:00. So the work is
staged to never commit red and to leave a shippable fallback standing the whole
way: everything provable lands first as ordinary green commits, and the one
commit that genuinely cannot be split is made as small as those can make it.

**1. `src/lib/tonnetz.ts` — the geometry, as plain functions over numbers.**
Lattice positions and pitch classes, the shared hexagon, `cellDist`, the six
neighbours, the press set with hysteresis, the visible-cell enumeration for a
given viewport, and the derived key table. Unit and property tests assert what
"The lattice" and "Touch model" above claim — including the ≤3 invariant over a
grid of touch points. `scripts/tonnetz-check.ts` stays as an independent second
opinion; it is not the contract. Touches no page, so it is green on its own.

**2. A voice layer over `Instrument`.** Landed as a per-pitch-class refcount;
since replaced by one voice per `holder:pitchClass`, per "One voice per
gesture" above. `Instrument` injected either way, so the tests need no
`AudioContext`. Also green on its own, and also touches no page.

**3. The two spec cap-pairs, on their own.** `drag("KeyA", "KeyL")` →
`("KeyA", "KeyF")` and `press("Digit9")` → `press("KeyD")`, per "Two spec tests
rest on an assumption the torus breaks" above. These land **before** the swap
and in their own commit, because `CLAUDE.md` requires a spec-test edit never to
ship alongside the feature that makes it pass. That is possible here only
because the new pairs are distinct nodes on the *current* 9×4 grid too, so the
commit is green both before and after the artefact changes — confirm that
before committing, and if it is ever not true, the edit waits rather than
merging into stage 4.

**4. The swap, atomic.** `index.astro` emitting the SVG surface, the new
`main.ts`, the stylesheet, and the deletion of `lattice.ts`,
`scripts/lattice-check.ts` and `ratioFor` with its tests. One commit: the
artefact changes identity, and a page swap cannot be half-done without a red
tree. Stages 1–3 exist to make this commit as close to "wiring" as possible.

**5. Look, listen, finish.** Both marked viewports in Chrome, muted. Then the
name and description, `PROCESS.md`, and deleting `tonnetz-touch-handoff.md`
now that this file supersedes it — the hand-off stays in the history, the way
the previous one does.

**The work stops for review at the end of stage 4.** Nothing in this repo can
hear, and stage 5's real questions — whether the wrap reads, whether chords get
discovered, whether the drag sounds like voice leading rather than retriggering
— are answerable only by a person at the two marked sizes. Report the suite
green and stop there; do not tune `r` by reasoning.

## Non-goals

No recorded audio; no octave controls or register management; no configurable
generators; no 7- or 11-limit axes; no sustain, velocity or portamento; no MIDI;
no `AudioWorklet`; no tuning-theory copy, instructions or self-explanation
anywhere in the artefact.

## Known issues

- **On some Linux desktops the pointer disappears while a key is held**, so
  playing the keyboard and the mouse together loses the mouse cursor until the
  key is released. **This is the desktop environment, not the page** — it
  reproduces on a blank browser tab, and there is no `cursor: none`, pointer
  lock or `setPointerCapture` anywhere here (see "The page never owns the
  cursor"). Many Linux setups hide the pointer while typing, either as a
  desktop setting or via a helper like `unclutter` or `xbanish`; a held key
  keeps that state latched, so the pointer stays hidden rather than reappearing
  on motion. A web page cannot override it, and the things that could fake a
  way around it — drawing our own cursor with `cursor: none`, or pointer
  lock — are exactly what that section forbids, for better reasons than this
  costs.

  **Partly mitigated already, and by accident.** Hiding the pointer is only
  visual: pointer events keep flowing, so the press-radius disk keeps tracking
  the whole time a key is held. During the affected moments there is still a
  visible position indicator, which is more than a blank tab manages. Verified
  with real key auto-repeat over CDP — 180 repeats, disk tracking throughout.

  Accepted rather than fixed. The real fix is a per-desktop setting and belongs
  to whoever's desktop it is.

## Still open

- **Whether stacked unisons want a few cents of spread.** Two holders on one
  pitch class are two oscillator stacks at *identical* frequencies started at
  different times, so their partials meet at whatever phase relation the gap
  between the gestures produced — reinforcing some, cancelling others. The
  result is a colouration that varies press to press rather than a clean
  doubling, and "quieter and hollower than one voice" is a possible outcome
  (total silence is not: the eight partials sit at different frequencies).
  The remedy, if a listen says it needs one, is a few cents of detune per
  voice, buying predictable gently-beating reinforcement at the cost of exact
  12-TET. **Deliberately deferred** — it needs ears, not reasoning, and the
  feature is worth having before it is worth tuning. See "One voice per
  gesture".
- **Name and description.** `index.astro` still carries the template
  placeholders. Ships Wednesday, so this is not optional.
- **Whether the wrap reads.** Nothing marks the margin any more, so it has to
  come across as repetition alone. Check at both marked viewports; if it
  doesn't, the knob is how far the long axis extends, not opacity.
- **Whether chords get discovered.** 11.2% of the area is triad and none of it
  is drawn, so a player finds chords by moving or not at all. No test can tell.
  Needs a stranger, or at least a listen.
- **`PROCESS.md`** describes the previous instrument and goes stale the moment
  `index` changes; rewrite it at the end, not before, since it cites commits.
- **`reflections/crit-4.md`** is missing and is the repo owner's alone. Never
  draft it.
