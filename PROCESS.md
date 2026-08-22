# Process overview

A wrapping Tonnetz of hexagonal caps, each a pitch class of the 12-TET torus
sounding an octaveless Shepard tone — playable by touch, drag, mouse or the
matching QWERTY block. `DESIGN.md` is the implementation authority; this is a
map to how the build actually went, not a restatement of it.

## The moments that mattered

1. **A block-scoped `function` broke the spec suite in a way a real browser
   never would.** The checkpoint-1 temporary trigger passed every check
   locally, then threw `TypeError: r(...).map is not a function` under
   `pnpm check` — a name a local helper picked collided with an unrelated
   top-level binding the minifier gave the same letter, because the test
   harness runs the built script as a classic (sloppy-mode) script, where
   Annex B hoists a block-scoped `function` in a way a real, strict-mode
   `type="module"` script never would. Fixing the one instance was the easy
   part; the harder call was writing the rule into `CLAUDE.md` — a `const`
   arrow function has none of that hoisting behaviour — so the *next* script
   wouldn't rediscover it the same way. It didn't: two scripts and one
   full rewrite later (`main.ts`'s keyboard/pointer wiring, then
   `shepard.ts`), the same class of bug never came back.
   [`af14ae6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/af14ae6)

2. **Portrait mode measured "correct" on paper and rendered mostly empty.**
   The CSS in the design brief sized the grid from the viewport's own `vw`/
   `vh`, which is exactly wrong once the stage is rotated 90° — the axis that
   should size the rows is now the *other* physical dimension. I only found
   this by actually resizing a browser to a phone aspect ratio and reading
   `getBoundingClientRect()`, not by re-reading the CSS: the box was the
   right size, its *content* wasn't. Fixing the axis swap then exposed a
   second bug — `box-sizing: content-box` meant the stage's padding added to,
   rather than ate into, its explicit portrait width — that only showed up
   because I re-measured after the first fix instead of trusting it.
   [`db9d044`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/db9d044)

3. **A second page quietly broke the first page's tests.** Adding
   `shepard.html` — which imports `instrument.ts` and `tuning.ts`, same as
   the main page — made Vite factor that shared code into its own chunk, so
   the main page's script became `import {...} from "./chunk.js"`, which the
   jsdom-based test harness can't execute. The obvious fix was concatenating
   both scripts' text into one scope; I didn't, because both were
   independently minified and could easily have picked the same single-letter
   name for two different things — exactly the bug from moment 1, in a new
   shape. Instead `instrument-page.ts` now wraps the shared chunk in its own
   closure and destructures its exports into the entry's scope, so the two
   scripts' identifiers can never collide. `pnpm check` going from 8 failures
   back to green, with the fix living in test infrastructure rather than in
   either page, is what told me it was the right layer to fix it at.
   [`01ac973`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/01ac973)

## Before you ship

`reflections/crit-4.md` is the repo owner's alone.
