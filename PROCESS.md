# Process overview

## What I built

A wrapping Tonnetz of hexagonal caps, each a pitch class of the 12-TET torus
sounding an octaveless Shepard tone — played by touch, drag, mouse or the
matching QWERTY block. The geometry is the constraint: every pair a third or a
fifth, every triple a major or minor triad, with no clamp in the code.
`DESIGN.md` is the implementation authority; this file is a map to the history.

## The moments that mattered

1. **A working instrument was thrown away mid-week.** The design was done in a
   chat with no repo access — a brief out, decisions back, both committed
   ([`14c54b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/14c54b5)).
   The first round's 9×4 just-intonation grid was built and green when a second
   round returned a different instrument entirely
   ([`8576542`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/8576542)).

   > Time for a complete change of direction! This deserves a new branch, in
   > case it doesn't work out.

   Its geometry was rechecked numerically before any implementation — press
   radius, Voronoi cells, the three-caps-per-touch claim
   ([`eb0c157`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/eb0c157))
   — so the decision to discard working code rested on the lattice's own
   numbers.
   [`563a6cd...b394822`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/compare/563a6cd...b394822)

2. **A phone in "Request Desktop Site" mode rendered the instrument
   miniature**, and `pnpm check` was green throughout. Three uniform
   multipliers — a meta rewrite, CSS `zoom`, then `transform: scale()` — each
   traded too small for too big. What broke the loop was evidence, not another
   attempt: an overlay printing raw viewport numbers into a screenshot from
   the reporting device
   ([`f56cdb6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/commit/f56cdb6)),
   and a model switch.

   > Sonnet seems to be having some trouble with this one, so I've just
   > switched models to Opus. Hi Opus! What do you think of this one?

   The numbers showed a wrong axis, not a wrong scale: the substituted layout
   viewport is landscape-shaped on a portrait phone, so `100vmin` sized the
   whole fit from a bogus number. Sizing from `visualViewport` fixed it, and
   the overlay confirmed 29.5 CSS px per twelfth on that phone against an
   ordinary visit's 29.6.
   [`6033c10...9364982`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-amackay/compare/6033c10...9364982)
