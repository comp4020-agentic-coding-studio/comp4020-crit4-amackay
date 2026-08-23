# DESIGN.md — the instrument

The implementation authority for this prototype. `CLAUDE.md` governs how to work
in the repo; this file governs what to build. Where they disagree, `CLAUDE.md`
wins on process and this file wins on the artefact.

The design arrived as a hand-off written in a conversation that had never seen
this repo, and was amended once, by a patch that replaced the Voronoi button
cell with the equilateral hexagon and locked the press radius. Both documents
are in the history; neither is authoritative and neither needs reading. What
survived of them is here, and the lattice is verified numerically by
`scripts/tonnetz-check.ts`.

Things dropped on purpose, so a later session does not helpfully restore them:
the hand-off's six drawn layers (one is drawn — the caps), its reduced-opacity
margin, its drawn fundamental-domain outline, its caps eroded by the press
radius, and its major-red/minor-blue triad colouring. All per instruction, and
all covered under "Visual design".

## What it is

One fundamental domain of the 12-TET pitch-class torus, drawn as a square
Tonnetz that wraps straight on both axes and keeps going past the edges. Every
pitch class is an equilateral hexagon. A touch is a disk, and it presses every
cell the disk overlaps: one cell sounds a note, two sound a dyad, three sound a
triad.
The geometry — not a clamp — guarantees those are the only possibilities, that
every dyad is a third or a fifth, and that every triad is major or minor.

Sliding a finger from the middle of a cell toward a corner where three of them
meet is the signature gesture: notes join and leave underneath it while the
common tones stay sounding. Two fingers reach seventh chords. There is no
score, no fail state, and nothing on the playing surface beyond the cap labels
and the title. The page is called **Touch-Tonnetz**, and per instruction that
name is shown: a small centred plate at the top edge, out of flow, so it names
the thing without becoming a header the instrument has to live underneath.

Per instruction the plate is also the way in to an **About panel**: click it
and it expands into a card carrying a short account of what the instrument is,
with links out to Tonnetz and Shepard tone. The surface itself still explains
nothing — a player who never clicks the title meets exactly what they met
before. Being a click target does cost the caps under the plate: they are no
longer playable there.

## The lattice

Work in *twelfths*, y up. Any 12 × 12 square is a fundamental domain; where
the instrument puts one is a separate decision, below.

```
F = (-1, 3)    fifth,       +7 semitones
B = ( 3, 3)    minor third, +3 semitones
```

Vertex `(m, n)` sits at `m·F + n·B = (3n − m, 3(m+n))` and sounds

```
pc(m, n) = (7m + 3n) mod 12
```

The formula is valid for every integer pair, which is what makes the surface
outside the fundamental domain live at zero cost: **never reduce `(m, n)` into
the domain.** Translating by `(0, 12)` (i.e. `m+3, n+1`) or `(12, 0)`
(`m−3, n+3`) preserves the pitch class, so the square really is a fundamental
domain and it really does hold each of the twelve exactly once.

**Where the domain sits.** Its low corner is `(4.5, 10.5)`, the midpoint
between Gb `(1,2)` at `(5,9)` and its `+F` neighbour Db `(2,2)` at `(4,12)` —
so every corner of the square falls between a Gb and a Db, a fifth apart, and
the twelve caps read on screen as

```
Gb  D   Bb
B   G   Eb
E   C   Ab
A   F   Db
```

Four rows of three, each row stepping a major third and staggering one twelfth
right as the screen descends. The corner is a real constant, not a framing
choice: put it a fifth out and every row shifts, which is invisible to any
test that only counts caps. `tonnetz.ts` derives the camera from it rather than
restating it, and `tonnetz.test.ts` pins the layout above.

Edge lengths run fifth < major third < minor third — `√10 ≈ 3.162`, `4`,
`√18 ≈ 4.243` — so the shortest edge is the simplest relationship. All
triangles are acute, so the Delaunay triangulation *is* the Tonnetz mesh and
every triangle is a triad:

- lower triangle of cell `(m,n)`: `(m,n), (m+1,n), (m,n+1)` — **minor**, rooted
  at `pc(m,n)`
- upper triangle: `(m+1,n), (m+1,n+1), (m,n+1)` — **major**, rooted at
  `pc(m,n)+3`

The derived major-third step is `F − B = (−4, 0)`: pitch class rises by a major
third as the screen runs left, so each **row** cycles one of the four augmented
triads, repeating every three caps. That period of three is what makes the key
block below cover each pitch class an even three times.

### The hexagon

Because the aspect ratio is 1:1, every triangle's circumcenter is an integer
offset from its cell's origin vertex:

```
minor triad spot = node + (1, 2)
major triad spot = node + (1, 4)
```

both at circumradius `√5` — a fact about the triangulation, and unaffected by
what follows.

The button is *not* the Voronoi cell those circumcenters would define. Each cap
is the **equilateral** hexagon with vertex offsets

```
(5/2, 1), (1/2, 2), (-3/2, 1), (-5/2, -1), (-1/2, -2), (3/2, -1)     CCW
```

All six edges are `√5`. Node-to-boundary distances vary by neighbour type
instead of by a shared `|w|/2`: `0.7√5 ≈ 1.565` across a fifth, `0.8√5 ≈
1.789` across a major third, `0.9√5 ≈ 2.012` across a minor third; crossing
one is a neo-Riemannian move (P, R, L respectively). Which edge is which comes
from the basis, not from the order they happen to be written in: each edge's
midpoint is half the neighbour vector it separates, making `HEX[0]-HEX[1]` the
minor third, `HEX[1]-HEX[2]` the fifth and `HEX[2]-HEX[3]` the major third.
An equilateral hexagon presses identically on all three, so nothing but that
check can catch the labels being wrong. There is no single
node-to-corner radius any more — corner distances range `√3.25 ≈ 1.803` to
`√7.25 ≈ 2.693` — so anything that needs "the" corner reaches for the
explicit vertex list, not a circumradius.

**Every coordinate above is an exact half-integer.** The whole surface can be
emitted once as static geometry; nothing is recomputed per frame.

The cell area is still 12 — the lattice's own fundamental-domain area — so the
hexagon tiles the plane under `F` and `B` exactly as the Voronoi cell did.
That, not the bisector construction, is what makes the caps meet flush.

## Touch model

Press radius `r = √5/4 ≈ 0.559` twelfths, hysteresis `h = 0.08` (absolute, not
a fraction of `r`). A touch at `(x, y)` presses cell `(m, n)` iff
`cellDist((x,y), node(m,n)) < r`.

`r` is locked to that value by a design rule the equilateral hexagon makes
uniform: along **every** button boundary the first quarter of the edge presses
one triad, the middle half presses the dyad, and the last quarter presses the
other triad. Adjacent triad corners are `√5` apart, so the 25/50/25 split is
exactly `4r = √5`. Because all six edges are the same length, that split is
identical on all three boundary types — which is the whole reason for the
shape.

The hand-off's §4 finds the candidates by inverting the basis
(`alpha = (x−y)/4`, `beta = x/12 + y/4`) and scanning a 5×5 neighbourhood.
**The shipped code does not need that.** SVG hit-tests the hexagon, so a
`pointerdown` or `pointermove` already names the containing cell, and only that
cell plus its six lattice neighbours can also be within `r`. Seven `cellDist`
calls, no basis inversion, and no way for the arithmetic to disagree with what
the browser hit-tested. `scripts/tonnetz-check.ts` confirms the two forms agree
exactly, and keeps agreeing up to `r = 1.85` — well past the 1.118 this design
is allowed. The inversion stays in the check script, where it earns its keep as
an independent second opinion.

`cellDist` translates the shared hexagon to the node, returns 0 inside (all six
CCW cross products ≥ 0) and otherwise the minimum point-to-segment distance
over its edges. Deduplicate the result **by pitch class**, not by cell: a cell
outside the domain and its wrapped twin are the same note and must sound once.

A pitch class joins a pointer's set at `cellDist < r` and leaves only at
`cellDist > r + h`, so a held finger on a boundary does not flicker.

At `r = √5/4` the surface divides **47.0% single note / 35.2% dyad / 17.7%
triad** by area — and per instruction **none of that is drawn as fixed
geometry on the caps**. The caps tile flush and the chords live in the seams
between them, so a player who taps gets notes and a player who moves gets
chords. That is discovery rather than instruction, and it is the same bargain
the previous instrument made: the thing looks simpler than it is, and rewards
moving. Per later instruction, the one visible trace of `r` is the mouse
cursor itself — see "Mouse preview" below — which only a pointer that has no
size of its own needs.

The ≤3 invariant holds for any `r < √5/2 ≈ 1.118` and breaks at 1.119 — one
uniform threshold on every edge, again because the hexagon is equilateral, and
the locked `r` sits at exactly half it. `scripts/tonnetz-check.ts` measures the
threshold rather than assuming it.

Every point of the surface presses at least one cell. There is no gap, no dead
zone, and therefore no way to touch the instrument and get silence.

## Keyboard

The hand-off is silent on the keyboard; the published spec asks for mouse,
keyboard or touch, and `spec/crit-4.test.ts` already asserts keyboard
playability. Per instruction, keys map onto **lattice positions**, not onto a
chromatic run, so a chord shape under the hand is the same shape as the
triangle on screen.

The block is **the previous instrument's, unchanged**: four rows of nine. Its
middle three columns are exactly the fundamental domain, and **those twelve
caps are the only ones that carry a printed key hint**. The other twenty-four
keys play, silently — a player finds them by reaching outward from a labelled
one, or not at all.

| | | | | | | | | |
|---|---|---|---|---|---|---|---|---|
| `1` G♭ | `2` D | `3` B♭ | **`4` G♭** | **`5` D** | **`6` B♭** | `7` G♭ | `8` D | `9` B♭ |
| `Q` B | `W` G | `E` E♭ | **`R` B** | **`T` G** | **`Y` E♭** | `U` B | `I` G | `O` E♭ |
| `A` E | `S` C | `D` A♭ | **`F` E** | **`G` C** | **`H` A♭** | `J` E | `K` C | `L` A♭ |
| `Z` A | `X` F | `C` D♭ | **`V` A** | **`B` F** | **`N` D♭** | `M` A | `,` F | `.` D♭ |

Bold is hinted. Thirty-six keys, twelve pitch classes, **exactly three keys
each** — an even split, because a row repeats every three caps (the augmented
triad above) and the outer columns are the domain's own caps translated by
`(m∓3, n±3)`, one horizontal period either way. That is the whole derivation:
no scan, no window arithmetic, and the outer keys cannot drift out of step with
the labelled ones because they *are* the labelled ones.

The rows stagger one twelfth right going down, which is the direction a
physical keyboard staggers too, so the block sits on the lattice the way it
sits under the hand.

All fully-keyed triads fit inside a 2×2 square of keys — a minor triad is
`A`+`Q`+`W`, a major is `A`+`W`+`S` — so triads stay one-handed.
`src/lib/tonnetz.test.ts` proves the split and the compactness;
`scripts/tonnetz-keys-wide.ts` prints the table as an independent second
opinion. Neither is hand-maintained. (`scripts/tonnetz-keys.ts` works the same
problem for a 4×5 left-hand block, kept because it is where the window
arithmetic is derived; it predates the reorientation.)

At 1920×1080 the screen shows 38 caps in six rows, 26 of them keyed, with the
labelled domain centred and unlabelled wrapped copies around it; the block's
outer columns hang off the sides. At 390×844 sixteen are keyed and on screen,
which costs nothing because a phone has no keyboard.

Held keys stack, so keyboard and touch reach the same chords by the same rule:
the sounding set is the union.

### Test endpoints have to be checked against the current period

`spec/crit-4.test.ts` needs two pairs of caps that sound *different* — one for
the drag, one for "two gestures, two sounds". On a torus, picking them far
apart does not achieve that, and the safe distance changes whenever the key
block does: `drag("KeyA", "KeyL")` broke on the wrap, its replacement `KeyF`
broke again when the block was rederived (three columns is exactly one
horizontal period), and the pairs are now `KeyA`/`KeyS` and `KeyZ`/`KeyD`.
`scripts/tonnetz-keys-wide.ts` prints the check. These are edits to *which caps
a test points at*, never softenings of what the spec asks — own commit, body
says so.

## Tuning and synthesis

12-TET throughout, per instruction. The torus only closes because twelve fifths
land within a schisma of seven octaves; just intonation would make the lattice
infinite and dissolve the wrap, the live margin and the wrapped-twin identity
along with it.

Pitch class `p` sounds `equalTemperamentRatioFor(p)` against the existing root,
and **the root stays F**. The hand-off's 261.63 Hz would put C at the lattice
origin, which is the Tonnetz convention — but nothing here depends on it. The
tone is octaveless, there is no drone and no tonic, so which pitch class sits at
hue 25° is arbitrary; re-rooting would cost a constant and a test rewrite for
no musical difference. `tuning.ts` therefore only
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
(this exact shape produced a false failure once).

The coordinate refine's anchor (the cell `pressedPitchClasses` measures against,
plus its six neighbours) has to advance on `pointermove` alone, not just on
`pointerenter`: touch input does not reliably retarget `pointerenter` to each
cap a finger drags across, even with capture released, so a drag that depended
on it would stall at the first cap's ring. `tonnetz.ts`'s `anchorCell` picks
whichever of the seven candidate cells the point has actually stepped into, and
`refinePointerAt`/`refineHoverAt` re-anchor to it every move — a chain of
coordinate-only pointermoves walking the lattice one hex at a time.

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

### About panel

Per instruction the title plate opens into an About panel. **The plate and the
card are one element in two states** — `.about`, and `.about[data-open]` — so
the title reaches its place on the card by the plate growing around it. Nothing
is measured and nothing is duplicated: there is no second heading, and the
`<h1>` the invariants require stays the same node throughout.

- **The title stays horizontally centred in both states.** That is what keeps
  the whole expand a CSS transition: every property that differs between plate
  and card (`top`, `width`, `height`, `padding`, `border-radius`, background
  alpha, the title's `font-size`) is animatable, and none of them is
  `text-align`. A title that moved to the card's top-left corner would need a
  FLIP or a view transition to travel; this one needs neither.
- **`width` and `height` interpolate out of `fit-content`**, which takes
  `interpolate-size: allow-keywords` in `global.css`. The closed plate has to
  hug its own title rather than carry a hardcoded width, and the copy is out of
  flow while closed so it cannot swell that intrinsic size. Where
  `interpolate-size` is unsupported those two properties snap and the rest of
  the expand still animates.
- **The card's height is explicit, in two branches**: one for the wide card and
  a taller one under `max-width: 34rem`, where the card is 92vw and the same
  copy takes half again as many lines. The body scrolls if it ever overflows,
  but at both marked viewports it does not.
- **Disclosure semantics, not a dialog** — `aria-expanded` on the toggle,
  `aria-controls` to the body. A disclosure needs no focus trap: focus is
  already on the toggle when the panel opens, and the × and the two links
  follow it in DOM order. `visibility: hidden` while closed is what keeps them
  out of the tab order, so nothing has to manage `inert`.
- **Three ways out**, per instruction plus one: the ×, a click anywhere on the
  scrim, and `Escape`. All three hand focus back to the toggle.
- **The instrument goes quiet while it is open.** The scrim covers the surface,
  so no pointer reaches a cap; `main.ts` gates its `keydown` on
  `about.isOpen()` for the same reason, and opening runs the same
  release-everything cleanup that losing the window does. Otherwise a key held
  as the panel opened would sound under it forever, and `Space` on a focused
  link would both play a note and follow the link.
- **`about-panel.ts` never animates anything.** It sets `data-open` and
  `aria-expanded`; the motion is entirely CSS, which is what keeps the panel's
  behaviour and its look separately reviewable.

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

**Per instruction, the caps are the only thing drawn.** The hand-off layered
the surface six deep; five of those layers go. No dyad bands, no triad
spots, no fundamental-domain outline. What is left is the previous
instrument's aesthetic carried over intact — flush caps, solid colour, no
gaps, no ornament — with the hexagonal shapes and the wrapping as the only
things that differ.

Static SVG in twelfth units with y negated so the drawing is upright. Every
coordinate is an integer, so the surface is emitted once at build time and
never redrawn; pressing a cap toggles a class.

- **Caps are whole hexagons**, tiling flush edge to edge. Not eroded by
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
  Resting lightness has a floor too: the labels are black, and 64% keeps the
  pitch name at 6:1 against its cap on the worst hue.
- **No greys, per instruction.** Every mark that is not a cap's own hue is
  plain black: the cap edges, both labels, and the keyboard focus ring in
  `global.css`. The page behind the surface is black too. Two exceptions, both
  stated: the title panel keeps its own light-on-dark backdrop, since it has to
  stay legible over caps spanning 64–89% lightness; and the cursor disk keeps
  its white ring and wash, per instruction, because black read as a shadow on
  caps this light instead of as the pointer's footprint.
- **The edge is plain black**, shared by every cap rather than derived from
  each cap's own hue. It is not decoration: two flush caps of equal lightness
  and chroma vibrate at the seam without one. A constant edge does that
  separating job *equally* for every pair, where a
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
- **Two labels per cap**, both plain black. The pitch name centred and
  prominent; the keyboard key bottom-right and quieter by size and weight
  alone, since reducing its opacity would composite the cap's hue through it.
  Caps outside the keyed block carry the pitch name alone — on desktop there
  are none, so this only shows on a tall viewport.
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
- **Motion.** Only those transitions, plus the About panel's 320 ms expand
  (see "About panel"), which is also the one thing here that answers
  `prefers-reduced-motion` — a cap's colour transitions are the state itself
  arriving, where the panel's is decoration over a state change that could just
  as well be instant. No idle animation. One asymmetry is deliberate: a released cap that the mouse is *still sitting on* returns to
  the hover colour over 200 ms rather than decaying to rest over 500 ms. The
  full tail belongs to a cap you have left; a cap under the cursor should go
  on saying "you are here" instead of pretending it isn't hovered.

The major/minor warm/cool convention the hand-off locked in its §1 applies only
to the triad spots, so it has nothing to colour and is dropped. Hue stays the
single varying channel across the whole surface.

### Sizing

Fit **15 twelfths to the short viewport axis**, and extend the long axis with
more lattice until it fills — the caps are the same size either way, there is
just more torus. That is the fundamental domain plus `FIT_PADDING = 1.5`
twelfths on each side, centred on it: the guaranteed-visible square is the
twelve labelled caps, ringed by the wrapped surface on every side, which is
what says the surface continues rather than ends. That comes to **38 caps at
1920×1080 and 40 at 390×844**.

1.5 is exactly half the 3-twelfth row spacing, so on the wide viewport a whole
row of wrapped caps sits flush against the top edge and another against the
bottom, cut in half by it: of those 38, twelve are half-caps on the edge and 26
are whole. A player meets the repeat at the frame rather than having to go
looking for it.

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
| 1920×1080 | 72 px | 225 px | 80 px |
| 390×844 | 26 px | 81 px ≈ 22 mm | 29 px ≈ 7.7 mm |

Caps are generous at both sizes. The triad region is `2r = √5/2 ≈ 1.118`
twelfths, so a 7 mm spot needs `14/√5 ≈ 6.26` mm per twelfth — a 75 × 75 mm
fundamental domain. The phone gives 6.9, so the triad region clears the ~7 mm
touch guideline it used to sit just under. That is a side effect of
locking `r` to the 25/50/25 rule rather than a target that was aimed at, and
nothing here can measure whether it makes chords easier to hit; `r` stays the
knob if a listen says otherwise.

Because the surface is square and extends on the long axis, **there is no
portrait special case** — the rotate-the-whole-stage hack the previous
instrument needed is gone, along with the risk that it had never been seen on a
real device.

**One exception to "zero runtime layout JS": a `visualViewport` correction
for "Request Desktop Site."** "There is no portrait special case" above is
about relayout — this instrument never watches the viewport and reflows. It
says nothing about a browser lying about the viewport it hands the page in
the first place. A mobile browser with "Request Desktop Site" enabled
substitutes its own virtual layout viewport for `width=device-width`, which a
page has no API to detect or opt out of.

**The substituted viewport's height does not describe the screen**, and the
fit is `100vmin`, so the fit derives from a number unrelated to what the
player is looking at. On the Android Chrome phone this was diagnosed on,
`vmin` resolved against roughly 590px while the visible area was 1831 layout
px tall — a stage about 1.66× too small, with dead background below it,
`body`'s `height: 100%` being that same wrong height.

Because the *input* is wrong rather than the output being mis-scaled, no
uniform multiplier fixes it. Three were tried on the device first and each
only traded "too small" for "too big":

- Rewriting the `<meta viewport>` tag's `content` back to the real width. The
  attribute updates, but the browser never re-derives layout from it.
- Counter-scaling `<body>` with CSS `zoom` — which isn't paint-only in
  Chromium: it also perturbs how descendants' own `vw`/`vmin` resolve, i.e.
  the very mechanism being corrected.
- `transform: scale()` on a wrapper, which is at least paint-only, but is
  still a single multiplier applied to a mis-derived base.

So `Layout.astro` takes both the size and the box from `visualViewport`,
which describes what is genuinely on screen whatever the layout viewport
claims: `min(visualViewport.width, visualViewport.height) / FIT_SIZE` becomes
an explicit `--twelfth` overriding the `100vmin` one, and the `#vp-fix-root`
wrapper around `<slot />` is pinned to the visible rect so the stage centres
on that rather than on the phantom box. `FIT_SIZE` is read back off
`--fit-size` rather than restated. On the same phone this lands the twelfth
at 65.31px against a page scale of 0.452 — 29.5 CSS px on screen, where
ordinary mobile rendering gives 444/15 = 29.6.

`display: contents` is the wrapper's default and the whole correction is a
no-op on every ordinary visit, where the two viewports agree. The gate is the
physical `screen`, hardware and the one thing a browser mode cannot restyle,
so it fails closed: a genuine narrow desktop window has no touch and a large
screen, and never matches.

**The listeners are load-bearing, not defensive.** At parse time that phone
still reported an ordinary 443×828 viewport and only switched to the
substituted one afterwards, so the load-time-only check this started as
measures the wrong state and concludes there is nothing to fix. A re-entry
guard and a sub-pixel threshold keep the recompute from oscillating against
the resize events that drive it.

## Accessibility floor

The invariants require a nav landmark, exactly one `<h1>`, a document language,
a title and a meta description on the built page. The `<h1>` is the visible title
plate and the About panel's heading — one element in both states, so there is
no second heading to keep unique; the nav stays in the markup, visually
hidden. Avoid the words *score*, *streak*, *try
again*, *game over*, *you lose*, *wrong note* and *high score* in copy **and in
identifiers** — `spec/crit-4.test.ts` greps the built HTML and the page script
for them.

## Non-goals

No recorded audio; no octave controls or register management; no configurable
generators; no 7- or 11-limit axes; no sustain, velocity or portamento; no MIDI;
no `AudioWorklet`; no tuning-theory copy, instructions or self-explanation on
the playing surface — the About panel, which a player has to open, is the one
place any of that lives.

## Known issues

- **On some Linux desktops the pointer disappears while a key is held**, so
  playing keyboard and mouse together loses the cursor until the key is
  released. **This is the desktop environment, not the page** — it reproduces
  on a blank browser tab, and there is no `cursor: none`, pointer lock or
  `setPointerCapture` anywhere here. Many Linux setups hide the pointer while
  typing; a held key keeps that latched. The only fixes available to a page are
  the ones "The page never owns the cursor" forbids, for better reasons than
  this costs. Partly mitigated by accident: the hiding is only visual, pointer
  events keep flowing, so the press-radius disk keeps tracking throughout
  (verified over CDP with 180 real auto-repeats). Accepted, not fixed — the
  real fix belongs to whoever's desktop it is.
- **"Request Desktop Site" can't be detected or turned off by a page, only
  worked around.** See "Sizing" above for what it breaks and how. Corrected,
  but only the title plate's `clamp(…, 4.2vmin, …)` still reads the
  substituted viewport, so it sets a little larger than it does normally —
  accepted. No automated test can exercise any of this: jsdom has no layout
  engine and the substitution is browser chrome, not DOM. Verified by hand on
  an Android Chrome phone; see "The checks" and CLAUDE.md's "Two things this
  harness cannot do."

Five more, all from play-testing and all **noted, not investigated** — recorded
here so they are not rediscovered, not worked on:

- **A long press on a phone fires the platform's haptic buzz**, about a second
  after touching and holding one spot. It is the context-menu gesture, which
  makes sense when a menu follows; here nothing does, so the buzz arrives
  mid-note as a distraction. Whether a page can suppress it at all — beyond the
  `touch-action`, `-webkit-touch-callout` and tap-highlight suppressions
  already in `global.css` — is unestablished.
- **Playing from the computer keyboard leaves the mouse's marks on screen.**
  A held key neither hides the cursor disk nor clears `.hover`, so a
  keyboard-only player has a lit preview cap sitting wherever the pointer
  happens to rest, unrelated to what they are playing. The hover mark is the
  distracting one; whether the disk should go too, and whether the pointer
  itself should, is open — but "The page never owns the cursor" still forbids
  `cursor: none` as the way to do it.
- **The first gesture after a reload can light caps without sounding them.**
  Repro on a phone: load the page, refresh it, touch anywhere. The correct caps
  highlight and nothing is heard; the voices then all sound at once when the
  next gesture starts, as if held until then. Consistent with the
  `AudioContext` not yet running for that first gesture.
- **Voices released after rapid successive presses can hang on and then clip.**
  The tail outlasts the release and ends in a click rather than a fade.
  Reproducible on phone and desktop, by touch and by mouse; easiest when
  swiping quickly across many caps, but seen across as few as two. Not
  reproducible from the keyboard.
- **The keyboard hints are shown on phones, which cannot use them.** All twelve
  fundamental-domain caps carry their key letter whether or not a physical
  keyboard exists. Which signal should distinguish the two is the open part,
  not the styling.

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
