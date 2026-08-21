# C4 instrument — design decisions

## The instrument in one sentence

A 10×4 grid of glowing key-caps, one per node of the 5-limit just-intonation
lattice, each sounding an octaveless Shepard tone while held — playable
polyphonically by multi-touch or by the matching block of QWERTY keys.

## Sound

**Tuning.** Each node sounds the pitch class of `3^a · 5^b` relative to a root
of pitch class F (reference 349.2282 Hz; octave is irrelevant — see below).
Columns step the 3-axis, rows step the 5-axis.

**Shepard synthesis (one voice per held node).**
- Let `x = frac(log2(349.2282 · 3^a · 5^b / 32))`. The voice's partials are
  sines at `f_k = 32 · 2^(x + k)` for `k = 0…7` (every voice gets exactly 8
  octave-spaced partials spanning 32–8192 Hz).
- Partial amplitudes follow a fixed Gaussian in log-frequency:
  `A_k = exp(−(log2(f_k / 260))² / (2 · 1.5²))` (center 260 Hz, σ = 1.5
  octaves). Normalize each voice by `1 / Σ A_k` so every node is equally loud.
- Node graph per voice: 8 sine `OscillatorNode`s → per-partial `GainNode`s
  (fixed `A_k`) → one voice `GainNode` (the envelope) → shared master
  `GainNode` → `DynamicsCompressorNode` (default settings) → destination.
  The compressor exists so ten simultaneous voices don't clip.

**Envelope.** Attack: ramp voice gain 0 → 1 over 15 ms on press. Release:
decay toward 0 with `setTargetAtTime` (time constant ≈ 120 ms, audibly ≈
500 ms tail) on release, then stop and disconnect the oscillators. No sustain
pedal, no portamento: overlap comes from holding multiple nodes and from
release tails bleeding into the next press.

**Silence is the rest state.** The `AudioContext` is created suspended and
resumed by the first press. When no node is held and all tails have decayed,
the page is silent. On `window` blur, release all active voices.

## Interaction

**Grid ↔ keyboard.** The playable surface is a 10-wide × 4-tall grid mapped
onto the physical key block:

| Row (top→bottom) | Keys | 5-exponent |
|---|---|---|
| digits | `1 2 3 4 5 6 7 8 9 0` | 5² |
| q-row | `q w e r t y u i o p` | 5¹ |
| a-row | `a s d f g h j k l ;` | 5⁰ |
| z-row | `z x c v b n m , . /` | 5⁻¹ |

Column index `i = 0…9` gives 3-exponent `i − 3`, so **F is the root** `1/1`,
and the a-row is a chain of fifths sounding pitch classes
Ab Eb Bb F C G D A E B. `z` is the bottom-left node.

**Keyboard.** Listen on `window` using `event.code` (physical position, layout
independent). Maintain a `Set` of held codes; ignore `event.repeat`; keydown
starts a voice, keyup releases it. Unmapped keys do nothing (never throw,
never scold).

**Pointer/touch.** `pointerdown` on a node starts its voice; `pointerup` /
`pointercancel` / `pointerleave` of that pointer releases it. Multi-touch =
one voice per active pointer. `touch-action: none` on the grid. No
position-within-node mapping — a node is a discrete trigger, so no
`getBoundingClientRect` arithmetic exists anywhere.

**Both inputs are equal citizens** and can be used simultaneously (keys held
while tapping).

## The opening screen

A dark page filled edge-to-edge with the grid: forty rounded key-cap nodes,
each glowing its own hue, each labelled with its keyboard character (`Z`, `A`,
`Q`, `1`, `;` …). Nothing else — no title text, no instructions, no button.
The invitation is that it unmistakably *looks like a giant colorful keyboard*:
key-caps ask to be pressed, and the labels silently say "your keyboard works
here too." Cursor: `pointer` over nodes.

**The key labels are the only visible text on the page.** The required `<h1>`
and nav landmark exist but are visually hidden.

## Visual design

- **Layout.** Grid fills the viewport width, vertically centered, on a
  near-black background (`oklch(18% 0.01 260)`). Each row upward is
  translated **left by ⅓ of a node width**, mirroring the physical keyboard
  stagger (and, happily, slanting the lattice). No responsive variants: on a
  phone the same grid fills the width; landscape is the intended phone
  orientation.
- **Color = pitch class.** Hue in OKLCH: `hue = 25° + 360° · pc`, where
  `pc = frac(log2(ratio))` (so the root F sits at 25°). Rest state:
  `oklch(75% 0.12 hue)` fill, label in `oklch(28% 0.02 hue)`. Lightness and
  chroma are identical across nodes — hue is the only varying channel, so
  equal pitch-class distances look equally different. The fifths-ordered
  a-row cycles the hue wheel in ~210° steps, making the structure visible.
- **Active state.** While sounding: lightness → 88%, chroma → 0.16, scale →
  1.06, transitioned over the 15 ms attack; on release, fade back over
  ~500 ms so the visual tail matches the audio tail.
- **Type.** Single sans-serif system stack for the key labels, uppercase,
  sized to the node.
- **Motion.** Only the active-state transitions above. No idle animation.

## Expressiveness

- The a-row alone is a circle-of-fifths melody instrument; walking it fast
  with the 500 ms release leaves trails of passing harmony.
- Vertical moves add 5-limit color: `f`+`g`+`r` is a just major triad,
  `f`+`g`+`v` the minor; the digit row (5²) is alien territory.
- Chords are the core mechanic: any combination of touches/keys sounds
  together, and every combination is a *just* chord — distant combinations
  shimmer, near ones lock.
- Two players concretely differ: one noodles fifths along the home row,
  another holds three-node triads and swaps one finger at a time, a third
  mashes clusters across rows. Ten scattered gestures trivially produce well
  over three distinguishable voices.

## Non-goals and rejected ideas

- No drone: silence when idle is a politeness requirement; overlap replaces it.
- No octave controls and no range management: Shepard tones make ×2 identity,
  which deletes the range-escape problem rather than solving it.
- No position-as-frequency layout (log-pitch ruler with sliding button rows):
  a good *different* instrument, dropped for UI-motion scope.
- No configurable lattice generators: fixed 3 × 5; presets cut for scope.
- No 7- or 11-limit axes: visualization cost outruns tonight's budget.
- No sustain/pin toggle: release tails and polyphony cover chord-building.
- No portamento: nodes are discrete triggers, not a continuous surface.
- No mitigation for keyboard ghosting on membrane keyboards: unfixable in
  software; 2–3-key chords work everywhere.
- No `AudioWorklet`: the graph is plain standard nodes, testable by the fake.
- No tuning-theory copy, no instructions, no self-explanation anywhere.

## Spec-test implications

None bent. For the record: pointer and keypress each start a real voice;
distinct nodes produce distinct spectra (distinguishable-voices tests pass by
construction); keyboard handlers live on `window`; no rect division exists, so
the jsdom zero-rect trap is structurally avoided; the grid container carries
`data-instrument`; no audio files, no `<audio>`/`<video>`; none of the
forbidden words appear in copy, and no identifier is named `score`. Invariants
(nav, single `<h1>`, lang, title, meta description) are kept with the h1 and
nav visually hidden; there are no images.

## Open questions

- The page needs a `<title>`, hidden `<h1>`, and meta description, i.e. the
  instrument needs a name. Undecided; the description must stay in the
  instrument's own voice (name + a neutral phrase, not an explanation).
- Exact compressor settings if defaults pump audibly under ten voices.
- Whether punctuation labels (`;` `,` `.` `/`) read at small sizes; fallback
  is styling them slightly larger, not removing them.
- Exact hue anchor (25°) is a taste call; adjust freely if the root color
  displeases.
