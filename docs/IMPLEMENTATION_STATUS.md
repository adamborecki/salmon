# Implementation status

Written by the Claude session of 2026-09-27 (overnight, owner asleep). Pair with
`docs/SESSION_HANDOFF.md` (how the prototype works) and `docs/PRODUCT_DESIGN.md` (what and why,
highest authority). This file is the running log of what changed, what was verified, and what
needs the owner. **Interim version: the session is still running; the final version replaces this.**

## Artifact synchronization

- Live Artifact: `https://claude.ai/artifact/YL4fwPRru76zLs75Vppadr`.
- At session start the live DB (`graph/main`, version 269) was **identical** to
  `docs/scene-graph.json` at `8865fd6` (63 nodes, 75 edges), and the published page code was
  identical to `template.html`. No drift, so no sync commit was needed.
- This session wrote the DB once (hotspots + one arrow position; pinned to v269, now **v270**) and
  read it back: byte-identical to `docs/scene-graph.json` at commit `c81919c`.
- Page republished as Artifact **version 26** from the tested build (touch fixes below).

## Done so far

1. `validate.py` + `sync.py` (scene-graph checks, scripted live-DB sync), wired into `build.py`.
2. Walk view touch fixes, Back pill on screens, keyboard insets use hotspots.
3. Only arrow icons take taps (labels were covering half the X32 hotspot on phones); dragged arrow
   positions now honored for every arrow (four owner-placed walk arrows were never drawn where saved).
4. 14 new inset hotspots (10/29 -> 24/29), tested in and out at phone + desktop sizes.

Details and the list of owner decisions will be in the final version of this file.
