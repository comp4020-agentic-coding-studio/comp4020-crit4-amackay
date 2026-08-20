# An instrument — agent harness

A COMP4020 prototype: turn the browser into a musical instrument a stranger can
pick up and play. Static site, Astro, deployed to GitHub Pages. **The deployed
site is what gets judged** — not this repo, and not "it works on my machine".

This week's spec is published on the course site; read it there rather than
trusting a paraphrase here. `spec/README.md` says how the checks in this repo
relate to it.

## The thing this harness cannot do: hear

The agent can build a synth and cannot tell whether it sounds good. That is the
whole shape of the week, and it changes how to work:

- **A green suite says nothing about the sound.** Tests here can assert that a
  gesture reaches the audio graph, that a context exists, that nothing sounds
  before the first gesture. They cannot assert timbre, tuning, latency, or
  whether a gesture is expressive rather than exhausting.
- **So ask for a listen.** When a change affects what the instrument sounds
  like, stop and say so explicitly, rather than reporting the tests green and
  moving on. A listen is the only sensor for the half of the spec that matters,
  and it costs a sentence to request.
- **Keep the sound-producing layer behind a seam.** Anything worth testing —
  note choice, scale, timing, gesture-to-parameter mapping — belongs in plain
  functions that take numbers and return numbers, with the `AudioNode` calls at
  the edge. Logic bugs and audio-graph bugs must never be confusable.

## Web Audio facts to build against

- **The context starts suspended.** Browsers' autoplay policy means no sound
  until a user gesture, so `AudioContext.resume()` belongs on the first pointer
  or key event, not on load. The spec wants the opening screen to invite the
  first sound; that first touch is also what unlocks audio.
- **One `AudioContext` for the page.** Creating one per note exhausts the
  browser's limit and adds latency.
- **Never ramp a gain to exactly zero on an exponential ramp**, and never step a
  gain instantly — both click audibly. Use `setTargetAtTime` or a linear ramp to
  a small epsilon.
- **Mouse, keyboard and touch all have to work** (spec line). Pointer events
  cover mouse and touch together; the keyboard path is separate work, not a
  freebie.

## The stack: Astro, base path and all

Converted from the template by the course `stack` skill. `astro.config.ts` sets
`base: "/comp4020-crit4-amackay"` because Pages serves the site under the repo
name, and the dev server serves under that base too — so a path bug reproduces
locally instead of only on the live URL. **`http://localhost:4321/` returning
404 is correct**; the site is at `/comp4020-crit4-amackay/`.

- **Internal links and asset paths must be relative, or prefixed with
  `import.meta.env.BASE_URL`.** A root-absolute `/foo.png` looks fine locally
  and 404s on Pages.
- **`BASE_URL` carries no trailing slash here**, because the configured `base`
  has none. Joining it naively yields `.../comp4020-crit4-amackaycard.png`.
  Normalise before concatenating; `src/layouts/Layout.astro` shows the shape.
- **The invariants check the card is *present*, not that it *resolves*.** A
  broken card URL ships green. Read the built `dist/index.html` head, and look
  at the deployed one.
- **`public/` is copied verbatim and is fetch-by-URL only** — nothing can import
  from it. Anything the page needs before its first paint (audio sample data, a
  scale table) belongs in `src/`, where it can be imported synchronously.
  jsdom has no origin to resolve a relative `fetch` against, so a `public/`
  dependency also puts that code out of reach of the spec tests.
- **Commit `pnpm-lock.yaml` with any dependency change.** CI installs with
  `--frozen-lockfile` and fails otherwise.
- **`pnpm typecheck` is `astro check`**, and `tsconfig.json` now includes
  `**/*` — `spec/` and `scripts/` are typechecked along with the site.

## How to work in here

- Keep `pnpm dev` running and **visit the base path**, not the root.
- Run `pnpm check` before pushing: `astro check`, then `astro build`, then the
  spec suite. It is most of what CI runs, in seconds.
- Open the page in a browser and look at it — the `agent-browser` CLI works for
  this. The rendered page is the truth; a mental model of it isn't. For this
  week, add: the *sounding* page is the truth, and no tool in this repo can hear
  it.
- When a check fails, read the output before changing anything. The failure
  message names the file, the line, or the contract.
- **Never commit a red build, typecheck, or a test that used to pass.** The one
  exception: a spec test written before the thing it describes is *meant* to be
  red. `spec/crit-4.test.ts` was committed failing on purpose — red-to-green is
  the record of the work.
- Paths written anywhere in this repo are relative to the repo root. Absolute
  paths tie a repo that goes public to one machine.

## The checks

CI runs on push, but **only once the repo is public** — private-phase runs are
skipped, so `pnpm check` locally is the real loop all week. The repo goes public
at the cutoff, and that flip is what triggers the first real CI run: ship with
enough time for it to finish.

- **typecheck / build** — `astro check` then `astro build`. A build failure
  means the deployed site is broken or stale; nothing else matters until it is
  green.
- **spec** — `spec/invariants.test.ts` asserts what is true of any good website
  (a nav landmark, one `h1`, a language, a title, a description, an `og:image`,
  a mobile viewport, alt text), against the **built** site. Any `spec/*.test.ts`
  runs alongside it; this week's contract lives in `spec/crit-4.test.ts`.
- **links** — CI serves `dist/` under the base path via `astro preview` and
  crawls it. External links are skipped, so someone else's outage can't redden
  a build. The old `linkinator ./dist` one-liner no longer matches CI.
- **evidence** — `pnpm check:evidence` resolves the deliverable live from the
  repo name and the course API, checks `PROCESS.md`'s commit citations point at
  real commits, and requires the reflection at exactly
  **`reflections/crit-4.md`**. Any other filename fails.
- **secrets** — the repo is scanned for committed credentials, and
  `.githooks/pre-commit` blocks key-shaped strings before they are pushed. The
  course API key lives in `.claude/`, which is gitignored; keep it there.

Nothing here measures accessibility or performance. Nothing here measures sound.

## Process is a spec line

"The repo shows the process" is in this week's published spec, so it is part of
the contract, not decoration:

- **Commit as you go.** Small commits that grew with the work are the record;
  one dump before the cutoff is not.
- **`PROCESS.md`** is a short reading guide: what was built, the moments that
  mattered, each citing a commit or range. `check:evidence` verifies the
  citations resolve.
- **`reflections/crit-4.md`** is written by the repo's owner, alone. The agent
  never drafts, edits, pads, or starts it. If it is missing near the cutoff, say
  so — that is the whole intervention.
- **This file is process evidence too.** It is read as part of how the work was
  directed, so keep it honest and current.

## This file is yours

A starting point, not a rulebook. When something bites — a convention the work
has to hold to, a sensor that keeps catching you out, a fact about Web Audio or
Astro that is easy to get wrong — write it down here. Growing this file is the
work.
