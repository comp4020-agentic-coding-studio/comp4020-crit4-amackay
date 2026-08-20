# An instrument — agent harness

A COMP4020 prototype: turn the browser into a musical instrument a stranger can
pick up and play. Static site, Astro, deployed to GitHub Pages. **The deployed
site is what gets judged** — not this repo.

The spec is published on the course site. Read it there; a paraphrase here would
be one more thing to keep true. `spec/README.md` says how the checks relate to
it.

## The thing this harness cannot do: hear

- **A green suite says nothing about the sound.** The tests reach whether a
  gesture reaches the audio graph, not timbre, tuning, latency, or whether a
  gesture is expressive rather than exhausting.
- **So ask for a listen.** When a change affects what the instrument sounds
  like, say so and stop, rather than reporting the tests green and moving on.
- **Keep the sound behind a seam.** Note choice, scale, timing,
  gesture-to-parameter mapping: plain functions taking numbers and returning
  numbers, with the `AudioNode` calls at the edge. Logic bugs and audio-graph
  bugs must never be confusable.

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

## Working rules

- **Never commit a red build, typecheck, or a test that used to pass.** The one
  exception: a spec test written before the thing it describes is *meant* to be
  red. `spec/crit-4.test.ts` was committed failing on purpose — red-to-green is
  the record of the work.
- Run `pnpm check` before pushing, and open the page in a browser (the
  `agent-browser` CLI works). The rendered page is the truth; for this week, the
  *sounding* page is, and nothing here can hear it.
- Paths written anywhere in this repo are relative to the repo root. Absolute
  paths tie a public repo to one machine.
- **Commit as you go** — "the repo shows the process" is a spec line, so the
  history is part of the contract. `PROCESS.md` is a short reading guide citing
  commits, not an essay.
- **`reflections/crit-4.md` is the repo owner's alone.** Never draft, edit, pad
  or start it. If it is missing near the cutoff, say so — that is the whole
  intervention.

## The checks

`pnpm check` is the loop; read the failure, which names the contract. Four
things it won't tell you:

- **CI runs only once the repo is public.** The flip at the cutoff triggers the
  first real run, so ship with time for it to finish.
- **`pnpm check:evidence`** requires the reflection at exactly
  `reflections/crit-4.md` and `PROCESS.md`'s commit citations to resolve.
- **The links check** serves `dist/` under the base path via `astro preview` and
  crawls that; the old `linkinator ./dist` one-liner no longer matches CI.
- **`.githooks/pre-commit`** blocks key-shaped strings before they are pushed.
  The course API key lives in gitignored `.claude/`; keep it there.

Nothing here measures accessibility, performance, or sound.

## This file is yours

When something bites — a convention the work has to hold to, a sensor that keeps
catching you out, a fact about Web Audio or Astro that is easy to get wrong —
write it down here. Growing this file is the work.
