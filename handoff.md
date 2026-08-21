# C4 "An instrument" — design handoff

You are helping design a prototype for a university studio course. The build
happens elsewhere (in Claude Code, against the repo); your job is to brainstorm
and land the **design**, then hand it back as a written document.

You have no access to the repo. Everything you need is below.

---

## 1. The deliverable

**COMP4020 Agentic Coding Studio, Crit 4: "An instrument."** A static site,
deployed to GitHub Pages. Due Wed 26 Aug 2026, 07:00 Canberra time.

### The brief (the open half)

> Turn the browser into a musical instrument — something a stranger can pick up
> and play.

Interpret *instrument* as broadly as you like: a theremin driven by the mouse, a
drum machine, a step sequencer, wind chimes that never repeat, a keyboard that
plays chords — if a person acts and the page sounds, it counts. The Web Audio
API does the synthesis, it's all client-side, and the whole thing ships straight
to GitHub Pages.

The building blocks are few: an `OscillatorNode` or an `AudioBufferSourceNode`
through a `GainNode`, all hung off one `AudioContext`, driven by pointer or
keyboard events. The context starts suspended until a user gesture resumes it
(the browser autoplay policy), so nothing sounds before the player's first tap.

### The spec (the fixed half — the contract)

1. deployed and live at its public GitHub Pages URL by the cutoff
2. **the browser is the instrument** — sound is made live in the page by the
   player, not played back
3. **it is expressive**: the player's choices shape what they hear, and two
   players sound different
4. **a stranger can play it uninstructed** — the opening screen invites the
   first sound
5. **playable with whatever is at hand** — mouse, keyboard or touch
6. **there is no way to play it wrong** — no score, no fail state
7. the starter's invariant checks pass
8. the repo shows the process
9. you can account for how you directed, grounded and corrected the work

### How it gets judged

**The crit opens cold: a pod of peers plays the instrument before the author
says a word.** Only afterwards is there discussion and explanation. So the
opening screen has to do all the inviting by itself — no instructions, no
tutorial, no "click here to begin" apology. Latency, feel, and whether a gesture
is expressive or merely exhausting are all judged by ear, in the room.

This is the design problem: **the first five seconds, unaccompanied.**

---

## 2. What already exists

Nothing but the starter page — a heading and a paragraph. No instrument, no
sound, no visual design. The concept is wide open.

The technical shell is done and green:

- **Astro 7**, static output, TypeScript strict, deployed to GitHub Pages.
- Site served under a **base path** (`/comp4020-crit4-amackay/`), which the code
  already handles.
- **Vitest + jsdom** for the test suite. No linter.
- One page (`index.astro`) with a shared layout, one global stylesheet.
- Everything is client-side. No server, no API, no build-time data.

---

## 3. Constraints the design must respect

Some of these are the spec; some are tests already committed against it. **The
tests are ours and can be changed** — but each one was written to hold a spec
line, so changing one is a deliberate decision to record, not a convenience.

### Sound must be synthesised, not played back

No audio files ship — the test suite fails if any `.mp3/.wav/.ogg/.m4a/.aac/
.flac/.opus/.webm` lands in the build, or if the page contains an `<audio>` or
`<video>` element. A sample-based design is only viable if the samples are
*generated in the page* (filling an `AudioBuffer` with synthesised or
noise-derived data), not fetched as files. Worth knowing: convincing percussion
is very achievable this way (filtered noise bursts, pitched sine drops).

### Silence until the player acts

Nothing may sound before the first gesture, and the `AudioContext` must be
resumed *by* that gesture. Design implication: the opening screen is silent, so
**it has to invite by looking inviting**, not by sounding.

### Both pointer and keyboard must make sound

The spec says "mouse, keyboard **or** touch". The committed tests are stricter:
they require a pointer gesture *and* a keypress to each produce a voice. That
was a deliberate reading — an instrument playable by only one input is a poorer
instrument — but if the design has a strong reason to be pointer-only, say so
explicitly in the handback and the test gets revisited on the record.

Touch comes free with pointer events, but the CSS must set `touch-action` on the
playable surface or dragging scrolls the page instead of playing it. So: the
design should work under a finger on a phone, not just a mouse on a laptop.

### Two players must sound different

Tested twice over: two distant gestures must produce different sound, and ten
scattered gestures must yield at least three distinguishable voices. A design
where every interaction produces the identical blip fails this. **The parameter
space has to be genuinely playable, not decorative.**

### No way to play it wrong

No score, no fail state, no rejected input. Mashing keys, dragging off the edge,
releasing without pressing — none of it may throw or scold. Note a copy
constraint that follows: the shipped page must not contain the words *score*,
*game over*, *you lose*, *wrong note*, *try again*, *streak*, or *high score*.
(This is a plain text search over the built HTML, so it also catches a variable
named `score` in the inlined script — a naming constraint as much as a copy one.)

### The playable surface carries `data-instrument`

The tests hold the instrument by this attribute. Everything else about the
markup is free.

### Accessibility and the invariants

Every page must keep a nav landmark, exactly one `<h1>`, a language, a title, a
meta description, and alt text on images — even if the design wants a bare
full-bleed canvas. Those two elements can be visually hidden but must exist.
Nothing measures accessibility beyond that, but a design that is *only* playable
by fine mouse gestures is worth questioning on its own terms.

### The artifact explains nothing about itself

Design rationale, process narrative, and "why I built it this way" do not appear
in the deliverable. Site copy is only ever the instrument's own voice. Test for
any sentence: would it exist if the thing had simply always been this way?

---

## 4. Testability notes worth designing around

The test suite drives the **built** page inside jsdom with a fake Web Audio API.
Two consequences shape the architecture:

- **jsdom performs no layout**, so `getBoundingClientRect()` returns all zeroes.
  A design that maps pointer position to pitch by dividing by `rect.width` will
  produce `NaN` under test — and `NaN` fed to an `AudioParam` throws in a real
  browser too. Guard the zero case, or derive position without a rect.
- **The fake understands the standard node types** (oscillator, gain, filter,
  panner, delay, buffer source, constant source, convolver, waveshaper,
  compressor, analyser) via both `ctx.createX()` and `new XNode(ctx, {...})`.
  An **`AudioWorklet`** design is legitimate but the fake does not model it, so
  it would need building. Flag it if the design wants one.
- Keyboard handlers should be attached to `window` or `document`, not to a
  specific focused element.
- Anything the page needs at startup should be imported, not `fetch`ed.

---

## 5. What to decide

Everything about the instrument itself. Roughly:

- **The concept** — what kind of instrument, and what makes it worth playing for
  more than ten seconds.
- **The sound** — synthesis approach, voice architecture, envelopes, tuning or
  scale (a constrained scale is one of the strongest ways to satisfy "no way to
  play it wrong": every note lands).
- **The interaction** — what the pointer does, what the keyboard does, how they
  relate, what a drag means versus a tap, whether notes sustain or decay.
- **The first five seconds** — what a stranger sees before touching anything,
  and what makes them touch it. This is the highest-value part of the design.
- **The look** — layout, palette, type, motion, and what visual feedback the
  sound gets. Consider both a laptop and a phone.
- **Expressiveness** — concretely, what two different players would sound like.
- **Non-goals** — what this deliberately is not, and what was considered and
  rejected. Rejections are as useful to hand back as decisions.

Push on the ideas. A first-thought instrument (a row of buttons that each play a
note) satisfies the spec and is dull in a room where everyone's is being played
cold. The interesting question is what rewards a second and third touch.

---

## 6. How to hand the design back

When the conversation has settled, produce **one markdown document** for the
user to save into the repo as `.claude/handback.md`. It is read by an agent that
will implement it directly, so write it as decisions, not as a discussion
transcript, and do not hedge — where something is genuinely undecided, say so
under "Open questions" rather than offering three options in the body.

Use these sections:

```markdown
# C4 instrument — design decisions

## The instrument in one sentence

## Sound
Synthesis approach, voice architecture, envelope shapes, scale/tuning, effects.
Concrete numbers where they exist (frequency ranges, attack/release times).

## Interaction
Pointer mapping, keyboard mapping, touch behaviour, what sustains, what decays.
Be specific: which axis maps to what, which keys do what.

## The opening screen
What a stranger sees before the first touch, and what invites that touch.
Include any microcopy verbatim.

## Visual design
Layout at laptop and phone size, palette (with values), type, motion, and how
the visuals respond to sound.

## Expressiveness
What makes two players sound different, concretely.

## Non-goals and rejected ideas
What this is not, and what was considered and dropped. One line each.

## Spec-test implications
Anything in section 3 of the handoff that this design bends or contradicts, and
why. Say "none" if none.

## Open questions
Anything left for implementation to resolve.
```

Keep it decision-level and readable in a few minutes. No code — pseudo-code or a
formula is fine where it pins down a mapping precisely, but the implementation
is not your job.

Two things that are **not** yours to write, in this conversation or the
handback: the course reflection, and any first-person prose in the user's voice.
Record directions as directions.
