# An instrument — agent harness

A COMP4020 prototype: turn the browser into a musical instrument a stranger can
pick up and play. Static site, Astro, deployed to GitHub Pages. **The deployed
site is what gets judged** — not this repo.

The spec is published on the course site. Read it there; a paraphrase here would
be one more thing to keep true. `spec/README.md` says how the checks relate to
it.

**Read `DESIGN.md` before changing anything.** It is the implementation
authority — what the instrument is, how it sounds, and where the work stops for
review. This file governs process and wins where the two disagree; they should
not disagree.

## Two things this harness cannot do: hear, and measure

- **A green suite says nothing about the sound.** The tests reach whether a
  gesture reaches the audio graph, not timbre, tuning, latency, or whether a
  gesture is expressive rather than exhausting.
- **So ask for a listen.** When a change affects what the instrument sounds
  like, say so and stop, rather than reporting the tests green and moving on.
- **Keep the sound behind a seam.** Note choice, scale, timing,
  gesture-to-parameter mapping: plain functions taking numbers and returning
  numbers, with the `AudioNode` calls at the edge. Logic bugs and audio-graph
  bugs must never be confusable.
- **jsdom has no layout**, so every `getBoundingClientRect()` is zero-sized and
  `elementFromPoint` is useless. Any client-coordinate arithmetic divides by
  zero, and the `NaN` it produces throws the moment it reaches an `AudioParam`
  in a real browser. A position-mapped instrument therefore needs a second,
  element-based path that a test can drive, and a `rect.width === 0` guard in
  front of the coordinate one — see DESIGN.md "Two hit-test paths".
- **The same seam answers both.** Geometry as plain functions over numbers gets
  exhaustive unit tests and property tests; the page wiring gets the spec
  tests. Never make the spec suite the only thing proving the geometry.

## The stack: Astro, base path and all

`astro.config.ts` sets `base: "/comp4020-crit4-amackay"`, and the dev server
serves under it too, so a path bug reproduces locally instead of only on the
live URL. **`http://localhost:4321/` returning 404 is correct**; the site is at
`/comp4020-crit4-amackay/`.

- **Links and asset paths must be relative, or prefixed with
  `import.meta.env.BASE_URL`.** A root-absolute `/foo.png` looks fine locally
  and 404s on Pages.
- **`BASE_URL` carries no trailing slash here.** Joining it naively yields
  `.../comp4020-crit4-amackaycard.png`; `src/layouts/Layout.astro` shows the
  shape that doesn't.
- **The invariants check the card is *present*, not that it *resolves*.** A
  broken card URL ships green — read the built head.
- **`public/` is fetch-by-URL only**, and jsdom has no origin to resolve a
  relative `fetch` against, so anything in there is also out of reach of the
  spec tests. Data the page needs belongs in `src/`, imported.
- **Commit `pnpm-lock.yaml` with any dependency change**; CI installs
  `--frozen-lockfile`.

## Two build quirks that break the spec harness, not the design

- **A second page sharing lib code splits Rollup's build.** Once more than one
  page's script imports the same module (e.g. `instrument.ts`), Vite factors
  it into a shared chunk, and the page's own script becomes
  `import {...} from "./chunk.js"` — which a classic-script `eval` can't run
  (see `spec/support/instrument-page.ts`'s header comment for why the harness
  needs classic-script eval at all). `inlineChunkImports` there resolves one
  level of this by wrapping the chunk's body in an IIFE and destructuring its
  exports into the entry's scope, rather than flattening both into one shared
  scope where two independently-minified chunks could collide on a reused
  single-letter name. A third page sharing the same lib code should just work
  through it; a chunk importing another chunk (two levels deep) isn't handled.
- **A block-scoped `function` inside a page script can silently misbehave
  under that same classic-script `eval`.** Annex B hoists a `function`
  declared inside an `if`/block to the nearest function/global scope in
  sloppy mode — invisible in a real browser (page scripts run as real,
  strict-by-default ES modules there), but live once jsdom evals the built,
  minified script as a classic script: two unrelated top-level bindings the
  minifier happened to give the same single-letter name can clobber each
  other. Bit `main.ts` twice before the fix took: use `const` arrow functions
  for anything declared inside a block in a page script, never a `function`
  declaration.

## Working rules

- **Never commit a red build, typecheck, or a test that used to pass.** The one
  exception: a spec test written before the thing it describes is *meant* to be
  red. `spec/crit-4.test.ts` was committed failing on purpose — red-to-green is
  the record of the work.
- **A spec test encodes the spec, not the artefact.** When the artefact changes
  identity, a spec test may need editing — but only where it reached for a
  detail of the old design (a particular `data-note`, a particular cap), never
  to soften what the spec asks. Change it in its own commit, say in the body
  which line of the spec it still serves, and never let the edit and the
  feature that makes it pass land together.
- **Redesigns land atomically.** A page swap that touches markup, script and
  spec codes at once goes in one commit rather than a red sequence; do the
  provable parts (geometry, tuning, refcounting) as green commits first so the
  atomic one is as small as it can be.
- Run `pnpm check` before pushing, and open the page in a browser (the
  `agent-browser` CLI works). The rendered page is the truth; for this week, the
  *sounding* page is, and nothing here can hear it.
- **Mute the browser before testing with `agent-browser`.** Headless Chromium
  still plays real audio through the host machine's speakers — pass
  `--args "--mute-audio"` (or set `AGENT_BROWSER_ARGS=--mute-audio`) before
  opening any page here, since any of them can reach `Instrument.noteOn`.
- **A note name written in a comment is not evidence.** `pc(m, n)` is. A
  comment naming `(0,2)` as Gb (it is B) put the debug fundamental domain's
  corner one fifth out of place, and survived two re-derivations of the
  transform because each one re-read the comment instead of re-evaluating the
  function. Same rule for intervals and neighbours: evaluate, don't quote.
- Paths written anywhere in this repo are relative to the repo root. Absolute
  paths tie a public repo to one machine.
- **Commit as you go** — "the repo shows the process" is a spec line, so the
  history is part of the contract. `PROCESS.md` is a short reading guide citing
  commits, not an essay.
- **`reflections/crit-4.md` is the repo owner's alone.** Never draft, edit, pad
  or start it. If it is missing near the cutoff, say so — that is the whole
  intervention.

## The checks

`pnpm check` is the loop; read the failure, which names the contract. Five
things it won't tell you:

- **CI runs only once the repo is public.** The flip at the cutoff triggers the
  first real run, so ship with time for it to finish.
- **`pnpm check:evidence`** requires the reflection at exactly
  `reflections/crit-4.md` and `PROCESS.md`'s commit citations to resolve.
- **The links check** serves `dist/` under the base path via `astro preview` and
  crawls that; the old `linkinator ./dist` one-liner no longer matches CI.
- **`.githooks/pre-commit`** blocks key-shaped strings before they are pushed.
  The course API key lives in gitignored `.claude/`; keep it there.
- **Nothing here renders at the marked sizes.** The site is judged live in
  Chrome at exactly **1920×1080** and **390×844**, both fully marked. Check
  both in the device toolbar; the phone one is where a size-dependent design
  breaks.

Nothing here measures accessibility, performance, or sound.

## This file is yours

When something bites — a convention the work has to hold to, a sensor that keeps
catching you out, a fact about Web Audio or Astro that is easy to get wrong —
write it down here. Growing this file is the work.
