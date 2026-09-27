# Implementation status

Written by the Claude session of 2026-09-27 (overnight, owner asleep), starting from `8865fd6`.
Pair with `docs/PRODUCT_DESIGN.md` (what and why; highest authority) and `docs/SESSION_HANDOFF.md`
(how the prototype works). This file is the current state: what changed tonight, what was
verified and how, what needs the owner, and what to do next.

## For the owner, in two minutes

1. **Try the first gameplay loop on your phone:** https://claude.ai/artifact/ALCrp7izY5q8rVima8tn1R
   Find the muted handheld among mics 1-4 at FOH, fix it, verify it, read the debrief. This is a
   throwaway harness on the real photos, not a UI proposal. "Instructor view" at the bottom shows the
   seed and the muted mic.
2. **Open the live editor on a real phone** (https://claude.ai/artifact/YL4fwPRru76zLs75Vppadr) and
   check the things only a real phone can show (list under "Needs your judgment").
3. **Answer the short list of room questions** below, so the slice's placeholders become facts.
4. **The architecture fork (section 84) is still open.** Nothing tonight picks a side; my
   recommendation is under "Decisions for you".

## Artifact synchronization

| When | Live DB `graph/main` | Page code | Repo |
|---|---|---|---|
| Session start | v269, identical to `docs/scene-graph.json` at `8865fd6` (63 nodes, 75 edges) | identical to `template.html` (diffed line by line) | `8865fd6` |
| Tonight's only DB write | v270: 14 hotspots + 1 arrow position, `ArtifactData update` pinned to v269 | | `c81919c` |
| Before each republish | re-read: still v270, identical to the repo | | |
| End of session | **v270, byte-identical to `docs/scene-graph.json`** | **Artifact version 27**, byte-identical to a fresh build of `7f63631` | see "Final state" at the bottom |

No owner edits arrived during the session (the DB stayed at v269 until my one pinned write), so
nothing was ever at risk of being overwritten. The sync is now scripted: see "Tooling" below.

## What changed tonight

### Tooling (`tools/scene-graph-editor/`)
- **`validate.py`**: checks the graph and the photo library for anything that would break the page,
  strand the player, or leak data from the public repo: dangling edges, missing photos, malformed
  hotspots, duplicate edges, soft-locks (a scene you can walk into from `outside-entry` but not walk
  back out of), manifest drift, and **GPS EXIF in committed photos** (all 63 clean). Also reports
  hotspot coverage, phone-sized tap targets, and reverse links whose turns don't mirror. Accepts a raw
  live-DB export. `build.py` now refuses to build on an ERROR.
- **`sync.py`**: `diff` / `pull` / `payload` for the Artifact <-> repo round trip. `pull` writes the
  committed file's exact formatting (a no-op sync is a no-op diff); `payload` produces a DB doc whose
  `json` string is byte-identical to what the page itself saves. README updated with the workflow.
- **Tests** (`tests/`, Playwright, serve `dist/` themselves): `walk-touch.mjs` (phone touch +
  desktop keyboard checks, all-pairs routability), `hotspots.mjs` (every hotspot's zoom in + Back at
  phone and desktop size, with a warning when other overlays cover part of a hotspot).

### Prototype fixes (`template.html`, live as Artifact version 27)
- **Hover previews only where hover exists** (`@media (hover:hover)`). On touch screens `:hover`
  sticks under the finger after a tap, and iOS Safari can swallow the first tap on an element whose
  hover reveals content (arrows needing two taps). Chromium can't emulate that iOS behaviour, so this
  one is fixed by the standard pattern but **not verified on a real iPhone**.
- **Only the arrow icon takes taps**, not its text label. Measured at iPhone size, 51% of the X32
  hotspot on `foh-wide` was covered by the `center-wide` arrow's label, so tapping the left half of
  the console walked away. Now no hotspot drawn by you is more than 5% covered by labels.
- **Dragged arrow positions are drawn for every arrow**, as `PATH_ANALYSIS.md` describes. The renderer
  only honoured `icon_x/icon_y` for turn icons, so four walk arrows you had dragged were saved but
  never drawn there (they snapped back to the ring): `center-wide -> crossroads`,
  `racks-rear-wide -> upstage-back-wide`, `racks-front-wide -> first-entry`,
  `racks-front-wide -> crossroads-left`. They now appear where you put them (see the one conflict below).
- **"Walk to..." can reach FOH rear and the RJ45 view.** The planner only used walk links, so 35 of
  156 hub pairs had "No walking route" (everything via the turn-around to `foh-rear-wide`, and
  everything to `first-entry-rj45-ports`). It now tries walk links first, so **all 121 routes that
  already worked are unchanged** (checked pair by pair), and only falls back to control links, costed
  by plan distance, when there is no walking route.
- Back pill also on `screen` scenes (X32 screens, Dante, Logic); keys 1-9 use the hotspot zoom; arrow
  labels and edge-placed icons stay inside a phone-sized frame (display only; saved positions unchanged).
- Edit-mode hint text now describes what dragging actually does.

### Scene-graph data (`docs/scene-graph.json` = live DB v270)
- **14 new inset hotspots; coverage 10/29 -> 24/29.** Each was placed on the parent photo rendered
  exactly as the 4:3 stage shows it (portrait parents letterboxed), checked visually against the photo
  and the inset, then tested zoom-in and Back at phone and desktop size. Your 10 polygons are untouched.

  | Parent | New hotspots | Confidence |
  |---|---|---|
  | `foh-rack` | `foh-rack-closeup` (receivers + PA units), `foh-rack-drawer` | drawer is **low**: a near-black region, located by lifting the shadows (two tape tabs match the drawer front) |
  | `foh-computer` | `ssl2plus`, `logic-settings-screen` (the monitor) | high |
  | `x32-top` | `x32-screen-1` (the photo's screen shows HOME, which is exactly screen 1) | high |
  | `foh-right-side` | `foh-mic-drawer` (the cabinet: IEM on top, drawers) | medium: the inset is an older photo of the same cabinet |
  | `foh-rear-wide` | `x32-rear`, `foh-rack-rear`, `foh-computer-rear` (monitor + gear on the rack top), `foh-iem-rack-rear` | high |
  | `storage-closet` | `storage-door-latch` (the closed left door), `storage-husky-toolbox`, `storage-live-sound-cart`, `storage-rear` (back wall above the cart) | high, except the latch, which uses the whole door as the tap target |

- **One arrow position set:** `storage-closet -> storage-entry` had no saved position; its automatic
  spot sat on the Husky toolbox and covered 61% of that hotspot on a phone. Moved to (86, 88) on the
  floor. Edit mode's "Reset position" undoes it.

### First gameplay slice (`tools/gameplay-slice/`)
The smallest real NOTICE -> TRACE -> ACT -> VERIFY loop (sections 46 and 94): one chain (handheld
-> PTU-6000 -> XLR -> X32 input), one fault (a handheld on but muted, picked by a reproducible seed),
one objective, the section 46 hint ladder verbatim, and a debrief.
- `engine.js`: pure functions over plain JSON state, no DOM, no dependencies. **Verification is
  enforced by data:** a mic counts only by evidence seen at its X32 input while talking into it, and
  that evidence must be newer than the last change to anything on its path. Unmuting alone never
  completes anything; a verified mic drops back to "re-check" if something on its path changes.
- `content/vj-line-check.json`: devices, connections, what each scene's meters show, fault, objective,
  hints. **Every value that isn't current room fact is labelled `tentative` or `unknown` beside it.**
- Tests: 14 engine tests (including a no-soft-lock property test: 150 random 60-action runs always
  recover to READY), mutation-checked; a full touch playthrough of the harness at iPhone size.
- `harness.html` + `build.py`: the throwaway page linked above, published as its **own** artifact so
  your editor is untouched. It reuses the engine unchanged and the hotspots from the scene graph.

## What was tested, and how

| Check | How | Result |
|---|---|---|
| Documented build works | `build.py` from a clean checkout (needs `pip3 install Pillow`) | builds 63 nodes / 75 edges / 63 photo pairs |
| Graph + privacy | `validate.py` | 0 errors; 1 warning (see below) |
| Sync fidelity | `sync.py pull` of the live export over the repo file | byte-identical; payload `json` byte-identical to the live string |
| Touch + keyboard | `tests/walk-touch.mjs` (iPhone 13 emulation + desktop) | all pass; fails on the old template for labels and the Back pill, as intended |
| Every hotspot | `tests/hotspots.mjs`: 24 hotspots x phone + desktop, tap in, land, Back, return | 48/48; 2 coverage warnings (below) |
| Routing | all 156 hub pairs; three long routes played and unwound with Back | all routable; existing 121 routes unchanged |
| Edit-mode arrow drag | Playwright mouse drag | position stored and drawn where dropped |
| Gameplay engine | `node --test tools/gameplay-slice/test/engine.test.mjs` | 14/14; each key rule fails a test when broken on purpose |
| Gameplay harness | `tools/gameplay-slice/test/harness.e2e.mjs`: full playthrough by tapping | all pass; it caught two real bugs before publishing |
| Horizontal scroll at 390 px | Playwright | none |

**Not tested:** a real phone (all touch testing is Chromium emulation); the published harness page
itself (the artifact viewer needs your login; the identical local build passes the full playthrough).

## Needs your judgment

### On the live editor (a real phone is the only way to check some of these)
- **Arrow taps on iPhone:** do arrows now work on the first tap?
- **`racks-front-wide`:** the `crossroads-left` arrow you dragged to (59, 71.9) now shows there, which
  is on the base of the Monitor Amp Rack; on a phone it covers ~40% of that rack's hotspot. Dragging it
  onto the floor fixes it. (Before tonight it silently snapped back, so you may never have seen it there.)
- **Five insets left list-only on purpose:** `x32-screen-2/3/4` and `dante-controller-screen` are
  other software states of a screen that already has a hotspot (one region can only open one inset);
  `storage-school-of-rock-cart` isn't visible from the closet photo. Options: leave them list-only, add
  a small "which screen?" chooser inside the screen inset, or treat screens as emulator states later.
- **Review the 14 new hotspots**, especially `foh-rack -> foh-rack-drawer` (low confidence) and the
  door-latch one (whole door as tap target).
- `racks-rear-wide -> mains-rack-rear` (your polygon) is 24 px wide on a phone, hard to tap.
- Reverse links whose turns don't mirror (maybe intentional): `racks-front-wide -> racks-rear-wide`
  -180 but back +140; `crossroads-right -> path-to-storage` +30 but back 0.

### Room facts: owner answers (2026-09-27, now in `content/vj-line-check.json`)
- Switching a muted mic off and on **clears** the mute (engine and debrief updated; a power cycle is
  now a real, if indirect, fix and the debrief says so).
- Power is a **press-and-hold**; a tap mutes/unmutes.
- A muted transmitter **shows it on its display**; the exact glyph (speaker-with-slash, or the word
  MUTE) is unconfirmed. The handheld has a small LCD (group/channel number + battery) above the button.
- Handheld N -> receiver channel N -> X32 input N. Each receiver unit is 8 channels: top = 1-8,
  second = 9-16, third = 17-24.
- Mics are named by windscreen colour then ring colour: black red = 1, black orange = 2 ... black
  black = 7, black grey = 8; grey red = 9 ... grey grey = 16. Rings 3-6 = yellow, green, blue, purple is
  **inferred** from the rainbow order; 17-24 windscreen colour unknown.
- Line check: A2 talks, A1 watches the X32 ("I guess": kept tentative).

### Owner answers, round 2 (2026-09-27)
- **Test order:** keep PRODUCT_DESIGN section 43 (playback -> mains -> Monitor 1 -> wireless). Note added there.
- **Two different mic checks** (added to PRODUCT_DESIGN section 45): the *battery-in check* at FOH as
  batteries go in, before the mics go to the stage; and the official *line check* on stage with the
  musicians making sound and the A1 confirming at the X32. The current slice is the battery-in check
  and should be renamed that way.
- **New principle, PRODUCT_DESIGN 4.10 "Realism without monotony":** do the routine for real a few
  times, then offer "check the rest", which stops at the first abnormal mic and must not hide problem
  types the player hasn't met (for example batteries).
- Rings 3-6 confirmed (yellow, green, blue, purple); mics 17-24 have no windscreen for now.
- Inventory: carrying several mics in one hand is possible but awkward; the hands model is undecided.

### Next build session: harness v2 (brief)
1. Rename the scenario and objective to the battery-in check; keep the test-order note for later scenarios.
2. SVG mic graphics drawn from data: body, windscreen colour, ring colour, LCD with channel number and
   a mute state (placeholder glyph until the owner sends a photo of a muted display).
3. 3 mics done by hand, then "check the rest", which stops at the first abnormal mic (principle 4.10).
4. Leave room for battery faults (wrong way round, dead cells) as future faults the skip must still
   catch, without building them yet.
5. A visible step list for the procedure.
6. Hands: two simple "in hand" slots, no hand art; keep one mic at a time unless the owner decides otherwise.
7. Keep engine tests, the e2e playthrough and the published harness in step; update this file.

### Decisions for you
- **Architecture (section 84), my recommendation:** keep `template.html` as the authoring/editor tool
  (it is good at that, and the live-DB workflow works), and build the student-facing player as a
  separate small app that reads `scene-graph.json`, content JSON and the engine, in plain ES modules
  with no framework until something forces one. The harness is that shape in miniature. This is a
  recommendation only; nothing depends on it yet.
- Where room-truth content (devices, connections) should live once it grows beyond one scenario
  (for now it sits with the slice, clearly labelled).

## Known limitations
- No real-phone QA yet (see above).
- The harness uses simple fades between scenes, not the editor's walk/zoom transitions (deliberate).
- A few thumbnails (`t/*.jpg`) in the live artifact differ by a few hundred bytes from a fresh local
  build (different Pillow version at original publish time); the 1280 px previews are identical. Harmless.
- `PRODUCT_DESIGN.md` section 7's counts (10/29 hotspots) describe its v2 snapshot; the current count is 24/29.

## Recommended next steps
1. **Owner:** phone pass on the live editor; move the `crossroads-left` arrow; decide the five
   list-only insets; answer the five room questions; play the harness and say whether the loop teaches
   the right habit.
2. **Agent, safe now:** fold the answers into `content/vj-line-check.json` (values, not code); run
   `validate.py`, both Playwright suites and the engine tests after any change.
3. **After the architecture decision:** extend the slice downstream (X32 Bus 1 -> current transport ->
   NX3000 -> wedges, i.e. "verify Monitor 1") once the transport facts are confirmed; add X32 channel
   mute/fader as plausible wrong actions; then the second fault (dead monitor path, section 69).
4. Photo retakes when convenient: the RJ45 wall panel, a clear open mic drawer, a brighter shot of the
   wireless rack's lower half (would firm up the drawer hotspot).

## How to run everything
```bash
pip3 install Pillow                                       # once
python3 tools/scene-graph-editor/validate.py              # graph + privacy checks
python3 tools/scene-graph-editor/build.py                 # editor -> tools/scene-graph-editor/dist/
node tools/scene-graph-editor/tests/walk-touch.mjs        # needs Playwright + Chromium
node tools/scene-graph-editor/tests/hotspots.mjs
python3 tools/gameplay-slice/build.py                     # harness -> tools/gameplay-slice/dist/
node --test tools/gameplay-slice/test/engine.test.mjs
node tools/gameplay-slice/test/harness.e2e.mjs
```

## Final state of this session
- Last code/data commit: `7f63631`. The commit that adds this final version of this file comes right
  after it (`git log -1 -- docs/IMPLEMENTATION_STATUS.md`); nothing else changed after that.
- `main` and `claude/compassionate-volta-5zruvy` point at the same commit; working tree clean.
- Live editor: Artifact version 27 = a fresh build of that commit (diffed); live DB v270 =
  `docs/scene-graph.json` (diffed). Harness: https://claude.ai/artifact/ALCrp7izY5q8rVima8tn1R, version 1.
