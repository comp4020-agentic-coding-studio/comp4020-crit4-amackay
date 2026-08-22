# Touch-Tonnetz

A COMP4020 prototype: the browser as a musical instrument a stranger can pick
up and play. One fundamental domain of the 12-TET pitch-class torus, drawn as a
Tonnetz that wraps on both axes and keeps going past the edges. Every pitch
class is a hexagonal cap; a touch is a disk that presses every cap it overlaps,
so one cap sounds a note, two a dyad, three a triad — and the geometry, not a
clamp, is what guarantees every dyad is a third or a fifth and every triad is
major or minor. Mouse, touch and keyboard all play it.

**The deployed site is the deliverable**, assessed live in Chrome at two fixed
viewports — see the course
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#marking-environment).

## Where things are

- **`DESIGN.md`** — the implementation authority: what the instrument is, how
  the lattice and the sound work, and where the work stops. Read it first.
- **`CLAUDE.md`** — how to work in this repo. Governs process; `DESIGN.md`
  governs the artefact.
- **`PROCESS.md`** — the process overview, citing commits.
- **`spec/`** — the published spec turned into tests (`crit-4.test.ts`), plus
  the template's shipped invariants and a note on how the checks relate to the
  spec.
- **`src/lib/`** — the geometry, tuning and synthesis as plain functions over
  numbers, unit-tested away from the DOM and the audio graph.
- **`scripts/`** — one-off derivations and independent numeric checks. On the
  record, out of the contract: no tests, no maintenance.

## Running it

```sh
mise install         # the tested Node and pnpm versions
pnpm install
pnpm dev             # dev server — note the site is served under the base path,
                     # at /comp4020-crit4-amackay/, so / returning 404 is correct
pnpm check           # typecheck, build, and the full test suite
pnpm check:evidence  # the process-evidence check CI runs before shipping
pnpm build           # produce dist/, which is what gets deployed
```

`pnpm check` cannot hear anything. It reaches whether a gesture reaches the
audio graph, never timbre, tuning, latency or whether the instrument is worth
playing — so a green suite is not evidence about the sound.

## CI and Pages

The repo starts private and both CI jobs are gated on it being public, so
`pnpm check` is the feedback loop until then. The course's `/ship` skill flips
it public, turns on Pages and dispatches the deploy; from that point every push
to `main` builds, deploys and checks the live URL returns 200.
