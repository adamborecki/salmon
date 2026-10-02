# Gameplay slice: the battery-in check (engine + content + harness v2)

The first NOTICE -> TRACE -> ACT -> VERIFY loop from `docs/PRODUCT_DESIGN.md` (sections 3, 45, 46, 94
and principle 4.10), as small as it can be while still being real:

- **one scenario:** the *battery-in check* at FOH (section 45): as batteries go into each mic, and
  before the mics go to the stage, check that each one produces signal. The official on-stage line
  check is a later, separate scenario.
- **one signal chain:** handheld -> PTU-6000 receiver -> XLR -> X32 input (section 37)
- **16 mics:** channels 1-13 for the musicians; 14-16 are interchangeable spares kept at FOH, any of
  which can be the A1's talkback mic or a replacement run to the stage (owner, 2026-09-27)
- **batteries:** mics start off and empty; at the charger on the mic cabinet, two cells go in (the
  charger counts down), then you switch the mic on
- **the first fault:** batteries in the wrong way round on channel 2 or 3 (owner), picked by a reproducible
  seed: it won't switch on, checking the batteries shows why, putting them back in fixes it. The
  section 46 mute fault lives in `content.fault_library` for the on-stage line check; the engine takes
  hints and debrief text from whichever fault the content picks
- **RF group/channel:** seeded, unique per mic (6 x 6, placeholder), on the mic display and receivers
- **a second fault, the bad mic:** an unpaired mic (ch 5-13) switches on but never reaches its
  receiver; its display disagrees with its receiver slot's RF pair. It can't be fixed here: put it
  back in the drawer as a bad mic (Cary, 2026-10-02), and a spare covers it (the objective needs every
  mic verified or set aside as bad, and at least 13 verified)
- **one objective:** a mic counts only when talking into it shows signal at its X32 input (section 55)
- **a visible step list**: the owner's per-mic procedure (take the right mic, batteries in [not simulated yet], switch on, check at the X32, chair); reading the display is optional
- **"Check the rest"** (principle 4.10): after 3 mics by hand, it runs the same routine for the others
  and stops at the first mic whose X32 input is silent
- **one hint ladder** per fault (concept, location, direct; the mute one is section 46 verbatim)
- **one debrief:** what failed, whether NOTICE / TRACE / ACT / VERIFY each happened, and how much was
  done by hand vs by the skip (section 63)

## What is here

| File | What it is |
|---|---|
| `engine.js` | Pure functions over plain JSON state. No DOM, no dependencies, no framework. |
| `content/vj-battery-in-check.json` | Devices, connections, places, displays, fault, future faults, objective, step list, skip rule, hints. Every value that isn't current room fact is labelled `tentative` or `unknown` next to it. |
| `test/engine.test.mjs` | `node --test tools/gameplay-slice/test/engine.test.mjs` (Node 18+). |
| `harness.html`, `build.py` | The throwaway playable page (below); the build also crops the three character portraits for the title card. `dist/` is gitignored. |
| `line-engine.js`, `content/vj-line-check.json` | Part 2, the line check (below): the same style of engine and content; the mics' labels and colours come from the battery-in content. |
| `test/line.test.mjs` | `node --test tools/gameplay-slice/test/line.test.mjs`: the line check's rules. |
| `test/harness.e2e.mjs` | Plays the whole slice by tapping, at iPhone size: the title card, the battery-in check, then the line check (and a direct `#LC-` link). |

## Try it (throwaway harness)

`harness.html` is a deliberately small, throwaway page for *feeling* the loop on the real photos
(FOH, X32, wireless rack, mic cabinet). It opens on a title card (`content.intro`: "OH NO!", then
Cary, Morgan and Magnolia: "Relax, let's handle this!"), where you pick one of them as your mentor.
Hints then come as that mentor's speech bubbles, and the Hint button shows their face ("Ask 3"). Tap into scenes and take a mic from the
drawer: all 16 are drawn from the content, with windscreen and ring colours. A mic in hand shows its
display straight away (RF group/channel, battery, mute, in a placeholder layout). Put batteries in
from the charger, switch it on, then talk into it: away from a meter, "Talk at X32 →" walks you to
the X32 first. Put it on the chair left of FOH. After three by hand, use "Check the rest".

Phone layout (Cary, 2026-10-01: less scrolling): a sticky clock bar (time to rehearsal, a draining
bar, "+2s" per action, verified count), the photo with the meters or drawer right under it, and the
mic(s) in hand in a dock at the bottom (a tab per mic when you carry two). It reuses the engine and
the hotspots from `docs/scene-graph.json`; it is not a proposal for the real app's UI.

```bash
python3 tools/gameplay-slice/build.py
node --test tools/gameplay-slice/test/engine.test.mjs     # engine rules
node --test tools/gameplay-slice/test/line.test.mjs       # line check rules
node tools/gameplay-slice/test/harness.e2e.mjs            # full playthrough on a touch phone (Playwright)
```

Published as its own private Artifact (so the live scene-graph editor is untouched):
https://claude.ai/artifact/ALCrp7izY5q8rVima8tn1R . A link ending in `#VJ-48217` replays that seed;
the "Instructor view" at the bottom shows the seed and which mic has the fault. To republish after a
change: build, then publish `dist/index.html` to that URL with `engine.js` as a supporting file
(the six `p/*.jpg` photos are already there and are kept).

## The rules that matter

"Fixed is not the same as verified" (section 3) is enforced by data, not by UI: a mic is verified only
by evidence (talking into it while its X32 input meter is in view) that is **newer than the last
state change of any device on its path**. Unmuting alone never completes anything, and a mic
verified earlier drops back to "re-check" if anything on its path changes.

"Check the rest" is a macro of the same basic actions (take it, batteries in, switch on, talk at the
X32, put it on the chair), carrying two per trip, so it produces the same evidence and costs the same
game time as doing that by hand; it only saves the player's taps. It is offered after 3 mics have been verified **by hand** with empty hands. It
stops on anything in `skip.stop_if` (`no-signal-at-x32`) and leaves that mic in the player's hand at
the X32. The debrief credits NOTICE to the skip when the skip found the fault, but TRACE only to the
player's own checks (receiver, display, batteries).

Tests cover these, plus: hands (two slots, two mics, naming the mic), the chair's reach, the step list,
a skip stop on a mic other than 2/3 (via `start(seed, { faultChannel })`), a future battery fault
that the skip must catch, and a no-soft-lock property test (150 random 80-action runs always recover
to READY). Key rules were mutation-checked: breaking each one fails a test.

State is kept in the separate kinds of section 51: physical state (`where` each mic is, `hands`),
device state (`devices`), signal state (derived by `reach()`, never stored), verification evidence
(`evidence`, tagged `via: 'hand' | 'skip'`), assistance (`hints`), scenario (`seed`, `fault`, clock),
and an action `log` that the debrief reads.

## Batteries

Each handheld has `state.battery`: `none` -> `ok` when batteries go in (or the fault's value, for the
fault mic). Power-on needs `ok`, so a reversed or dead set leaves the mic off with a blank display and
no signal, and the skip stops on it. `check_batteries` shows orientation (not charge), and
`reseat_batteries` fixes a reversed set. `battery-dead` is in the fault library (tested, not used by a
scenario).

## What is deliberately not decided or not modelled

- **No architecture choice.** The engine has no UI and no persistence, so it fits either option in
  section 84. It is an ES module; the scene ids it uses are scene-graph node ids.
- **Hands:** two slots, up to two mics (owner). With two held, an action must name its mic (`device`).
- **The chair** left of FOH is not in any photo, so the harness shows it as a text box (tentative).
- **Not modelled:** taking batteries out for charging, X32 controls (gain, mute, buses), Monitor 1 / mains output, RF,
  frequencies, the FOH talkback routing, running a spare to the stage.
- **Placeholders kept as flagged content values:** the display layout and mute glyph (speaker-with-
  slash, fine with the owner for now; `"MUTE"` is also drawable) and per-action game seconds. The
  step list is the owner's own procedure (2026-09-28).

## Part 2: the line check (Cary, 2026-10-02)

After the battery-in check, the debrief offers **"On to the line check →"** (or open a `#LC-12345`
link, or "Jump to the line check" in the instructor view). The mics are now in the singers' hands on
the stage past the mixer, and you are the A1 at the X32. You can't touch a mic; you can only ask the
singer. Down the line, black / red first, for each singer:

1. **Say something:** watch their channel on the X32 (a healthy meter, no ring).
2. **Hear yourself?** They answer from the wedges, which are fed from **Bus 1**; each channel's
   send on fader (the − / + in the dock) sets how loud they are in the wedges.

The clock carries on from the battery-in check, and a spare (14-16) stands in for any mic set aside
as bad. Two of Cary's four faults per run (seeded, never the first singer):

| Fault | What you see | Trace | Fix (ask the singer) |
|---|---|---|---|
| switched off | no signal at the X32 | "Read display?" says blank; no RF at its receiver | press and hold the button |
| muted | no signal at the X32 | the display shows mute; RF but no audio at its receiver | tap the button |
| too quiet | the meter barely moves | the receiver is low too, or the display looks normal | sing out |
| pointed at the wedge | a ring from the wedges (with its send up) | pull its Bus 1 send down: the ring stops | point it away, then send back up |

The wrong instruction makes things worse: "press and hold" switches a working mic off. "Go down the
line" (after 3 by hand) does the same routine and stops at the first wrong meter, ring, or singer
who can't hear themselves. The debrief scores NOTICE / TRACE / ACT / VERIFY per fault, plus
instructions that changed a mic that didn't need it and sends left too low. The send steps, the
-10 dB start and when it feeds back are game simplifications, labelled tentative in the content.
