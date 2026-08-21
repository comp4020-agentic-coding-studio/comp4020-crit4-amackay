# DESIGN.md — the instrument

The implementation authority for this prototype. `CLAUDE.md` governs how to work
in the repo; this file governs what to build. Where they disagree, `CLAUDE.md`
wins on process and this file wins on the artefact.

The design was settled in a separate conversation; the handoff brief and the
returned decisions are in the history (`git show 14c54b5`).

## What it is

A 9×4 grid of glowing key-caps, one per node of the 5-limit just-intonation
lattice, each sounding an octaveless Shepard tone while held — playable
polyphonically by multi-touch, by finger-drag, or by the matching block of
QWERTY keys.

There is no score, no fail state, no instructions, and no text on the page
beyond the key labels.

## Tuning

Each node sounds the pitch class of `3^a · 5^b` against a root of pitch class F
(reference 349.2282 Hz). Columns step the 3-axis, rows step the 5-axis, and the
y-axis is inverted: going down a row multiplies by 5, it doesn't divide.
Column index `i = 0…8` gives `a = i − 3`, so the q-row is a chain of fifths:
Ab Eb Bb F C G D A E — the root `1/1` lands on `r`, not on any row's `f`; the
physical `f` key now carries `3^0·5^1`, a fifth row down from the root.

| Row (top→bottom) | Keys | `b` |
|---|---|---|
| digits | `1 2 3 4 5 6 7 8 9` | −1 |
| q-row | `q w e r t y u i o` | 0 |
| a-row | `a s d f g h j k l` | 1 |
| z-row | `z x c v b n m , .` | 2 |

**The near-unisons are intended, not a bug.** A nine-wide chain of fifths wraps
far enough to collide with the 5-axis: three pairs (`1`~`o`, `q`~`l`, `a`~`.`)
sit a schisma apart — 1.95 cents, beating about once every three seconds — and
28 pairs fall within 30 cents, the 19.6-cent ones being syntonic-comma pairs.
Per instruction: players discovering audible beats is part of the instrument.
Do not "fix" this by narrowing the lattice further.
`scripts/lattice-check.ts` recomputes all of it.

All 36 pitch classes are distinct, and per-voice loudness varies by only
0.27 dB, so no per-node loudness correction is needed.

## Synthesis

One voice per held node. Eight sine partials, octave-spaced, under a fixed
Gaussian amplitude window in log-frequency — the window is fixed in *absolute*
frequency, which is what makes the tone octaveless.

- `x = frac(log2(349.2282 · 3^a · 5^b / 32))`
- partials at `f_k = 32 · 2^(x + k)` for `k = 0…7` (32 Hz – 8192 Hz)
- `A_k = exp(−(log2(f_k / 260))² / (2 · 1.5²))`, then normalise by `1 / Σ A_k`

Graph per voice: 8 sine `OscillatorNode`s → per-partial `GainNode`s (fixed
`A_k`) → one voice `GainNode` (the envelope) → shared master `GainNode` →
`DynamicsCompressorNode` (defaults) → destination.

**Envelope.** Attack: voice gain 0 → 1 over 15 ms. Release: `setTargetAtTime`
toward 0 with a 120 ms time constant.

**Stop the oscillators explicitly, six time constants after release** (≈720 ms).
`setTargetAtTime` never reaches zero: stopping earlier clicks audibly, and never
stopping leaks oscillators for the life of the page. Disconnect on the
oscillator's `ended` event.

**Master gain is 0.25**, confirmed by ear during development. Every partial
starts at phase 0, so a voice sums coherently at the attack and peaks at exactly
1.0; ten simultaneous voices would peak at 10.0. Per instruction, ten-finger
chords are not a case to engineer around — do not add limiting beyond the
compressor already in the graph.

**Silence is the rest state.** Create the `AudioContext` lazily on the first
gesture and call `resume()` on it, always — the spec tests assert both that
nothing sounds before the first gesture and that a resume happens on it. When no
node is held and all tails have decayed, the page is silent. Release every
active voice on `window` blur.

## Interaction

### DOM contract

- The grid container carries **`data-instrument`**.
- Each cap carries **`data-note="<KeyboardEvent.code>"`** — `KeyA`, `Digit1`,
  `Semicolon`, `Comma`, `Period`, `Slash`, and so on. This is both the keyboard
  mapping and the handle the spec tests hold each node by.

### Keyboard

Listen on `window`, keyed by `event.code` so the mapping is layout-independent.
Hold a `Set` of active codes; ignore `event.repeat`; `keydown` starts a voice and
`keyup` releases it. Unmapped keys do nothing — never throw, never scold.

**Call `preventDefault()` on mapped keys.** `/` opens Firefox's quick-find
otherwise, and an apostrophe-style shortcut steals focus mid-performance. Do not
blanket-preventDefault: leave Tab, F-keys and modifier combinations alone so the
page stays escapable.

### Pointer, including drag

A cap is a discrete trigger — there is no position-within-node mapping, and no
`getBoundingClientRect` arithmetic anywhere (jsdom reports zero-sized rects, so
rect division would produce `NaN`, which also throws when fed to an `AudioParam`
in a real browser).

**Finger-drag across caps must play them.** This is the first thing a stranger
tries, and the crit opens cold. Two facts make it harder than it sounds:

- **Touch pointers are implicitly captured** to the element where `pointerdown`
  happened, so `pointerover`/`pointerenter` never fire on the caps you drag
  onto. Call `releasePointerCapture(event.pointerId)` in the `pointerdown`
  handler to defeat this.
- **jsdom has no layout**, so `document.elementFromPoint` is unusable under
  test. Any drag path built solely on it is untestable.

So handle drag two ways, both feeding one code path:

1. `pointerenter` on a cap, when that pointer is currently down, starts that
   cap's voice and releases the previous cap held by the same pointer. This is
   the path the spec tests drive.
2. A `pointermove` fallback on the container that resolves the cap under the
   pointer via `elementFromPoint`, wrapped so a missing implementation degrades
   to doing nothing rather than throwing.

Track voices per `pointerId`, so multi-touch holds one voice per finger.
`pointerup`, `pointercancel` and `pointerleave` on the grid all release that
pointer's voice. Set `touch-action: none` on the grid.

Pointer and keyboard are equal citizens and work simultaneously.

### Input chrome

The browser's defaults get in the way of a performance, so both playable pages
install the same suppressions (`lib/input-chrome.ts`, called from each page
script):

- **No context menu on the playing surface.** A held finger is the primary
  gesture; the browser reads a long press as a right click. Prevented on
  `[data-instrument]` only, so right-click still works off the surface.
- **No browser zoom or overscroll.** `touch-action: none` and
  `overscroll-behavior: none` on `html`/`body`, plus `maximum-scale=1,
  user-scalable=no` on the viewport meta — otherwise a two-finger press pinch-
  zooms and a double tap zooms in. OS-level gestures are out of a page's reach;
  this covers the browser's share.
- **The focus ring belongs to whoever is tabbing.** A `keyboard-nav` class on
  `<html>`, set by a `Tab` keydown and cleared by the next interaction of any
  kind, gates the only `:focus-visible` outline the page has. Focus itself is
  never moved or blurred, so a keyboard player keeps their place.

## Visual design

- **Layout.** The grid fills the viewport, vertically centred, on a near-black
  background (`oklch(18% 0.01 260)`). Caps sit flush against each other, square
  cornered — no background shows except outside the grid's own edge. Each row
  upward is translated left by ⅓ of a cap width, mirroring the physical
  keyboard stagger. The offset accumulates to a full cap width across four
  rows, so the container needs that much horizontal slack or the top row clips.
- **Colour is pitch class.** `hue = 25° + 360° · pc`, where
  `pc = frac(log2(ratio))`, so the root F sits at 25°. Rest: `oklch(75% 0.12
  hue)` fill, label `oklch(28% 0.02 hue)`. Lightness and chroma are constant
  across caps — hue is the only varying channel, so equal pitch-class distances
  look equally different. The schisma pairs above are consequently near-identical
  in colour (0.6° apart); that follows from the rule and is left alone. Every
  cap carries a 3px `oklch(45% 0.1 hue)` border — same hue, darker — because
  two flush caps of equal lightness and chroma otherwise vibrate at the seam
  with no gap to separate them.
- **Active state.** While sounding: lightness → 88%, chroma → 0.16, over the
  15 ms attack; on release, fade back over ~500 ms so the visual tail matches
  the audible one. Per instruction: colour carries the affordance alone, no
  scale — the caps sit flush, and a cap that grew would shove its neighbours.
- **Type.** System sans stack, uppercase, sized to the cap. The labels are the
  only visible text on the page.
- **Motion.** Only the transition above. No idle animation.

### Portrait phones

Per instruction: when the viewport is portrait, render the whole stage rotated
90° so it appears landscape without the player touching their orientation lock.

```css
@media (orientation: portrait) {
  .stage {
    position: fixed;
    inset: 0 auto auto 0;
    width: 100dvh;
    height: 100dvw;
    transform-origin: top left;
    transform: rotate(90deg) translate(0, -100%);
  }
}
```

`translate` applies before `rotate`, and the swapped `width`/`height` make the
rotated stage cover the viewport exactly. Hit-testing rotates with the element,
so pointer events and `elementFromPoint` need no correction. Known caveat, worth
seeing on a real phone before the cutoff: text and caps are sideways relative to
a player who does not turn the device, which is the intended trade.

## Accessibility floor

The invariants require a nav landmark, exactly one `<h1>`, a document language,
a `<title>` and a meta description on the built page. Keep the `<h1>` and nav
in the markup, visually hidden. The instrument still needs a name for the title
and description; the description stays in the instrument's own voice — a name
and a neutral phrase, never an explanation of the design. Avoid the words
*score*, *streak*, *try again*, *game over*, *you lose*, *wrong note* and *high
score* in copy **and in identifiers**: `spec/crit-4.test.ts` greps the built
HTML for them, and the page script the build ships alongside it — inline or
its own file, whichever Astro chooses this build.

## Debug mode

`?debug` in the URL toggles a `.debug` class onto `<html>` from `main.ts`,
purely client-side — nothing about the built page changes. It is a tuning aid
for whoever is building the instrument, never something a player finds by
playing it, and doesn't count against "no tuning-theory copy... anywhere in
the artefact" below: it's off by default and behind a flag nobody stumbles
into.

While on, each cap shows its monzo (`|a b⟩`, the `3^a · 5^b` exponents — no
`2`-exponent, since a pitch class has no fixed octave to place one in) and its
nearest 12-tone-equal-temperament name, and the key label shrinks into the
bottom-right corner to get out of the way. The ET name is a landmark for the
ear, not a claim of exactness: `equalTemperamentNameFor` in `tuning.ts` rounds
to the nearest semitone, and that rounding grows with distance from the root,
per DESIGN's own near-unison analysis above.

## Shepard/12-TET test page

`shepard.html` (`src/pages/shepard.astro`, linked from the main page's hidden
nav) is a standalone manual-test rig for the Shepard-tone synthesis in
`instrument.ts`, independent of the just-intonation lattice — so an oddity
while testing it can't be blamed on the tuning. Twelve buttons in a clock
face, one per plain 12-TET semitone from the same root F, clockwise from 12
o'clock. `Q W E R T Y U I O P [ ]` play them directly and polyphonically, and
so does a pointer press-and-hold or drag. `1`–`0` (`0` = ten) advance a
shared cursor that many semitones clockwise and
sustain the landed-on button for as long as that digit key is held —
independently of any other key held at the same time, so holding `1` and then
also pressing `3` sustains two separate notes, the second further round the
circle than the first; `Shift`+digit goes anticlockwise instead. Not part of
the graded instrument.

The page fills one viewport, carries no copy beyond the dial labels, and hides
its `<h1>` and nav the way the main page does. **Drag differs from the main
grid in one respect: it releases in the gap.** The dials don't touch, so unlike
flush caps there is somewhere to be between them — leaving a dial silences it,
and the next one sounds on entry. Everything else is the same two-path
arrangement (`pointerenter` plus an `elementFromPoint` `pointermove` fallback)
for the same reasons.

## Non-goals

No drone; no octave controls or range management (Shepard tones delete the
problem); no position-as-frequency layout; no configurable lattice generators;
no 7- or 11-limit axes; no sustain or pin toggle; no portamento; no mitigation
for membrane-keyboard ghosting; no `AudioWorklet`; no tuning-theory copy,
instructions, or self-explanation anywhere in the artefact.

## Still open

- **Name and description.** The title/description in `index.astro` are still
  the template placeholders. Needs a name for the instrument and a one-line
  description in its own voice, neither explaining the design.
- **Portrait rotation, on an actual phone.** Verified so far only by resizing
  a desktop browser; the CSS trick in "Portrait phones" above has never been
  seen on a real device.
- **`PROCESS.md`** is still the template. `reflections/crit-4.md` is the repo
  owner's alone — never draft it.
