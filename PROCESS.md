# Process overview

A wrapping Tonnetz of hexagonal caps, each a pitch class of the 12-TET torus
sounding an octaveless Shepard tone — playable by touch, drag, mouse or the
matching QWERTY block. `DESIGN.md` is the implementation authority; this is a
reading guide to the history, not a restatement of the design.

## Decisions, and what they replaced

- **A wrapping Tonnetz replaced a 9×4 grid of discrete keys.** The grid clamped
  which combinations could sound; the lattice makes the geometry itself the
  guarantee — every dyad a third or a fifth, every triad major or minor — with
  no clamp in the code. [`563a6cd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/563a6cd)
- **The view's coordinate system became the lattice's own**, rather than the
  viewport's, so the fit is one transform instead of per-axis special cases.
  [`a7aafe8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/a7aafe8),
  padding settled at 1.5 twelfths in [`e69aad6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/e69aad6)
- **Voices are refcounted by pitch class above `Instrument`**, so the torus's
  wrap — where two caps are the same pitch class — cannot double-trigger or
  strand a voice. [`2fd0537`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/2fd0537)
- **The title plate became the About panel**, one element in two states rather
  than a plate plus a dialog: the title reaches its place on the card by the
  plate growing around it, so the expand is a CSS transition and the `<h1>`
  never doubles.
  [`ada38bb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/ada38bb)
- **The card is sized to its copy, not the copy to the card**, replacing a
  height refitted by hand every time the words changed — one measurement, off
  the transition, because the copy is positioned out of flow and CSS cannot
  reach its height.
  [`1863d90`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/1863d90)
- **Geometry, tuning and synthesis are plain functions over numbers**, unit- and
  property-tested away from the DOM and the audio graph, per `CLAUDE.md`'s seam.
  [`f87ba1a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/f87ba1a)

## Three things that bit, and the rules they left behind

1. **A block-scoped `function` broke the spec suite in a way a real browser
   never would.** The checkpoint-1 temporary trigger passed locally, then threw
   `TypeError: r(...).map is not a function` under `pnpm check`: the harness
   runs the built script as a classic, sloppy-mode script, where Annex B hoists
   a `function` declared inside a block to top level — so two unrelated
   bindings the minifier gave the same letter clobbered each other. Real page
   scripts are strict ES modules and never see it. The fix was one line; the
   durable part was the `CLAUDE.md` rule (`const` arrow functions inside blocks
   in page scripts), and two scripts plus a full rewrite later the same class of
   bug did not return.
   [`af14ae6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/af14ae6)

2. **Portrait mode measured correct on paper and rendered mostly empty.** The
   grid was sized from the viewport's own `vw`/`vh`, which inverts once the
   stage is rotated 90° — the axis that should size the rows is the other
   physical dimension. The box was the right size; its content was not, so only
   reading `getBoundingClientRect()` at a phone aspect ratio found it. The fix
   exposed a second bug behind it — `box-sizing: content-box` made the stage's
   padding add to its explicit portrait width instead of eating into it —
   visible only on re-measuring rather than trusting the first fix.
   [`db9d044`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/db9d044)

3. **A second page quietly broke the first page's tests.** Adding
   `shepard.html`, which imports the same `instrument.ts` and `tuning.ts`, made
   Vite factor the shared code into its own chunk; the main page's script became
   `import {...} from "./chunk.js"`, which the jsdom harness cannot execute.
   Concatenating both scripts into one scope was rejected as moment 1 in a new
   shape — two independently minified chunks can pick the same single-letter
   name. `instrument-page.ts` instead wrapped the chunk in its own closure and
   destructured its exports into the entry's scope, so the identifiers could
   not collide. The fix belonged to the test infrastructure, not to either
   page, and was removed along with the second page once the site went back to
   one. [`01ac973`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/01ac973)

## What the checks cannot reach

`pnpm check` proves a gesture reaches the audio graph. It says nothing about
timbre, tuning, latency, or whether the instrument is worth playing — those are
decided by listening, and by the live site at the two marked viewports.
