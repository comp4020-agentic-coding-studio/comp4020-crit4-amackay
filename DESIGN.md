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
score, no fail state, and nothing on the playing surface beyond the cap
labels — per instruction, no always-visible title either. A HUD of four
square buttons sits along the top edge instead, in two clusters: an info
button and the flat/sharp spelling toggle at the left (see "Spelling"), and
zoom controls at the right (see "Zoom"). The page is still called
**Tonnetz Organ** — the browser tab and the About panel carry that, the
surface itself does not.

The info button is the way in to an **About panel**: click it and a card
fades in over the surface carrying the title, a short account of what the
instrument is, and links out to Tonnetz and Shepard tone. The surface itself
still explains nothing — a player who never opens it meets exactly what they
met before. Only the small button footprints cost caps under them; the HUD's
own wrapper is `pointer-events: none`, so nothing else on the top edge is
lost the way it was when the whole plate was one click target.

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

**Where nothing hovers, the hints do not print.** A hint names a key, so on a
device that cannot press one it is twelve letters of clutter on the surface
that is meant to carry nothing but note names. `@media (any-hover: none)`
is the gate, chosen because it asks about input hardware and not about layout:
a desktop window dragged to phone proportions still has its mouse, and keeps
them. The one device it gets wrong — a phone with a keyboard paired — corrects
it by using the thing, and any keydown puts `has-keyboard` on `<html>` and the
hints back. That is the only signal that observes a keyboard rather than
standing in for one, and it is deliberately not remembered across reloads: a
stored answer would outlive the keyboard being unplugged. Nothing is lost by
the wait, because the About panel says the instrument is playable by keyboard.

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

**The first touch on a page the browser has no engagement with cannot sound,
and that is not something the page can fix.** An `AudioContext` may only start
once the document has user activation, and Chrome grants activation on
`pointerdown` only when the pointer is a mouse — for touch it is the *lift*
that grants it (measured, `scripts/probe-touch-activation.js`: a trusted
touch-down reaches the page with `navigator.userActivation.hasBeenActive`
still false, and touch-end flips it). So a first touch is silent however long
it is held, while a first click and a first keypress both sound: those events
grant activation as they arrive. `Instrument.unlock()` therefore runs on every
pointer lift as well, which is the earliest legal moment — not to rescue that
first touch, but so the device is already opening by the time the second one
lands.

**A press that cannot sound lights nothing either.** `Instrument.canSound()`
answers whether a gesture starting now will be heard, and `applyPress` does
nothing at all when it says no. A lit cap is the instrument reporting that it
is sounding that note; a player told their touch registered and hearing
nothing is left wondering about their volume, where one whose touch did
nothing simply tries again — and the second try works. The predicate is the
browser's own: a context already running, or `navigator.userActivation`
saying the page has been activated. It asks nothing about the kind of input,
which is why it needs no exception for the two that carry activation with
them: a first mouse press and a first keypress answer true and are untouched.
Both halves are load-bearing. Activation alone would go dark on a dev server
whose media engagement lets the context run with no activation at all.

**A gesture that arrives before the audio device has opened waits, and is
dropped if it ends first.** Resuming a context is not instant — on the first
gesture after a reload the device can take longer to open than the gesture
lasts — and until it is running the context's clock is frozen, so anything
scheduled against it stacks up at one absolute time and plays together the
moment it starts. Holding those voices back costs the first tap its sound;
starting them late would put a note under a finger that has already gone,
which is worse. A note still held when the device opens does sound.

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
- The playable surface also carries **`data-spelling`** (`flat` | `sharp`),
  which is where the spelling toggle's state lives — see "Spelling".
- The lit layer's twelve paths each carry **`data-pc`**, **`data-name`** (the
  pitch name, in the spelling currently showing) and **`data-notes`** — the space-separated `KeyboardEvent.code`s
  that sound that pitch class, three each. `data-notes` is both the keyboard
  mapping and the handle the spec tests hold; they match it with
  `[data-notes~="KeyF"]`.
- **Nothing carries a lattice position.** A cap is not an element any more, so
  the coordinate refinement below derives its cell rather than reading it.

### Two hit-test paths, one code path

The interesting hit test is coordinate-based, and coordinates are exactly what
the test harness cannot supply: **jsdom has no layout, so every
`getBoundingClientRect()` is zero-sized and any client-to-twelfths division
yields `NaN`** — which then throws when fed to an `AudioParam`. The previous
instrument avoided this by having no position mapping at all. This one cannot.

So resolve a gesture in two steps, and never let the first one throw:

1. **Element path.** `pointerdown`/`pointerenter`/`pointermove` on a lit path
   names one **pitch class** — SVG has already done the point-in-hexagon test,
   over that path's disjoint subpaths. Always available, needs no geometry of
   our own. It named a *cell* until the caps stopped being elements; a pitch
   class is 121 of them, so it can no longer say which.
2. **Coordinate path.** If the surface reports a non-zero rect, map client
   coordinates into twelfths through the SVG `viewBox`, get the cell from
   `containingCell` — the basis inversion, which the shipped page now calls —
   correct it with `anchorCell`, and measure `cellDist` against it and its six
   neighbours, refining into the true set of one, two or three pitch classes.

Guard on `rect.width === 0` and fall back to the element path — degrade to
doing nothing extra rather than throwing. In a real browser the coordinate path
always wins; under jsdom the instrument behaves like a one-note-per-pitch-class
grid, which is enough for the spec tests to drive it. The geometry itself is
proved by unit tests over plain functions, where it belongs — including that
`anchorCell(point, containingCell(point))` never comes up empty, which is the
composition every press now rests on.

**The refine may add pitch classes but never drop the one that was hit.** That
is the old "neither path can produce a cell the other did not", made explicit
now that the cell is derived instead of handed over: adding is the refine's
whole job on a boundary, but a set that has lost the pitch class the browser
itself hit-tested is describing somewhere else, so the element path's answer
stands instead. What that catches in practice is an event whose coordinates
don't describe where it was dispatched — a synthetic press carries
`clientX`/`clientY` of 0, and without the check it pressed whatever sits at the
top-left corner of the lattice.

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

**A move refines a press; it never starts one.** `refinePointerAt` writes the
pointer's set and calls `applyPress` whether or not that pointer was holding
anything, so the guard belongs at the listener: `pointermove` refines only a
pointer already in `pointerPcs`, and `pointerdown` is the only thing that puts
one there. Unguarded, a mouse moving with no button held sounds notes
continuously — a click and release stops it, and the next move starts it again.
The same listener reads `buttons === 0` on a mouse as a release, which is where
a lift the page never saw (over browser chrome, or outside the window) becomes
knowable. jsdom cannot see any of this: with no layout the refine returns at the
zero-sized `getBoundingClientRect()` before it presses anything, so the sensor
is `scripts/probe-mouse-move-press.mjs`, over CDP.

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

`lib/input-chrome.ts` is called from each page script: no context menu on the
playing surface (a held finger is the primary gesture and the browser reads a
long press as a right click), no browser zoom or overscroll, no touch gesture
of any kind on the surface (below), and a focus ring that belongs only to
whoever is tabbing.

#### The long-press buzz

Holding one spot on an Android phone fired the platform's haptic buzz about a
second in — the context-menu gesture's feedback, arriving mid-note with no menu
to announce. Traced through Chromium rather than guessed at, because the
mechanism is the fix:

1. `GestureListenerManagerImpl.onEventAck` performs
   `performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)` on a
   `GESTURE_LONG_PRESS` **only when the renderer reports it consumed**.
2. Blink's `GestureManager::HandleGestureLongPress` ends in
   `SendContextMenuEventForGesture`, which returns whatever dispatching the DOM
   `contextmenu` event returned — and a cancelled event is
   `kHandledApplication`, i.e. consumed. (There is a UseCounter sitting on that
   exact branch.) **So cancelling `contextmenu` to keep the menu away is itself
   what reports the long press consumed, and so what asks for the buzz.**
   Letting the menu open instead reports consumed too, by the other branch.
3. The only way out is upstream of the gesture. `TouchDispositionGestureFilter`
   gives `kGestureLongPress` `RT_START`, so a **consumed `touchstart` drops it**
   — with the whole sequence's other gestures — in the browser process, before
   one is ever generated.

Hence `preventDefault()` on `touchstart`, scoped to the surface. What that
costs is every gesture the surface would otherwise get: the compatibility mouse
events, `click`, double-tap zoom, fling. The surface wants none of them — it
has no `click` handler, and `touch-action: none` already refused the rest — and
the HUD's buttons are outside the element, so their clicks are untouched.

**It does not cost the audio unlock**, which is the one thing that would make
it unusable. Touch activation is granted by `PointerEventManager` on
`kPointerUp` ("any finger lifting is a user gesture"), not by any gesture, so
it survives the sequence's gestures being dropped —
`scripts/probe-touch-activation.js` still measures activation arriving on the
lift, exactly as "Two hit-test paths" and `Instrument.unlock` already assumed.

`scripts/probe-long-press-haptic.mjs` drives a real 1.4 s hold over CDP. The
buzz is an Android platform effect no page can observe, so what it measures is
the gesture behind it: with the `touchstart` handler in place, the sequence's
gesture-derived events (`click`, `selectstart`) stop arriving and the pointer
events and user activation do not change. **Desktop Chromium never buzzes and
takes a different branch anyway** (`GetShowContextMenuOnMouseUp` defers the
menu to long-*tap* there), so the buzz being gone is a phone's finding, not
this harness's — nothing here will notice if it ever comes back.

### About panel

Per instruction the info button opens an About panel: a plain card, not a
plate that grows into one. There is no always-visible title any more for it
to morph from — see "What it is" — so open/close is just a fade, and the
whole panel is markedly simpler than the design it replaced.

What the panel is allowed to *say* is settled elsewhere — "What the surface
already says" and CLAUDE.md's prose rules — and the card is sized to whatever
survives that, never the other way round.

- **Fixed geometry throughout; only `opacity` and `visibility` change.**
  `.about` carries one set of `top`/`left`/`width`/`max-height`/`padding`
  always, and `[data-open]` only ever toggles `opacity: 0 → 1` and
  `visibility: hidden → visible` (200ms, no delay either direction) —
  literally "fade in and fade out," per instruction. There is no second,
  animated state to keep in sync with the first, which is what makes this
  section so much shorter than the plate-that-grew-into-a-card design it
  replaced (recoverable from git history if anything here is ever worth
  reviving).
- **`visibility` and `pointer-events` are inherited, not repeated.** Every
  descendant — the ×, the `<h1>`, the body copy, its links — used to carry
  its own `visibility`/`opacity`/`transition` rule, staggered against the
  panel's own timing. None of that exists any more: `.about` sets
  `visibility: hidden` and `pointer-events: none` once, and CSS inheritance
  does the rest for every child, tab-order and click-through included. A
  child only needs its own rule here if it wants to *diverge* from the
  panel's state, and nothing currently does.
- **No more JS-measured height.** `about-panel.ts` used to measure the
  copy's laid-out height every resize and write it back as `--card-fit`, because
  the copy was absolutely positioned and so contributed nothing to any
  ancestor's intrinsic size. Now the copy is in normal flow inside a card of
  fixed `width` and CSS `max-height: var(--card-max)` (`78dvh`, `82dvh` under
  34rem) with `overflow: hidden auto` — plain CSS sizes it and scrolls it if
  it's ever too tall. `about-panel.ts` now does nothing but toggle
  `data-open` and `aria-expanded`; it never measured anything else, and it
  still never animates.
- **The info button is a normal, separate HUD button — see "Zoom" for the
  shared button style.** It is not part of `.about` at all any more: no
  travelling icon, no fading-to-become-the-×, nothing that hides when
  pressed, per instruction. Clicking it only ever opens
  (`toggle.addEventListener("click", () => setOpen(true))` in
  `about-panel.ts` — a no-op if already open), so a second press while the
  panel is open does nothing, and the button stays exactly as visible and
  clickable as it was closed. `aria-label="About"` carries its accessible
  name now that its content is only a glyph; `aria-expanded`/
  `aria-controls="about-body"` are unchanged.
- **The `<h1>` moved into the card and is plain text again**, not a button.
  The invariants still require exactly one on the page, and it still is —
  present in the static markup regardless of the panel's `visibility` — but
  it is now visually/programmatically exposed only while the panel is open,
  where it used to be the always-visible plate. Accepted, not fixed: nothing
  else on the page claims to be a heading, and the page `<title>` still
  carries "Tonnetz Organ" for anyone who never opens the panel.
- **The × still shares the heading's row, and still needs its own gap
  checked.** The heading is centred and `white-space: nowrap` while `.about-close`
  is absolutely positioned in the corner, so the two still collide if the
  heading's type ever runs wide enough to reach it — the same risk as before,
  now with one fewer moving part (no icon sharing the row any more).
  **Nothing checks this automatically**: jsdom has no layout, so the
  collision is invisible to the suite. `scripts/probe-about-close.js`
  measures the gap in a real browser — 19px at 1920×1080, 12px at 390×844,
  the same numbers as the original pre-icon design, since the heading's own
  ink is unchanged — and is what to re-run after touching the heading's
  type, the button's size, or the copy in the card.
- **Disclosure semantics, not a dialog** — `aria-expanded` on the toggle,
  `aria-controls` to the body. A disclosure needs no focus trap: the ×, the
  heading and the two links all sit in DOM order after the toggle, and
  `visibility: hidden` while closed is what keeps them out of the tab order,
  so nothing has to manage `inert`.
- **Three ways out**, per instruction plus one: the ×, a click anywhere on the
  scrim, and `Escape`. All three hand focus back to the toggle. **The info
  button itself is not a fourth**: `about-panel.ts`'s toggle handler only ever
  opens, and per instruction it does not need to hide itself to say so.
- **The instrument goes quiet while it is open.** The scrim covers the surface,
  so no pointer reaches a cap; `main.ts` gates its `keydown` on
  `about.isOpen()` for the same reason, and opening runs the same
  release-everything cleanup that losing the window does. Otherwise a key held
  as the panel opened would sound under it forever, and `Space` on a focused
  link would both play a note and follow the link.

### Zoom

Per instruction, square buttons on a top bar — `.hud`, a `position: fixed`
row spanning the top edge with `justify-content: space-between` — info and
the spelling toggle as a pair at the left end, `+`/`−` zoom as a pair at the
right, `−` then `+` left to right. Each cluster is a `.hud-group`
(`display: flex`, `gap: var(--hud-gap)`), so the two gaps inside the bar are
the one number. One shared `.hud-btn` style, and one shared `.hud` scope for
the two custom properties every button lives in:

- **`--hud-btn-size: clamp(3rem, 5vmin, 3.5rem)`** — floored at 48px. Apple
  HIG's minimum tappable area is 44pt; Material Design's recommended minimum
  touch target is 48dp, and per instruction this is "a bit bigger" than the
  44px floor it replaces. Ceiling and the `vmin` term are both the old
  values scaled by the same ratio (48/44) as the floor, so the button's
  shape across the viewport range — not just its two endpoints — grew by the
  same proportion everywhere.
- **`--hud-gap: calc(var(--hud-btn-size) * 0.182)`**, not its own clamp. The
  old zoom-pair gap (8px) to old button floor (44px) ratio was ≈0.182;
  keeping that ratio and driving it off `--hud-btn-size` directly means the
  edge margin, the gap inside a cluster, and the button size all
  move together at *every* viewport width, not just where a hand-picked
  second clamp happens to agree with the first. `.hud`'s `top`/`left`/`right`
  insets and `.hud-group`'s `gap` both read this one property — per
  instruction, the margin to the screen edge and the margin between the two
  zoom buttons are the same number, and moving the buttons closer to the
  edge was exactly swapping the old, unrelated edge-inset clamp for this one.
  The icon glyphs scale the same way, off `--hud-btn-size` too (`0.57` of
  it, the old glyph-to-button ratio), so a bigger button does not read as
  the same glyph with more padding around it.

`.hud` itself is `pointer-events: none` with each button opting back in, so
the empty space between the two clusters still reaches the surface
underneath, same as the old plate's `pointer-events: none` did for the caps
it didn't cover.

The zoom buttons move `--fit-size` — the number of twelfths the viewport's
short axis shows — between the bounds in `lib/tonnetz.ts`, multiplicatively:
`FIT_SIZE_MIN = DOMAIN_SIZE` (12, the fundamental domain fills the screen) and
`ZOOM_RATIO = FIT_SIZE_INITIAL / FIT_SIZE_MIN` (1.25 = 5/4) — the one ratio
that returns from max zoom-in to the page's initial view (15, the domain plus
a fixed padding) in exactly one click. Zoom levels form an 8-stop ladder,
`fitSizeForStep(i) = FIT_SIZE_MIN * ZOOM_RATIO ** i` for `i` from 0
(`FIT_SIZE_MIN`) to `ZOOM_STEPS_OUT = 7` (`FIT_SIZE_MAX`, `57.220458984375` —
the closest integer power of the ratio to the old hand-picked ~56, and exact
in floating point since `4**7 = 2**14`). A click snaps `current()` to its
nearest step, then moves exactly one — never multiplies/divides `current()`
directly — so a move always lands exactly on the next clean stop, including
the bounds, regardless of where the previous move left the value. The camera
centre (`CENTRE_X`/`CENTRE_Y`) never moves; only the window size does.

- **`lib/zoom.ts` reads `--fit-size` back off the stage rather than tracking
  its own state**, the same idiom `Layout.astro`'s `fitSize()` already uses
  for the same property. It clamps, sets the property, and toggles
  `disabled`/`aria-disabled` on whichever button is at its bound.
- **Every zoom move animates**, buttons and keyboard alike: `--fit-size` is
  registered via `@property` (`syntax: "<number>"`) in `index.astro`'s
  scoped `<style>` so it can be tweened at all — an unregistered custom
  property only ever jumps — and `.stage` carries
  `transition: --fit-size 240ms ease-out`, so the whole existing
  `--twelfth`/width/height `calc()` chain animates for free with no JS
  tween. `prefers-reduced-motion: reduce` turns it off along with the
  page's other transitions.
- **Keyboard**: `0` resets to the initial view; `-`/`=` zoom out/in one
  ratio-step, the same move and the same animation a button click makes.
  Holding a key does nothing beyond that first step — `main.ts` guards on
  `event.repeat`, same as the note keys. `Ctrl`/`Cmd` are left alone so the
  browser's own page zoom still works.
- **The drawn window is sized at runtime, not chosen at build time.** At
  `FIT_SIZE_MAX` the window has to cover the long axis of the viewport with no
  blank canvas past the lattice's edge, and the viewport's shape is not
  something a build can know: a constant picked for the two marked viewports
  covered aspect ratios up to about 2.24:1 and left black bands on anything
  wider, which an ultrawide monitor at 2.37:1 reaches at the last zoom stop.
  `requiredExtent(fitSize, ratio)` computes it instead, and `main.ts` grows the
  window to match. See "The drawn window is not a constant".
  `scripts/tonnetz-check.ts` re-derives the whole thing from scratch (the
  window's corners, inverted through the F/B basis) rather than trusting a
  comment — re-run it after changing `EXTENT`, `DOMAIN_SIZE`, `H_SPACING`, or
  the zoom ratio/step count.
- **A hidden coupling**: `Layout.astro`'s "Request Desktop Site" viewport fix
  only recomputes `--twelfth` on `resize`/`orientationchange`/`load`/
  `visualViewport` resize — none of which fire on a zoom click. `zoom.ts`
  dispatches a `tonnetz:fit-size-change` window event after every change, and
  `Layout.astro` listens for it too. The event name has to match by hand on
  both sides — that script is `is:inline` and can't import a constant.
- **The whole `.hud` sits under `.about-scrim` in stacking** (`z-index: 1`,
  declared before the scrim in the DOM so same-layer ties resolve in the
  scrim's favour), not above it: while the About panel is open, the scrim
  visually covers all four buttons — including the info button, which per
  instruction does not need to *hide*, only to sit under the same translucent
  layer everything else on the surface does — and intercepts clicks on them,
  closing the panel same as clicking anywhere else on the scrim, with no
  extra state to manage for that part. Giving `.hud` no `z-index` at all left
  it in the same paint bucket as `.stage` (also `position: relative`,
  `z-index: auto`) and, being earlier in the DOM, painted *under* it —
  invisible despite a correct rect and `opacity: 1`.
- **Keyboard tab order needs separate handling for every button but info.**
  `zoom.ts`'s `setEnabled()` pulls `+`/`−` out of the tab order on open (via
  `about-panel.ts`'s `onOpen`/`onClose`) and back in on close, since stacking
  order says nothing to a screen reader; `spelling.ts`'s does the same for its
  own button. The info button is deliberately left out of this: it is the disclosure toggle immediately before the panel's own
  content in DOM order, so leaving it tabbable is the same disclosure pattern
  every other toggle-into-content control here already uses, and per
  instruction it has nothing to hide in the first place.
- **A pointer that isn't moving still needs re-hit-testing while zoom
  animates**, since the screen-to-lattice mapping changes every frame the
  `--fit-size` transition runs but a stationary pointer generates no event of
  its own to prompt a re-read. `main.ts` treats each animation frame as a
  pointer event at the same on-screen position: it records every coordinate
  refine's `{clientX, clientY}` (`lastClient`), and for as long as `.stage`
  reports a running `--fit-size` transition (`transitionrun` to
  `transitionend`/`transitioncancel`, via `requestAnimationFrame`) it replays
  that position for whichever pointers are currently hovering (the cursor
  dot, the mouse preview) or pressing (a held mouse/touch drag) against the
  live, mid-transition geometry. Without this, the instrument and the zoom
  controls are each pressable on their own but not *together* through an
  animation: a note held stationary while zoom runs — or the mouse's hover
  preview — freezes at the pre-zoom geometry and only resolves (sometimes
  incorrectly, having skipped every intermediate cell) on whatever pointer
  event happens to come next.

### Spelling

Per instruction a second HUD button, immediately right of the info button,
switches the caps between flat and sharp names. **The glyph is the spelling
it switches *to***, so the button shows `♯` while the caps are showing flats
and `♭` while they are showing sharps — an offer, not a readout — and
`aria-label` says the same thing in words ("Show sharps" / "Show flats"),
rewritten with the glyph.

- **The state lives on the stage as `data-spelling`**, not in a variable in
  `lib/spelling.ts`, because `surface.ts`'s `grow()` rebuilds every label from
  scratch on a resize or a zoom step and has to build them in whatever spelling
  is showing. Same "one value, read back off the element" idiom `zoom.ts` uses
  for `--fit-size`. `scripts/check-spelling-toggle.js` drives a toggle and then
  a grow, and checks the rebuilt labels came back in the right row.
- **Both rows live in `lib/tuning.ts`** — `equalTemperamentNameFor(ratio,
  spelling)` — so a name is still derived from a ratio and never from another
  name, everywhere except the toggle itself. The toggle takes the other route:
  `respellName` maps a name to its twin, which is what lets it rewrite a label
  from what the label already says, with no cap having to carry its pitch class
  as an attribute (see "The lit layer" for why caps carry nothing).
- **The labels are the one layer priced by the zoom, and this is the one thing
  that pays it.** A toggle rewrites every drawn `.name` — hundreds to a couple
  of thousand — plus the twelve lit paths' `data-name`. That is a discrete
  click, not a gesture, and it touches nothing that sounds or lights a note, so
  the cost stays off the instrument's own paths. The page ships in the spelling
  `data-spelling` claims, so load rewrites nothing at all.
- **The seven naturals are spelled the same either way**; only five caps in
  twelve change, which is also what makes the swap read as a respelling rather
  than a different lattice. Flats are the default, matching the fifths-chain
  naming this document uses throughout.
- **Tab order gets the same treatment as the zoom pair**: `setEnabled(false)`
  while the About panel is open (`main.ts` wires both to the panel's
  `onOpen`/`onClose`), since the scrim covers the button visually and
  intercepts its clicks but says nothing to a screen reader. Unlike the info
  button, this one is not the panel's own disclosure toggle, so it has no
  reason to stay reachable underneath it.

### Mouse preview

Per instruction, the mouse gets what a finger already has for free: a visible
sense of how big a press is. A finger covers `r`'s disk by being a finger; a
mouse pointer has no size until it clicks, so two things stand in for that:

- **A disk rides with the cursor.** A circle of diameter `2r`
  (`--press-diameter` in `index.astro`, read from `R` in `tonnetz.ts` rather
  than hand-typed) follows the pointer at the same px-per-twelfth scale as the
  caps, drawn only once a mouse is confirmed present (`pointermove` carrying
  `pointerType: "mouse"`).

**Playing a key puts both marks out.** A key that sounds a note means the
hands have left the mouse, so a lit preview cap and a disk parked wherever the
pointer happens to rest are describing something nobody is doing — and the
preview is the worse of the two, since it lights caps unrelated to what is
being played. **Any** mouse event brings both back, not just movement: a
player who reaches for the mouse and clicks without nudging it produces no
`pointermove` at all, so keying the restore to movement left the marks off
through the whole click and after it. Keys that do not sound leave both alone,
so tabbing to a HUD button disturbs nothing. The pointer itself stays the
browser's throughout — see below.

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

### The lit layer

**A cap is not an element.** The surface is three layers, and only the first
one ever changes:

1. **Twelve `<path>`s, one per pitch class**, each holding every hexagon of
   that pitch class in the drawn window as a disjoint subpath. This layer
   paints the fill, carries the whole of the played state — `.active`,
   `.hover` and the restrike flash — and is what the browser hit-tests.
2. **One static `<path>` of every hexagon's outline**, stroked, drawn over the
   fills: the black cap edges. `pointer-events: none`.
3. **The labels**, one `<text>` per drawn cap plus the twelve key hints.
   `pointer-events: none`. They are the only layer a resize rebuilds — see
   "The drawn window is not a constant".

The split is not an optimisation of the drawing; it is what makes the cost of
playing a note independent of the zoom. A pitch class has about 121 caps in the
drawn window and between one and fifty of them on screen depending on the zoom
stop, so state held per cap costs whatever the zoom happens to show — and the
cost is the browser's style recalc over the matched elements, which no amount
of cleverness on the JS side avoids (a root class plus a static CSS rule
measured no faster than the loop it replaced). Held on one path per pitch
class, a press is one class write and a restrike one `animate()`, at every
zoom. Measured at 6x CPU throttle, the second touch of a two-finger tap sharing
a triad went from 25.6 ms to 4.3 ms at the most zoomed-out stop, and stopped
varying with the zoom at all.

The hit test comes with it. A pitch class's hexagons are disjoint subpaths, so
a point inside one answers with that path and a point inside a neighbour's does
not: the press boundary is the hexagon itself, measured at exactly the
geometry's 2, 1.75 and √7.25 twelfths by `scripts/check-hit-boundary.js`. What
it cannot say is *which* cell was hit — see "Two hit-test paths".

Twelve `pointerenter` listeners are enough for a drag, where one per cap used
to be needed, because two adjacent caps never share a pitch class: every cap boundary
crossed is a crossing between two of these paths.

The path data is encoded relative, caps ordered by screen row, so every
hexagon's body is the same twenty-six characters and almost every hop between
them is `m12,0`. The twelve paths and the seam layer together cost about 600
bytes over the gzipped page; written absolute they would cost 22 KB.
`tonnetz.ts`'s `capPaths` builds them, and its tests walk the emitted `d` back
into vertices and check them against `pos()` and `HEX`.

### The drawn window is not a constant

How much lattice to draw is a question about the viewport, and the viewport is
not something a build knows. It used to be answered by a constant — `EXTENT`,
sized for the worst of the two marked viewports — which covered aspect ratios
up to `2 * EXTENT / FIT_SIZE_MAX` ≈ 2.24:1 and left black bands past the
lattice's edge on anything wider. An ultrawide monitor is 2.37:1 and reaches it
at the last zoom stop; a tall narrow window reaches it two stops earlier.

So `requiredExtent(fitSize, ratio)` computes it instead. The short axis shows
`fitSize` twelfths and the long one `fitSize * ratio`; the window is square, so
it is sized for the long one, plus `MARGIN` so a hexagon merely reaching in is
still drawn. `main.ts` calls it on load, on resize, on orientation change, on
`visualViewport` resize, and on every zoom step, and `installSurface` grows the
window to match.

Four things make that safe:

- **Grow-only, in steps of 8 twelfths.** A drag-resize fires continuously; a
  window that shrank back would rebuild on every pixel, and one that grew by
  the exact amount would rebuild on nearly every pixel. Growing in steps means
  a session converges on the largest window it has needed and then stops.
- **The zoom's target, not its current value.** A zoom step is a CSS transition
  on `--fit-size`, so `getComputedStyle` returns the value mid-flight —
  smaller than where the zoom is heading, which sizes the window for a stop it
  has already left and lets the edges go black on the way out. Read the
  specified value off the inline style; `zoom.ts` and the page both write it
  there. `zoom.ts` fires its event synchronously from that write, so the window
  grows before the transition's first frame.
- **The twelve lit paths and the seam path are never replaced, only re-`d`-ed.**
  They carry the played state, the pointer listeners and any running restrike:
  a note held across a resize has to stay held, and it does. Only the labels,
  which carry nothing, are rebuilt.
- **Labels are cloned from the ones the page shipped.** Astro's scoped CSS
  matches on a `data-astro-cid-*` attribute it hangs on template elements, so a
  label built from scratch at runtime silently loses its font, its fill and its
  `pointer-events: none`. Cloning carries whatever the build put there.

What the page ships is now only what the load state needs: `EXTENT` covers a
4:1 viewport at `FIT_SIZE_INITIAL`, so the first paint is right before any
script runs, and the page went from 434 KB to 68 KB — 42 KB to 6 KB gzipped.

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
  stated: the About panel and the HUD buttons keep the same light-on-dark
  backdrop, since they have to stay legible over caps spanning 64–89%
  lightness; and the cursor disk keeps its white ring and wash, per
  instruction, because black read as a shadow on caps this light instead of as
  the pointer's footprint.
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
  anything the player should be able to see. This is the same instinct as
  "nothing scales" below, and as the inward `outline-offset` on the focus ring
  in `global.css`.

  A centred SVG stroke breaks the rule by construction — half of every stroke
  lands on the neighbour. The answer is not to clip each cap's stroke back into
  its own hexagon but to **draw all the seams once, in one layer above the
  fills**: a seam painted by a single element, symmetrically over both caps it
  divides, has no paint order to expose. The ink is the same either way, 0.09
  twelfths centred on every interior edge, and the clip that used to hold two
  butted half-strokes apart is gone with the per-cap elements it lived on.

  What the clip also did, and what now falls out of the geometry instead, is
  fix where a press stops: `elementFromPoint` respects a clip, so the hit
  boundary sat wherever the clip did. The lit layer's fill *is* the hexagon, so
  the boundary is the hexagon with nothing holding it there —
  `scripts/check-hit-boundary.js` measures it and gets the geometry's own
  numbers back.
- **No reduced opacity anywhere**, per instruction. A cap outside the
  fundamental domain is drawn exactly like its twin inside it, because it *is*
  its twin — same note, same colour, same name. The wrap shows itself by
  repetition, and the surface reads as one continuous thing rather than a tile
  with a decorated border.
- **Two labels per cap**, both plain black. The pitch name centred and
  prominent (in flats or sharps, per the HUD's toggle — see "Spelling"); the
  keyboard key bottom-right and quieter by size and weight
  alone, since reducing its opacity would composite the cap's hue through it.
  Caps outside the keyed block carry the pitch name alone — on desktop there
  are none, so this only shows on a tall viewport.
- **Active state** is colour only, as before: it arrives over the 15 ms attack
  and fades back over ~500 ms, so the visual tail matches the audible one.
  Nothing scales; a cap that grew would break the tiling.
- **A floor of 80 ms on the lit state**, so a tap shorter than a frame is still
  seen. Style is recalculated once a frame, so a class added and removed
  between two recalcs is never *computed*: no transition starts and nothing
  paints, and a brief tap sounded a note the surface never acknowledged. That
  is worse than either a silent press or a lit one — the player is told nothing
  while hearing something, so the instrument reads as unreliable rather than as
  quiet. 80 ms is the attack plus two frames even on a 30 Hz display, which is
  what it takes for the lit colour to be reached *and* painted before the decay
  starts. It floors only taps already shorter than itself; a held note is
  untouched. A re-press inside the floor counts as a restrike, since the light
  is still showing when it arrives.
- **Restrike flash.** A cap already lit gains nothing visible when a second
  holder arrives on the same pitch class, yet a second voice really did start —
  so it flashes: `brightness(1.3)` decaying back over 220 ms. This is the one
  place a `filter` is used, chosen over a `fill` animation so the transient
  lives in one line of script rather than as a second copy of the palette. It
  is on the pitch class's path in the lit layer, and needs no clip of its own:
  `brightness()` is a per-channel transform with no spatial spread, so it
  cannot put ink anywhere the path's own hexagons did not. **That is a
  constraint on what the flash may become, not just a note about what it is** —
  a `blur`, a `drop-shadow` or a glow would need containing again, and the
  containing element's bounding box is now the whole drawn window. Only ever on
  a *re*-strike; a first strike already has the 15 ms attack to announce it.
- **Motion.** Only those transitions, plus the About panel's fade and the
  zoom buttons' disabled-state dimming (see "About panel" and "Zoom") — all of
  which answer `prefers-reduced-motion` — a cap's colour transitions are the
  state itself arriving, where the panel's is decoration over a state change
  that could just as well be instant. No idle animation. One asymmetry is
  deliberate: a released cap that the mouse is *still sitting on* returns to
  the hover colour over 200 ms rather than decaying to rest over 500 ms. The
  full tail belongs to a cap you have left; a cap under the cursor should go
  on saying "you are here" instead of pretending it isn't hovered.

The major/minor warm/cool convention the hand-off locked in its §1 applies only
to the triad spots, so it has nothing to colour and is dropped. Hue stays the
single varying channel across the whole surface.

**The tab icon is one cap's outline**, per instruction: a stroke, transparent
inside and out, black and flipping to white under `prefers-color-scheme: dark`
(honoured by Chrome and Firefox; Safari keeps the black). `src/lib/favicon.ts`
generates it from `HEX` and `src/layouts/Layout.astro` inlines it into the head
as a `data:` URI — so it cannot drift from the shape it names, and there is no
base path for it to resolve wrongly. Colour is deliberately not carried over:
hue means pitch class here, and a lone hexagon has no pitch class.

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
a title and a meta description on the built page. The `<h1>` is the About
panel's heading — present in the static markup regardless of the panel's
`visibility`, so the invariant holds, but visually/programmatically exposed
only once the panel is open (see "About panel"); the nav stays in the
markup, visually hidden. Avoid the words *score*, *streak*, *try
again*, *game over*, *you lose*, *wrong note* and *high score* in copy **and in
identifiers** — `spec/crit-4.test.ts` greps the built HTML and the page script
for them.

**With scripting off, a small plate says so.** That is this page's one
failure mode where it looks entirely correct and is not: the lattice lays out
perfectly, and then nothing responds to anything — the HUD buttons and the
About panel are all inert without `zoom.ts`/`about-panel.ts`/`main.ts`
running. The notice lives in `index.astro` rather than the layout because it
is its own small plate — the About panel only ever appears once script has
run to open it, and with scripting off nothing ever will —
positioned at the same top inset the HUD buttons use.
`scripts/probe-noscript.js` checks it at both marked sizes with scripting
genuinely disabled; jsdom renders `<noscript>` content unconditionally and so
cannot.

## What the surface already says

The register of what the design has been established to convey on its own.
It exists to be subtracted: copy that repeats an entry here is deleted rather
than polished, per CLAUDE.md "User-facing prose is the complement of the
artefact". Whoever builds a thing is the worst-placed to judge what is obvious
about it, so an entry has to name the mechanism that carries it or the
play-test that found it — a conviction is not a finding, and an entry can be
demoted by the first stranger who plays this.

- **These are buttons, and they can be pressed.** The mouse preview lights a
  cap before it is pressed and the press then brightens it further — one
  gesture establishes both that the caps respond and that a press is a state
  they hold. See "Mouse preview".
- **One, two or three at once.** The press disk is wider than a seam, so
  crossing one lights two caps together and a corner lights three, without
  anything having to be aimed at. Reaching a corner is the signature gesture;
  a player finds it by dragging.
- **The grid wraps.** Hover and press light *every* copy of a pitch class at
  once (see "Mouse preview"), so the first interaction anywhere shows four
  caps responding together and the repeat is visible without waiting for a
  player to notice recurring names. Established by mechanism; not yet watched
  over anyone else's shoulder.
- **The caps are keys, and the keyboard carries on past the printed ones.**
  Twelve caps print a key hint (see "Keyboard"), and the other twenty-four keys
  play unlabelled. Per instruction: a paragraph saying so was written into the
  About panel and deleted from it as already obvious.

## Non-goals

No recorded audio; no octave controls or register management; no configurable
generators; no 7- or 11-limit axes; no sustain, velocity or portamento; no MIDI;
no `AudioWorklet`; no tuning-theory copy, instructions or self-explanation on
the playing surface. The About panel is where anything of the sort lives
instead — but it is a place, not a licence: what goes in it is settled by "What
the surface already says" and CLAUDE.md's prose rules, and the panel is sized
to the copy that earns its way in, never the copy to the panel.

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
  worked around.** See "Sizing" above for what it breaks and how. Corrected
  for the lattice itself, but every other `vmin`-based `clamp(…)` on the page
  — the HUD buttons, the About panel's heading and card, the no-JS notice —
  still reads the substituted viewport, since only `--twelfth` is overridden.
  They set a little larger than they do normally — accepted. No automated
  test can exercise any of this: jsdom has no layout engine and the
  substitution is browser chrome, not DOM. Verified by hand on an Android
  Chrome phone; see "The checks" and CLAUDE.md's "Two things this
  harness cannot do."

One more, from play-testing and **noted, not investigated** — recorded here so
it is not rediscovered, not worked on:

- **A phone user hit rendering bugs this repo can't reproduce** — no detail
  beyond "different rendering, including a blank page, on different browsers"
  and "repeated orientation changes." Worth investigating by simulating
  plausible phone models and interactions with the tooling already in use
  here, rather than adding anything new just for this.

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
