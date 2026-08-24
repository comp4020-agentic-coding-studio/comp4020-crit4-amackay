#!/usr/bin/env bash
# Regenerates public/card.png — the 1200x630 image a link preview shows — from
# the built site, then records the fingerprint that check-card.ts compares
# against. `pnpm card`.
#
# The pose is scripts/card-pose.js: title plate and HUD hidden, C-E-G-A held.
# agent-browser is a local tool, not a repo dependency, so this runs on the
# builder's machine and CI only ever checks the result.
set -euo pipefail

port=4990
base="http://localhost:${port}/comp4020-crit4-amackay/"

if ! command -v agent-browser > /dev/null; then
  echo "agent-browser is not installed — it is what takes the shot" >&2
  exit 1
fi

# Headless Chromium still plays through the host's speakers, and the pose
# presses four keys. See CLAUDE.md.
export AGENT_BROWSER_ARGS=--mute-audio

cleanup() {
  agent-browser close > /dev/null 2>&1 || true
  pnpm exec astro preview stop > /dev/null 2>&1 || true
}
trap cleanup EXIT

pnpm build
# One preview daemon per project, so take the port rather than share it.
pnpm exec astro preview stop > /dev/null 2>&1 || true
pnpm exec astro preview --background --port "$port" > /dev/null

agent-browser set viewport 1200 630 > /dev/null
agent-browser open "$base" > /dev/null

# The pose reports whether it worked; nothing is shot unless it did. A card is
# a screenshot, so a pose that quietly stopped lighting the chord would
# otherwise be recorded as the new truth and reported as a success.
pose=$(agent-browser eval "$(cat scripts/card-pose.js)")
echo "$pose"
if ! echo "$pose" | jq -e '.ok' > /dev/null; then
  echo "the pose failed, so no card was taken:" >&2
  echo "$pose" | jq -r '.problems[]? // "the pose returned nothing usable"' >&2
  exit 1
fi

# Into place only once it is a whole PNG of the right size: public/card.png is
# the shipped artefact, and a half-written one is worse than a stale one.
shot=$(mktemp -t card-XXXXXX.png)
agent-browser screenshot "$shot" > /dev/null
mv "$shot" public/card.png

node scripts/check-card.ts --write
# --write records and returns without validating anything, so check what was
# just recorded rather than assuming it.
node scripts/check-card.ts
