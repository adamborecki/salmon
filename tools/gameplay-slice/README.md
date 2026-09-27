# Gameplay slice: the battery-in check (engine + content + harness v2)

The first NOTICE -> TRACE -> ACT -> VERIFY loop from `docs/PRODUCT_DESIGN.md` (sections 3, 45, 46, 94
and principle 4.10), as small as it can be while still being real:

- **one scenario:** the *battery-in check* at FOH (section 45): as batteries go into each mic, and
  before the mics go to the stage, check that each one produces signal. The official on-stage line
  check is a later, separate scenario.
- **one signal chain:** handheld -> PTU-6000 receiver -> XLR -> X32 input (section 37)
- **16 mics:** channels 1-13 for the musicians; 14-16 stay at FOH, the A1's talkback mic and two
  spares (owner, 2026-09-27; which of 14-16 is the A1's is unknown)
- **one fault:** a handheld powered on but muted (section 46), always channel 2 or 3 (owner: "2nd or
  3rd of the first 3"), picked by a reproducible seed. The owner notes this is really an on-stage
  fault (a freshly powered mic starts unmuted); it stays here until the line check is built.
- **one objective:** a mic counts only when talking into it shows signal at its X32 input (section 55)
- **a visible step list** for the per-mic routine (wording tentative, for the owner to correct)
- **"Check the rest"** (principle 4.10): after 3 mics by hand, it runs the same routine for the others
  and stops at the first mic whose display is blank or muted or whose X32 input is silent
- **one hint ladder:** the three hints from section 46, verbatim
- **one debrief:** what failed, whether NOTICE / TRACE / ACT / VERIFY each happened, and how much was
  done by hand vs by the skip (section 63)

## What is here

| File | What it is |
|---|---|
| `engine.js` | Pure functions over plain JSON state. No DOM, no dependencies, no framework. |
| `content/vj-battery-in-check.json` | Devices, connections, places, displays, fault, future faults, objective, step list, skip rule, hints. Every value that isn't current room fact is labelled `tentative` or `unknown` next to it. |
| `test/engine.test.mjs` | `node --test tools/gameplay-slice/test/engine.test.mjs` (Node 18+). |
| `harness.html`, `build.py` | The throwaway playable page (below). `dist/` is gitignored. |
| `test/harness.e2e.mjs` | Plays the whole slice by tapping, at iPhone size. |

## Try it (throwaway harness)

`harness.html` is a deliberately small, throwaway page for *feeling* the loop on the real photos
(FOH, X32, wireless rack, mic cabinet). Tap into scenes and take a mic from the drawer: all 16 are
drawn from the content, with windscreen and ring colours. Read its display, which shows the channel
number, battery and mute state in a placeholder layout. Then talk into it at the X32 and put it on
the chair left of FOH. After three by hand, use "Check the rest". It reuses the engine unchanged and
the hotspots from `docs/scene-graph.json`; it is not a proposal for the real app's UI.

```bash
python3 tools/gameplay-slice/build.py
node --test tools/gameplay-slice/test/engine.test.mjs     # engine rules
node tools/gameplay-slice/test/harness.e2e.mjs            # full playthrough on a touch phone (Playwright)
```

Published as its own private Artifact (so the live scene-graph editor is untouched):
https://claude.ai/artifact/ALCrp7izY5q8rVima8tn1R . A link ending in `#VJ-48217` replays that seed;
the "Instructor view" at the bottom shows the seed and which mic is muted. To republish after a
change: build, then publish `dist/index.html` to that URL with `engine.js` as a supporting file
(the six `p/*.jpg` photos are already there and are kept).

## The rules that matter

"Fixed is not the same as verified" (section 3) is enforced by data, not by UI: a mic is verified only
by evidence (talking into it while its X32 input meter is in view) that is **newer than the last
state change of any device on its path**. Unmuting alone never completes anything, and a mic
verified earlier drops back to "re-check" if anything on its path changes.

"Check the rest" is a macro of the same basic actions (take it, read the display, talk at the X32,
put it on the chair), carrying two per trip, so it produces the same evidence and costs the same
game time as doing that by hand; it only saves the player's taps. It is offered after 3 mics have been verified **by hand** with empty hands. It
stops on anything in `skip.stop_if` (`display-warning`, `no-signal-at-x32`) and leaves that mic in
the player's hand at the X32. The debrief credits NOTICE to the skip when the skip found the fault,
but not TRACE (the skip read the display, the player didn't).

Tests cover these, plus: hands (two slots, two mics, naming the mic), the chair's reach, the step list,
a skip stop on a mic other than 2/3 (via `start(seed, { faultChannel })`), a future battery fault
that the skip must catch, and a no-soft-lock property test (150 random 80-action runs always recover
to READY). Key rules were mutation-checked: breaking each one fails a test.

State is kept in the separate kinds of section 51: physical state (`where` each mic is, `hands`),
device state (`devices`), signal state (derived by `reach()`, never stored), verification evidence
(`evidence`, tagged `via: 'hand' | 'skip'`), assistance (`hints`), scenario (`seed`, `fault`, clock),
and an action `log` that the debrief reads.

## Room for battery faults (not built)

Each handheld has `state.battery` (`"ok"` in v2). Power-on is refused unless it is `"ok"`, so a mic
with a bad battery stays off, its display is blank, and there is no signal: the skip stops on it.
`content.future_faults` lists `battery-reversed` and `battery-dead` as data only; no scenario uses
them yet. Putting batteries in is step 2 of the step list and marked "not simulated yet".

## What is deliberately not decided or not modelled

- **No architecture choice.** The engine has no UI and no persistence, so it fits either option in
  section 84. It is an ES module; the scene ids it uses are scene-graph node ids.
- **Hands:** two slots, up to two mics (owner). With two held, an action must name its mic (`device`).
- **The chair** left of FOH is not in any photo, so the harness shows it as a text box (tentative).
- **Not modelled:** battery insertion, X32 controls (gain, mute, buses), Monitor 1 / mains output, RF,
  frequencies, the FOH talkback routing, anything role-specific about mics 14-16.
- **Placeholders kept as flagged content values:** the display layout and mute glyph (speaker-with-
  slash; `"MUTE"` is also drawable), per-action game seconds, the step list wording.
