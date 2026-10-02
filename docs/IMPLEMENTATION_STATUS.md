# Implementation status

Newest truth first. **Session 3** (2026-10-01) is the first with **Cary** as a collaborator (Adam,
"the owner" below, built sessions 1-2; Cary is also one of the three photographed characters).
**Session 2** (2026-09-27, harness v2, owner reachable) follows it;
everything from "Artifact synchronization" on is **session 1** (the overnight session of 2026-09-27,
starting from `8865fd6`), still accurate unless session 2 says otherwise. Pair with
`docs/PRODUCT_DESIGN.md` (what and why; highest authority) and `docs/SESSION_HANDOFF.md`
(how the prototype works).

## For the owner, in two minutes

1. **Play harness v2 on your phone:** https://claude.ai/artifact/ALCrp7izY5q8rVima8tn1R (version 2).
   It is now the battery-in check: 16 mics drawn in the drawer, read each display, talk at the X32,
   put it on the chair; after 3 by hand, "Check the rest". "Instructor view" shows the seed and the
   muted mic. Still a throwaway harness, not a UI proposal.
2. **The public site is live:** https://adamborecki.github.io/salmon/ (anonymized people, landing page,
   walk-around with Export JSON, the battery-in check).
3. ~~Mute glyph~~ the placeholder is fine for now. The step list is now your own procedure (2026-09-28).
4. The live editor phone pass and the architecture fork (section 84) from session 1 are still open.

## Session 3, part 4 (2026-10-02, Cary): wedge check, monitor amp off, the A2

Cary: "usually the amp is not on", then "get to work on all that". All three candidates are built.

### What changed
- **Wedge check before the singers.**
  - In the X32 panel: "▶ The Wii Shop theme → Bus 1" and "▶ → Mains".
  - The playback is text only; no audio goes in the repo.
  - The wedge strip shows green when the wedges play, a red dashed outline when they're silent, and
    flashes red on a ring.
  - The line check now counts as done only with a wedge check newer than any amp change. The debrief
    notes whether you did it before the singers.
- **New fault: the monitor amp (NX3000) is off** (`target: amp`). Content `monitor_amp` cites
  sections 30 and 42 and Cary.
  - What you see: silent wedges, "Nothing in the monitor" at any send, and no feedback (no amp, no
    ring).
  - TRACE: it plays through the mains (or "Mains test" on a singer is heard), so the problem is after
    Bus 1; or the A2 checks the amp.
  - ACT: the A2 switches it on.
  - VERIFY: Bus 1 plays in the wedges again.
  - Switching the amp on re-opens the wedge check and every singer's monitor check.
- **The A2** (content `a2`, 20 s a trip, tentative). From the dock: "Send A2" reports what a singer's
  mic is doing (TRACE for any singer fault). From the panel: check the monitor amp, or switch it on.
- **"Mains test"** per singer: is their channel heard through the mains?
- Faults are now two per run out of five kinds, so seeds give different faults than before:
  LC-48217 is now amp off + pointed at the wedge.

### Tested
- `line.test.mjs` 23/23 (8 new tests). I broke 7 new rules on purpose and a test caught each one:
  - amp off still heard;
  - feedback without the amp;
  - no wedge check required;
  - the mains test ignores a dead mic;
  - an amp change doesn't re-open the monitor checks;
  - playback ignores the amp;
  - the A2 can't switch the amp on.
- Harness e2e 136 checks:
  - from the battery-in check into LC-48217: silent wedges, the mains plays, the A2 finds the amp off
    and switches it on, the wedges play; then a ring on ch 9 is fixed;
  - direct link LC-20164: the A2 traces the switched-off mic, the singer reads the muted display;
  - 4/4 per fault in both debriefs.
- All CLAUDE.md checks, plus the public site build and `site.e2e.mjs`. Phone screenshots reviewed: in
  the line check, messages now float just above the dock so they're never hidden.

### Open (Cary / owner)
- Placeholder timings: an A2 trip 20 s, playback 5 s, a mains test 3 s.
- Should the A2 also be able to fix a singer's mic (switch it on, unmute it), not just report? Right
  now fixes go through the singer; the A2 only switches the amp on.
- Other monitor-path failures besides the amp (the long speaker cable, the daisy-chain, the
  transport)? Only "amp off" is modelled.

## Session 3, part 3 (2026-10-02, Cary): the line check

Built from Cary's answers (recorded in PRODUCT_DESIGN section 45 and `content/vj-line-check.json`).

### What changed
- **New: `line-engine.js` + `content/vj-line-check.json`**, the same style as the battery-in engine
  (pure, seeded, data-driven faults, hints, debrief).
  - The player is the A1 at the X32. They can't touch the mics, only ask the singer: press and hold,
    tap, sing out, point it away, read the display, can you hear yourself?
  - They also set each channel's **Bus 1 send** (the wedges).
  - A singer counts as checked only when, newer than any change, the X32 meter is healthy with no
    ring AND they say they hear themselves with no ring. A send change re-opens only the wedge
    check; a mic change re-opens both.
- **Faults (two per run, seeded, never the first singer; tentative):**
  - switched off: no RF;
  - muted: RF but no audio;
  - too quiet: low meter;
  - pointed at the wedge: rings once its send is at -10 dB or up.

  Trace by the display (asked), the receivers' RF/audio, or pulling the send down. The muted hints
  are section 46's ladder adapted to "ask the singer".
- **Wrong instructions bite:** "press and hold" on a working mic switches it off. The debrief lists
  such instructions and any sends left too low.
- **"Go down the line"** after 3 by hand (principle 4.10), same game time, stops at the first problem.
- **Harness:**
  - The battery-in debrief offers "On to the line check →". The clock carries on, and a spare stands
    in for each bad mic.
  - Line check seed = `LC-` + the battery seed's digits. `#LC-12345` links start it directly;
    "Jump to the line check" is in the instructor view.
  - Line-check layout: the meters and a Bus 1 wedge strip (it flashes red on a ring) sit above the
    photo, with a singer card in the dock (‹ › or tap a chip to pick a singer). The mentor greets you
    and gives the hints.
  - The public site build now copies `line-engine.js` too.
- CLAUDE.md's check list includes `line.test.mjs`.

### Tested
- `line.test.mjs` 15/15, including a no-soft-lock property test (120 random 60-action runs recover).
  I broke 6 rules on purpose and a test caught each one:
  - hold never switches off;
  - the send doesn't matter for feedback;
  - the wedge check is skipped;
  - a send change doesn't re-open the wedge check;
  - the skip ignores a ring until later (the test was tightened to catch this);
  - a power cycle keeps the mute.
- Harness e2e 133 checks:
  - after the battery-in check, the line check from the debrief: spare 14 stands in for bad mic 10,
    the clock carries on, Morgan explains it;
  - LC-48217 (too quiet, pointed at the wedge: the wedges flash; send down stops the ring);
  - LC-20017 by direct link (muted met by hand, switched off met by the skip; the receivers show RF
    on the muted mic and none on the switched-off one);
  - both debriefs score 4/4 per fault; no sideways scroll.
- Engine 31/31, the editor suites, the public site build + `site.e2e.mjs`. Phone screenshots reviewed.

### Cary's answers, round 2 (2026-10-02; in PRODUCT_DESIGN section 45 and the line-check content)
- The A1 usually talks to the singers directly, but the A2 often goes to the stage to help with a
  problem while the A1 stays at the mixer.
- The wedges are checked before the singers with known playback: the Wii Shop theme (Cary's pick) or
  the Mii Channel theme.
- The mains aren't part of the line check. They're the diagnostic when a mic doesn't come through
  the monitors: through the mains but not the monitors means the monitor path is the problem.

**Next build candidates from these (none started):**
1. A wedge check before the singers: play the Wii Shop theme through Bus 1 and confirm the wedges
   (section 43's known source first). This is text only: no copyrighted audio in the repo.
2. The dead-monitor-path fault (section 69): a singer can't hear themselves at any send. You
   diagnose it by routing them to the mains (heard there, so it's the monitor path) and fix it
   downstream of Bus 1.
3. "Send the A2": the A1 stays at the X32 while the A2 walks to the singer to fix a problem.

### Open (Cary / owner)
- ~~A1 alone or A2 relays; separate wedge check; mains in the line check~~ answered (round 2 above).
- **Tentative values to confirm:**
  - Bus 1 send steps (off, -20, -10, -5, 0) and the -10 dB start;
  - "hears themselves from -10";
  - "feeds back from -10 when pointed at a wedge";
  - two faults per run;
  - a direct link starting at 4:56.

## Session 3, part 2 (2026-10-02, Cary): mentors, bad mics in the drawer, room answers

### Cary's answers (recorded in content)
- **Bad mics go back in the drawer.** The `bad` place is now the mic drawer (`places.bad`,
  reachable only there). The game still tracks a bad mic as set aside (so a spare covers it). In the
  drawer it shows dashed with a red "bad" tag, and you can pick it up again. The button reads "Bad mic:
  back in drawer" and only appears at the drawer. Hints, the debrief and the goal say "back in the
  drawer".
- **32 charged batteries is right.** Spare batteries are in a bin near the FOH computer (recorded in
  `places.charger.status`; not simulated).
- **Line check (described, not built):** it happens after all the mics are ready, going down the line
  one mic at a time, starting with black / red, to make sure each works. Cary asked whether that is the
  same gameplay as the battery-in check; see the open questions below.

### What changed
- **Pick your mentor** (Cary's idea). On the title card's second page you tap Cary, Morgan or
  Magnolia; "Let's go" waits for a pick, and the choice is remembered in the browser.
  - The mentor greets you, and every hint is their speech bubble (face, name, "Hint 1 of 3"),
    just above the hands dock. It closes when you tap it or do anything else.
  - The Hint button is the mentor's face plus "Ask 3".
  - Hint wording is the same for all three (section 22: no personalities are decided).
- Debrief moved out of the clock bar to "Debrief so far" under the steps, to make room for the face.

### Tested
- Engine 31/31: the bad-mic tests now put it back at the drawer, and putting it aside anywhere else
  is refused.
- Harness e2e 94 checks:
  - "Let's go" waits for a mentor; picking Morgan;
  - Morgan's greeting and Morgan's speech-bubble hint;
  - "Ask 3" with a face;
  - no bad-mic button at the receivers; walking to the drawer and putting the unpaired mic back as bad;
  - it shows in the drawer marked bad.
- All other checks pass, plus the public site build and `site.e2e.mjs`. Phone screenshots reviewed.

### Open (Cary / owner)
- **Line check gameplay:** Cary asked whether it is the same as the battery-in check. Mechanically
  close (talk, watch the meter), but things that would make it its own lesson need answers:
  - Who talks into each mic: the singer, or the A2 walking the line?
  - Where are the A1 and A2 during it?
  - What goes wrong at that point: a singer's muted mic, two singers with swapped mics (signal on
    the wrong channel), a dying battery?
  - Are the monitors (wedges) checked at the same time?
- 13 vs 14 minimum mics; whether the unpaired mic should appear every run; hint wording; title card
  only on a first visit.

## Session 3 (2026-10-01, Cary): playtest fixes, phone layout, title card

Cary played the battery-in check and asked for five things; all five are done.

### What changed
- **The display shows as soon as a mic is in hand.** There's no more "Read the display" button. The
  engine's `view().lcd` now covers every held mic; the `inspect` action still exists (tests, later use)
  but the harness doesn't offer it. Seeing the display costs no game time.
- **Talking away from a meter walks you to the X32.** Cary tried to talk into a mic right after the
  batteries, at the drawer, and was confused that it didn't count. Away from a meter the button now
  reads "Talk at X32 →": it moves you to the X32 (one move of game time) and talks there. At the X32 or
  the receivers it is "Talk into it" as before. (The engine rule is unchanged: evidence needs a meter.)
- **Less scrolling on a phone.**
  - The mic(s) in hand live in a dock fixed at the bottom of the screen, with a tab per mic when you
    carry two.
  - Buttons are shorter, on a 4-column grid.
  - All 16 meters fit in one row, so at the X32 the photo, the meters and the mic all fit on an
    iPhone 13 screen with no scrolling.
  - The step list is now a compact 1-5 stepper (content `procedure.steps[].short`). The current step's
    full text sits under it, and the rest moved into a "Tips" fold.
  - The "which mic is which" text is folded too.
- **A bigger clock.** A dark sticky bar holds a 30px clock, "9:46 to rehearsal" and a bar that drains
  (amber at 30% left, red and pulsing when late). A "+2s" pops on each action, and "N/16 verified"
  sits beside the Hint and Debrief buttons.
- **A title card** (content `intro`, shown when the page first loads, not on "New scenario"). Page 1:
  a blinking 4:50 PM and "OH NO! USingers has only left you **10 minutes** to set up for Vocal Jazz!"
  (the minutes come from the clock). Page 2: round portraits of Cary, Morgan and Magnolia, "Relax,
  let's handle this!", three lines of how to play (my wording, tentative), then "Let's go".
  - The portraits are head-and-shoulders crops made at build time (`build.py` `CHARACTERS`), tight
    enough to leave out the people in the background.
  - The public site serves the same crops; `people.json` already keeps these three.
- PRODUCT_DESIGN section 22 records Cary's direction for the characters (only this line is decided).

### Tested
- Engine 31/31. The new test fails if the display goes back to needing an inspect action (I checked
  by reverting the change).
- The harness e2e (87 checks) plays the title card (headline, 10 minutes, the three photos load, the
  bubble), the display on pickup (blank, then the RF pair), "Talk at X32 →" from the drawer for mic 1,
  the two-mic tabs, both faults to the debrief, and that the page ends clear of the dock.
- All other CLAUDE.md checks pass, plus `tools/public-site` build and `site.e2e.mjs`.
- I looked at iPhone 13 viewport screenshots of each state.

### Open (Cary / owner)
- ~~Spelling~~ answered (Cary, 2026-10-01): "USingers", the university choir that rehearses right
  before Vocal Jazz.
- ~~Charger / bad-mic spot~~ answered 2026-10-02 (part 2).
- Cary said they'd attach a photo of the three; I used the existing portraits. A group shot can
  replace them (`intro.crew` and `CHARACTERS` in `build.py`).
- Should the title card be skippable after the first time (remembered per browser)?
- Not republished: the harness Artifact and the public site (Pages deploys from `main`) still show
  the old layout until this branch is published or merged.

## Session 2, part 5 (2026-09-29): the bad mic (set aside, a spare covers it)

The owner said "build the next thing"; this is the next item from the plan (owner, 2026-09-28: a mic
that isn't paired, or has another unfixable problem, is "just a bad mic" that gets skipped).

### What changed
- **A second fault in the battery-in check: an unpaired mic**, one of the later musician mics (5-13,
  tentative), so it is usually met when "Check the rest" stops on it. It switches on, the batteries are
  fine, it isn't muted, but nothing reaches its receiver. Its display shows an RF group/channel that
  its receiver slot doesn't listen on (receiver slots are now labelled with their own pair).
- **"Set aside as bad"** (new place `bad`, a placeholder spot at FOH). The objective completes when
  every mic is verified or set aside **and at least 13 are verified** (every musician has a mic, the
  spares cover the rest; tentative). Setting aside a working or fixable mic is allowed and flagged
  in the debrief ("uses up a spare").
- Engine: `content.faults` is a list; each fault is resolved by a **fix** or by **replacement**. The
  debrief has a NOTICE/TRACE/ACT/VERIFY block per fault; for a replaced mic, VERIFY means "a spare
  covers it". A fault not reached yet reads "not yet".
- **Hints aim at the problem in front of you:** a mic in hand that you've seen fail, then any mic
  you've seen fail, then the next open problem. Holding a faulty mic you haven't noticed yet never
  gives it away.
- The unpaired hints are my wording in the section 46 shape (tentative).

### Tested
- Engine 30/30. I broke 8 new rules on purpose and a test caught each one:
  - an unpaired mic reaches its receiver;
  - its display matches its receiver slot;
  - the objective ignores the musician count;
  - set-aside mics block completion;
  - hints ignore the mic in hand;
  - the skip re-checks set-aside mics;
  - mics can be set aside from anywhere.
- The harness e2e plays both faults to the debrief:
  - reversed batteries by hand;
  - the skip stops on the unpaired mic;
  - check its batteries, read its display, compare it with its receiver slot;
  - set it aside, then the skip finishes;
  - 15 verified plus 1 set aside, with both faults' four steps ticked.
- All other suites pass.

### Open (owner)
- Is 13 the right minimum (every musician), or should the A1's talkback mic also be guaranteed (14)?
- Where does a bad mic go in the room (a bin, a labelled spot, back in the drawer with tape)?
- Should the unpaired mic appear in every run, or only sometimes (seeded)?
- Hint wording for both battery and pairing faults.

## Session 2, part 4 (2026-09-28): batteries from the charger

### What changed
- **The battery-in check now has batteries.** Mics start in the drawer, off, with no batteries. The
  charger is on top of the mic cabinet (seen in photo IMG_4127, so it's in the Mic drawer scene).
  With a mic in hand there, "Batteries in" uses two cells (the charger starts at 32, a placeholder),
  then you switch it on.
- **The fault is now reversed batteries** on ch 2 or 3 (owner: one of the first few mics):
  - it won't switch on (NOTICE);
  - "Check the batteries" shows them the wrong way round (TRACE);
  - "Put them back in" fixes it (ACT);
  - switch on, then talk at the X32 (VERIFY).
  The hints are my wording in the section 46 shape (tentative).
- **The mute fault is kept for the on-stage line check** in `content.fault_library`. The engine is
  fault-generic, meaning the hints and debrief text come from the chosen fault. The mute variant keeps
  its tests, including the section 46 ladder verbatim.
- **RF group/channel:** seeded and unique per mic, 6 groups x 6 channels (owner's suggestion). It is
  shown on the mic's display and under each receiver slot. Routing (mic N -> slot N -> X32 in N)
  was confirmed by the owner.
- "Check the rest" does the full routine (take up to two, batteries, switch on, X32, chair). The
  debrief no longer counts switching mics on as an "extra change".
- The harness UI is plain and functional on purpose. The owner wants the game played on the photos
  with fewer boxes later; gameplay first.

### Tested
Engine 24/24. I broke 8 new rules on purpose and a test caught each one:
- reversed batteries still power on;
- reseating doesn't fix them;
- the charger never runs down;
- batteries go in anywhere;
- the fault never happens;
- the RF numbers aren't shuffled;
- switching on counts as an extra change;
- the skip forgets to switch mics on.

The harness e2e plays the battery fault by hand, checks the RF labels, then runs Check the rest.
All the other suites pass too.

### Public site: live
- The owner turned on GitHub Pages and added GitHub's starter `static.yml`, which deployed the **whole
  repo** as the site (no landing page at the root, original photos exposed) and raced `pages.yml` on
  every push. It was removed (commit `c1062b9`; `git revert` restores it). Since then only "Public site"
  runs, and it succeeded: https://adamborecki.github.io/salmon/ serves the anonymized build. The sandbox
  cannot open github.io, so the live pages were not viewed from here; the same build passes `site.e2e.mjs`.
- The owner's README link (`README.md`) is kept.

### Open (owner)
- The charger: is 32 charged cells right, and where do the cells beyond one 16-slot charger come from?
- The battery-fault hint wording.
- Next candidates:
  - a "bad mic -> swap for a spare" action (unpaired or broken mics);
  - the on-stage line check (where the mute fault lives);
  - the UI pass onto the photos.

## Session 2, part 3 (2026-09-28): public site, owner's procedure

### What changed
- **Owner correction:** the "sounds great" about the step list wording was a misunderstanding. The
  owner then described the real procedure, which replaced my draft (content `procedure`):
  take the right mic by colour; two batteries in from the charger (*not simulated yet*); switch it on;
  talk at the X32, where the meter is the win criterion; put it on the chair. **Reading the display is
  optional** (troubleshooting only), so "Check the rest" no longer reads it and stops only on no signal.
- **Mic N is not RF channel N.** Each mic has a group/channel set by pairing; the values are unknown
  (`rf: {group: null, channel: null}`), shown as `--` on the display placeholder. Routing (mic N ->
  receiver slot N -> X32 input N) is unchanged, from the owner's earlier answer; see the question below.
- **Graph synced from the live editor:** DB **v337** (owner edits: arrow positions and directions, four
  hotspots, the `crossroads-left` arrow moved off the rack) pulled into `docs/scene-graph.json`.
  No writes to the DB this session.
- **Public site** (`tools/public-site/`, deployed by `.github/workflows/pages.yml` on push to `main`):
  - an "under construction" landing page;
  - `walk/`: the editor in public mode (no DB, opens in Walk, Home link, **Export JSON**, nothing saved);
  - `battery-check/`: the harness.
  People other than the three portraits are anonymized at build time (blur + a plain grey figure),
  following `people.json`. I placed every box by eye and reviewed every output, which turned up
  three photos with people but no `people` flag (`outside-entry`, `first-entry-look-right`,
  `foh-rear-wide-alt1`). Originals and the live editor are untouched.
- Editor template: `PUBLIC` flag (false in the live build, so the live editor behaves the same; the new
  Home/Export controls are hidden there). The live editor was **not** republished: its page is version 27,
  which differs from the template only by these inert public-mode additions.

### Tested
All CLAUDE.md checks pass (validate; walk-touch; hotspots, now with no arrow-coverage warnings;
engine 21/21; harness e2e), plus `node tools/public-site/test/site.e2e.mjs`. At phone size, served
under `/salmon/` like Pages, it checks:
- every link and image works;
- the export equals the repo graph;
- the served photos are the anonymized copies;
- there are no page errors and no sideways scroll.

### Needs the owner
- ~~Turn on Pages once~~ done by the owner (2026-09-28); the site is live (see part 4).
- Look over the anonymized photos on the site; boxes are by eye.
- The public **repo** still has the original photos with people (and git history). Removing them would
  mean rewriting history, which is a separate decision.
- ~~Confirm routing~~ confirmed by the owner (2026-09-28): only the RF numbers differ.

### Next build session (owner-described) — item 1 done in part 4 above
1. **Batteries from the charger:** with a mic in hand, tap the charger: two cells go in and the charger
   count drops (charger location and count: ask; section 27 says 16 or 18). Mics start **off** after
   that, so "switch it on" becomes real. An early mic (one of the first few) gets **reversed batteries**
   as the fault; the mute fault then belongs to the on-stage line check (owner, 2026-09-27).
2. **"Bad mic" -> swap for a spare** (unpaired or otherwise broken), which leads into the owner's
   scenario: a mic dies on stage and the A2 runs a spare from FOH.
3. Pairing (group/channel) as a later level.

## Session 2: harness v2 (the brief below, now done)

### Follow-up in session 2 (owner answers, 2026-09-27; harness artifact version 3)
- **Faster checks:** per-action 5 s -> 2 s, per-move 4 s -> 2 s (content `clock`, still tentative;
  timing gets adjusted later). A by-hand check is now about 20 game seconds.
- **Channels:** 1-13 are the musicians' mics; 14, 15, 16 are three interchangeable spares kept at FOH:
  any of them can be the A1's talkback mic, or the emergency mic the A2 runs to the stage to replace a
  dead one. Stored as `setup.mic_roles` and a `role` per mic (`musician` / `spare`); the harness tags
  each mic. Roles don't change the check yet.
- **Two mics in hand** (`behaviour.hands.max_mics` = 2). With two held, an action must name its mic
  (`device`), or it is refused with `which-mic`; the harness gives each hand slot its own buttons and
  the meters a talk button per held mic. "Check the rest" now carries two per trip (same game time as
  doing that by hand). If it stops, the unchecked trip partner stays in hand too, and the message says so.
- Tests: engine 21/21 (the hands, skip-time and battery-stop tests updated); three new mutations
  caught (skip carrying one, no need to name the mic, one-mic limit); e2e adds two-in-hand, a refused
  third mic, and the skip waiting while hands are full.

### What changed
- **Renamed to the battery-in check:** scenario, objective and file
  (`tools/gameplay-slice/content/vj-battery-in-check.json`; the old `vj-line-check.json` is gone).
  Section 43's test order is untouched for later scenarios.
- **16 mics** (owner: 13 musicians + 2 spares + 1 FOH talkback), channels 1-16, black and grey
  windscreens with the confirmed ring order. The channels are an assumption (tentative in content);
  which channels are the spares and the talkback is `unknown`.
- **Fault:** still on-but-muted (owner: really an on-stage line-check fault, kept here until the line
  check exists), always on ch 2 or 3 per the owner, by seed. `start(seed, { faultChannel })` lets tests
  (and a future instructor control) put it elsewhere.
- **SVG mic graphics from data:** windscreen colour (grey metal grille when there is none), ring colour,
  body, display window and button. Reading the display is an action and needs the mic in hand; the
  close-up shows CH + number, a 3-bar battery gauge and a placeholder speaker-with-slash when muted
  (`"MUTE"` is also drawable: content `behaviour.muted_indication.glyph`).
- **Hands:** two slots, one mic at a time (content `behaviour.hands`, owner undecided).
- **The chair left of FOH** (owner, tentative) is where checked mics go; the harness shows it as a
  text box, since it isn't in any photo. Mics on it can be picked up again.
- **Visible step list** (content `procedure`, wording tentative): take the next mic in colour order;
  put its batteries in (*not simulated yet*); read its display; talk at the X32; put it on the chair.
  It ticks for the mic in hand, then moves to the next.
- **"Check the rest"** (principle 4.10): offered after 3 mics verified by hand, with empty hands. It
  is a macro of the same basic actions, so it produces the same evidence and costs the same game time.
  It stops at the first mic whose display is blank or muted or whose X32 input is silent, leaving
  that mic in hand at the X32. The debrief reports by-hand vs skip counts and any stop.
- **Room for battery faults, not built:** `state.battery` (`"ok"`) gates power-on; content
  `future_faults` lists `battery-reversed` / `battery-dead` as data; a test proves the skip stops on one.
- Harness fix: toasts no longer swallow taps on the hotspots under them.
- `PRODUCT_DESIGN.md` section 45: round-3 owner answers recorded (16 mics, chair, mute is a stage fault).

### What was tested
| Check | Result |
|---|---|
| `node --test tools/gameplay-slice/test/engine.test.mjs` | 21/21 (was 14): adds hands, chair, display, step list, skip gating, skip completion, skip stop at ch 9, battery-fault stop, 16-mic content |
| Mutation check | breaking each of these fails a test: skip never stops, skip offered at once, reversed battery powers on, two mics in hand, skip evidence counted as by-hand, stale evidence counted. (A redundant battery check in `passes()` survived, so it was removed.) |
| `node tools/gameplay-slice/test/harness.e2e.mjs` (iPhone 13) | all pass: 3 mics by hand incl. the muted one (notice, trace at receivers, fix, verify), then Check the rest -> 16/16, debrief, no sideways scroll, no page errors |
| Scene-graph checks (`validate.py`, `walk-touch.mjs`, `hotspots.mjs`) | all pass; nothing in the editor or graph changed |
| Published harness | version 2 = byte-identical to a fresh build of the harness commit |

**Not tested:** a real phone; the published page itself in the artifact viewer (the local build passes).

### Needs the owner
- ~~Step list wording~~ replaced by the owner's own procedure (2026-09-28). Whether the checked mic really goes on the chair ("probably": kept tentative).
- ~~Which channels are the spares and the talkback~~ answered: 14-16 are interchangeable spares (any can be talkback or a replacement).
- ~~Muted display photo~~ optional; the placeholder is fine with the owner.
- ~~Hands~~ answered: allow two.
- ~~Clock~~ answered: checks made faster for now; real timing later (section 40 still puts battery
  preparation before 4:50, which a later scenario pass should reconcile).

### Next build session (suggested; ask the owner before starting)
1. Nothing is waiting on the owner for this slice. A spare could later become the "emergency
   replacement" mechanic (the A2 runs a spare to the stage when a mic dies), which fits the battery faults.
2. Battery faults for real: put batteries in as a step, `battery-reversed` / `battery-dead`, and the
   4.10 rule that the skip is offered only after the player has met them (or keeps stopping on them).
3. The on-stage line check as its own scenario, where the mute fault moves to; then Monitor 1 /
   FOH talkback once the transport facts are confirmed (session 1's step 3).

## Session 2 sync status
- Live editor page: **not republished**; still Artifact version 27. Live DB: owner edits up to **v337**,
  pulled into the repo on 2026-09-28 (identical). No DB writes this session.
- Harness artifact: version 1 (the original v1 page, no owner changes) was read and then replaced by
  **version 2**, then versions 3-7 after the owner follow-ups.

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
- `content/vj-line-check.json` (renamed `vj-battery-in-check.json` in session 2): devices, connections, what each scene's meters show, fault, objective,
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

### Room facts: owner answers (2026-09-27, now in `content/vj-battery-in-check.json`)
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

### Next build session: harness v2 (brief) — done in session 2, see the top of this file
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
2. **Agent, safe now:** fold the answers into `content/vj-battery-in-check.json` (values, not code); run
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

## Final state of session 1
- Last code/data commit: `7f63631`. The commit that adds this final version of this file comes right
  after it (`git log -1 -- docs/IMPLEMENTATION_STATUS.md`); nothing else changed after that.
- `main` and `claude/compassionate-volta-5zruvy` point at the same commit; working tree clean.
- Live editor: Artifact version 27 = a fresh build of that commit (diffed); live DB v270 =
  `docs/scene-graph.json` (diffed). Harness: https://claude.ai/artifact/ALCrp7izY5q8rVima8tn1R, version 1.

## Final state of session 2
- Branch `claude/charming-faraday-bhf0vx`, based on `66c7240`: engine/content, harness, docs, then the
  owner follow-up (faster, roles, two hands) and its docs. Working tree clean after the docs commit.
- Harness: https://claude.ai/artifact/ALCrp7izY5q8rVima8tn1R version 7 (the bad mic).
- Public site: built from `main` by `.github/workflows/pages.yml` (needs the one-time Pages setting).
- **Merged to `main`** (fast-forward, owner-approved 2026-09-27); `main` = the session branch.
- Live editor / DB unchanged (version 27 / v270).
