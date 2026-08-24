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
- **A synthetic event grants no user activation, and the page now declines to
  light or sound anything that cannot be heard** (`Instrument.canSound()`), so
  every browser probe that drives the page with `dispatchEvent` sees a dead
  lattice until it says otherwise. One `Object.defineProperty(navigator,
  "userActivation", …)` fixes it — `scripts/card-pose.js` carries the shape.
  This bit the share card first: `pnpm card` quietly shot an unlit lattice.
- **An audio-unlock bug will not reproduce on the dev server.** Chrome's
  autoplay policy is per origin and softens with the Media Engagement Index,
  which a week of play-testing drives sky-high on `localhost` — so its
  `AudioContext` starts without any activation at all, while a freshly
  deployed origin demands it. Test unlock behaviour against the deployed URL,
  or on the dev server in an incognito window, and treat "works locally" as no
  evidence whatsoever. `chrome://media-engagement/` shows the scores.
- **Headless Chromium has no audio device, so its `AudioContext` never leaves
  `suspended`** — `resume()` is called, the promise does not settle, and the
  clock stays frozen at 0. Since `instrument.ts` holds a voice back until the
  clock runs, that means **no oscillator is ever created headless**: the DOM
  half of a browser probe still reports (`scripts/check-voice-stacking.js`
  counts lit caps fine), the audio half now reads zero and proves nothing. The
  fake context in `spec/support/fake-audio.ts` resumes synchronously, which is
  why the spec suite is unaffected — and is load-bearing, not incidental.
- **An `AudioParam` runs every event still in its timeline, including ones
  scheduled later than the one you just added.** Releasing a note inside its
  15 ms attack used to leave the attack's `linearRampToValueAtTime` sitting
  *after* the release's `setTargetAtTime`, so the ramp ran anyway, pulled the
  gain back to full and held it there until `oscillator.stop()` cut it — a
  note that hung on and ended in a click. Any release has to
  `cancelScheduledValues(now)` and pin the reached value with
  `setValueAtTime(gain.value, now)` first; `gain.value` does read the ramp
  mid-flight. `scripts/probe-release-clip.js` renders it offline either way.

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

- **Adding a second page would split Rollup's build and break the spec
  harness.** The site is one page, which is the only reason the built bundle
  has no imports left in it for the harness to choke on. Let a second page's
  script import the same module (e.g. `instrument.ts`) and Vite factors it
  into a shared chunk, leaving the page's own script starting
  `import {...} from "./chunk.js"` — which a classic-script `eval` can't run
  (see `spec/support/instrument-page.ts`'s header comment for why the harness
  needs classic-script eval at all). The harness used to carry an
  `inlineChunkImports` for exactly this, wrapping the chunk's body in an IIFE
  and destructuring its exports into the entry's scope; it was removed with
  the Shepard page. If a second page comes back, recover it from git history
  rather than rediscovering the problem — and note it only ever handled one
  level, not a chunk importing another chunk.
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

## Every pitch class is ~121 caps, and only a handful are on screen

The drawn window is 128 twelfths square so that no zoom step shows blank
canvas past the lattice's edge; the view shows at most ~57 of them. So each of
the twelve pitch classes has about 121 caps in the DOM and one to six of them
visible, and **anything that does real per-cap work in an event handler is
paying ~40x over the odds.** Refcounting the `.active` class over all 121 is
fine (a `classList` call is cheap, and a cap that scrolls in during a zoom has
to already be lit). Building a Web Animation per cap is not: a two-finger tap
sharing a triad built 363 of them in one `pointerdown` and blocked the main
thread for ~200 ms on a 6x-throttled CPU — long enough that the *second*
touch's caps lit late, its lift was handled late, and the notes hung on past
the finger. Filter by `onScreenCapsFor` (main.ts) first.

The measuring tool matters here: `dispatchEvent` cannot make two real touches,
and an unthrottled desktop shows none of this. `scripts/probe-two-finger-tap.mjs`
drives the page over CDP with `Input.dispatchTouchEvent` and
`Emulation.setCPUThrottlingRate`, and logs when each cap's class actually
changed against when the touch landed.

## User-facing prose is the complement of the artefact

Every string a user can reach: on-screen copy, labels, empty and error states,
the page description a link preview shows, alt text. Reading is not free, and
humans read far slower than this harness writes, so prose is not there to
describe the thing. It carries the remainder — what *this* reader, at *this*
moment, does not already have. A user looking at the interface has the
interface. Someone seeing a link preview has not opened it. Someone on a screen
reader cannot see it. One rule, three answers, which is why "don't say what
they can see" needs no exceptions bolted on: where the reader has nothing yet,
describing is the whole job.

- **Ask the owner what is already obvious, and record the answer.** Only
  someone who has watched a person use the thing knows what it conveys on its
  own, and that is not derivable from the code. So prose work starts with the
  question — *what does a user already get from the interface, without reading
  anything?* — and the answers go into the design document under a standing
  heading, one entry each, naming the mechanism that carries it or the
  user-test that found it. The next prose session then subtracts from a list
  instead of re-deriving it. Keep it honest in both directions: whoever built a
  thing is the worst-placed to judge what is obvious about it, so a conviction
  is not a finding, and any entry can be demoted by the first stranger who uses
  it.
- **Delete any sentence the reader could get by looking, or by one
  interaction.** Not shorten — delete. Add to the register above when a design
  change makes copy redundant, in the same commit that makes it so.
- **Duplication is the same defect it is in code, and the cost is drift, not
  bulk.** Copy that restates a fact the artefact owns goes quietly wrong when
  that fact changes. The remedy does not transfer, though: prose cannot factor
  a duplicate out, only delete it and let the source speak.
- **A specialist term has to pay the reader back.** Not "is it precise" — is
  the reader getting something they could not get otherwise, usually a name
  they can search when they want to know more. Write for someone with no
  background in the domain: the plain-words version wins even when it runs
  longer, and a term that survives that test is worth linking.
- **Link a term inline, at the first mention that raises the question.** A row
  of links at the end makes the reader go back and work out what each one
  referred to.
- **The artefact never justifies itself.** A sentence defending a design
  decision is rationale wearing user-facing clothes; it belongs in the design
  document, the process notes or a commit body. Test: would this sentence exist
  if the thing had simply always been this way? A section nominally *about* the
  thing is not exempt.
- **Brevity is not the measure — time to understanding is.** Spend words to
  save the reader effort; never spend the reader's effort to save yourself
  imprecision. Front-load for the same reason: the first sentence gets read,
  the fourth may not.
- **A section that exists asks to be filled.** Copy expands to the space it is
  given, and then the space is cited as evidence it was needed. An empty space
  is not a brief; size the space to the copy that earns its way in.

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
- **`astro check` typechecks `scripts/` as one global scope.** A `scripts/*.ts`
  file with no import or export is a *global* script to TS, so two of them
  sharing a top-level name (`pos`, `pc`, `total`) is a redeclaration error.
  End every standalone script with `export {};`.
- **A note name written in a comment is not evidence.** `pc(m, n)` is. A
  comment naming `(0,2)` as Gb (it is B) put the fundamental domain's corner
  one fifth out of place, and survived two re-derivations of the
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

`pnpm check` is the loop; read the failure, which names the contract. Six
things it won't tell you:

- **CI runs on every push now** — the repo is public and shipped, so the
  `!github.event.repository.private` gate that kept both jobs off during the
  private phase no longer holds anything back. A run is ~1m30s, and the deploy
  job publishes `dist/` to Pages and then verifies the live URL returns 200.
  Read the gate as history, not as the current state: assuming it still applied
  cost one session a wrong recommendation.
- **`pnpm check:evidence`** requires the reflection at exactly
  `reflections/crit-4.md`, `PROCESS.md`'s commit citations to resolve, and the
  share card not to be stale.
- **`pnpm card` refuses to shoot a card it cannot pose.** `card-pose.js`
  checks its own postconditions — the pressed chord lit and nothing else, the
  plate hidden, the hints off — and `make-card.sh` stops on them *before* the
  screenshot, so a broken pose leaves the good card in place instead of
  overwriting it. It also re-encodes on every run: the PNG's bytes differ even
  when the picture does not, so `git checkout public/card.png` rather than
  commit a no-op re-shoot.
- **The share card is a screenshot, so it has a sensor rather than a
  reminder.** `pnpm card` re-takes `public/card.png` — the built site at
  1200×630, title plate hidden, C-E-G-A held (`scripts/make-card.sh`, posed by
  `scripts/card-pose.js`) — and records a fingerprint of the page's CSS plus
  the playing surface's markup. `check:evidence` recomputes it, so a changed
  surface reddens the ship gate but not the inner `pnpm check` loop: regenerate
  once before shipping rather than committing a new PNG per tweak. Editing the
  About copy doesn't trip it; restyling the panel does, and that false positive
  costs one `pnpm card`. Needs `agent-browser` locally; CI only ever checks.
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
