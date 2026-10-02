# Salmon Simulator — Product Design Source of Truth (v2)

**Repository:** `salmon`  
**Document role:** durable product/design source of truth  
**Pair with:** `docs/SESSION_HANDOFF.md` for current implementation state  
**Revision:** v2, created after the first full photo/scene-graph prototype pass  
**Current machine-readable snapshot reviewed for this revision:** 63 scene nodes, 75 edges, 63 manifest rows

---

# 0. How to Use This Document

This file answers:

> **What are we building, why are we building it, what is true about the real room, what is intentionally still uncertain, and what must future agents preserve?**

It is **not** a line-by-line implementation manual. The current code/prototype state belongs in `docs/SESSION_HANDOFF.md`, the scene-graph editor README, and the repository itself.

Future agents should read this document before making product-level decisions.

## Status labels used throughout

- **[LOCKED]** — core product decision; do not casually redefine.
- **[CURRENT FACT]** — current owner-confirmed room/equipment/workflow truth as captured in the project.
- **[PROTOTYPE FACT]** — true of the current prototype/repository snapshot.
- **[TENTATIVE]** — useful working assumption; field-calibrate before hard-coding as permanent truth.
- **[UNKNOWN]** — explicitly unresolved; do not invent.
- **[FUTURE]** — intentionally later, not MVP.
- **[MAYBE]** — idea worth preserving without commitment.

## Authority when sources conflict

Use this precedence:

1. **Owner-confirmed current real-world observation**
2. **Current synced machine-readable room/scene data**
3. **This product-design document for product/pedagogy intent**
4. **Current implementation handoff/code for what exists today**
5. **Older notes, historical chat, backlog ideas**

A current implementation may lag product intent. A product document may lag a newly changed physical room. Do not treat either as timeless room truth.

---

# 1. North Star

## Core sentence

> **THE GAME TEACHES YOU TO SEE THE SYSTEM.**

**[LOCKED]**

The Salmon Simulator is a mobile-first educational point-and-click simulation for teaching:

- live sound,
- signal flow,
- troubleshooting,
- concert recording workflow,
- equipment operation,
- spatial/procedural memory,
- and professional production behavior.

The first environment is **Salmon Recital Hall**, but the long-term architecture should support additional rooms, device variants, and workflows.

The interface is temporary.

The mental model is the product.

A learner should eventually enter the real room and instinctively ask:

- What is supposed to happen?
- Where does the signal start?
- Where should it go next?
- What evidence do I have?
- Where was the last known-good point?
- What changed?
- What should I touch?
- What should I *not* touch?
- How do I know the fix actually worked?

---

# 2. Learning Hierarchy

**[LOCKED]**

The simulator teaches in roughly this order:

1. **Spatial memory** — where gear lives
2. **Procedure** — what normally happens and in what sequence
3. **Signal flow** — how components connect
4. **Troubleshooting / diagnosis** — the main educational payoff
5. **Relevant console operation** — concept-first, not every button

A compact design summary:

> **Setup teaches language. Diagnosis is the game.**

The simulator is not intended to become a checklist app where the student memorizes a click order.

---

# 3. Core Diagnostic Loop

**[LOCKED]**

> **NOTICE → TRACE → ACT → VERIFY**

Example:

- **NOTICE:** Mic 6 has no signal.
- **TRACE:** Handheld → receiver → X32 input → bus/output → amp → speaker.
- **ACT:** Correct the actual fault.
- **VERIFY:** Speak into the mic and confirm signal at the receiver, console, and expected output.

The game should repeatedly reward this mental habit.

## Verification is first-class state

**[LOCKED]**

> **Fixed is not the same as verified.**

The engine should distinguish among:

- a control changed,
- the system likely became correct,
- evidence proved the system is correct.

Possible evidence:

- receiver shows RF/audio activity,
- X32 meter responds,
- Bus 1 has signal,
- output path has signal,
- expected speaker produces sound,
- known stereo playback reaches the expected channels.

This distinction is central to the educational value.

---

# 4. Product Principles

## 4.1 Accuracy over spectacle

**[LOCKED]**

Real spatial relationships and real signal-flow relationships matter more than flashy visuals.

## 4.2 Real photos are spatial truth

**[LOCKED]**

Use real Salmon photography as the primary navigable world.

Do not replace Salmon with a fully invented AI 3D room for the MVP.

The player should later walk into Salmon and recognize the space.

## 4.3 Device views may use a different visual language

**[LOCKED]**

Precise devices may use:

- cleaned photographs,
- close-up photographs,
- SVG overlays,
- simplified interactive diagrams,
- selective emulator-style views.

Spatial scenes and device-control views do not need to use the exact same rendering technique.

## 4.4 Mobile portrait first

**[LOCKED]**

Mobile portrait is a primary student use case.

Desktop should remain responsive.

Source photos must **not** be destructively cropped merely to fit portrait.

Runtime may use:

- contain/letterbox,
- cover/crop,
- focal positioning,
- pan/zoom,
- scene-specific treatment.

## 4.5 No critical hover-only interaction

**[LOCKED]**

Anything required for play must work on tap.

## 4.6 Mistakes should be real

**[LOCKED]**

Players should be able to make authentic mistakes:

- unplug cables,
- turn off equipment,
- mute channels,
- misroute signal,
- change gain,
- select the wrong output,
- carry the wrong object,
- forget gear,
- create silence,
- cause feedback.

The simulator should not protect the learner from every error.

## 4.7 No soft-locks

**[LOCKED]**

The player should always have a recoverable path.

Catastrophic mistakes can be memorable and dramatic, but the game should support a **Safety Rewind / Undo** rather than forcing a long replay.

## 4.8 Current reality and best practice are separate concepts

**[LOCKED]**

Salmon is a real evolving room.

The simulator should be capable of teaching both:

- **what is actually done in Salmon today**
- **what the safer/cleaner/general professional practice would be**

Do not silently rewrite current room practice to match textbook expectations.

## 4.9 Professional vocabulary stays professional

**[LOCKED]**

Use terms such as:

- preamp
- bus
- send
- Main LR
- HPF
- compressor
- gate
- AES50
- Dante
- stagebox
- power amp
- passive wedge
- line level
- speaker level
- XLR
- NL4/SpeakON
- impedance
- gain staging

Beginner mode may explain these terms; it should not replace them with vague game-only language.

## 4.10 Realism without monotony

**[LOCKED, owner 2026-09-27]**

Balance realism with playability. When a real procedure is routine and repetitive (checking mic
after mic the same way), let the player do it for real a few times, then offer a smart way to skip
the rest, such as "check the rest". The skip must still surface anything abnormal (it stops at the
first mic that fails) so it never skips the reasoning, only the repetition. Before offering it, the
game should make sure the player has met the kinds of problems it could hide (for example battery
problems), or the skip must still stop on them.

---

# 5. What Success Looks Like

The strongest validation is real-world transfer.

Ask whether students:

- find the correct rack faster,
- understand where equipment lives,
- identify upstream/downstream devices,
- explain why a mic has no signal,
- locate the last known-good point,
- verify before declaring a fix,
- distinguish line level from speaker level,
- identify speaker cable vs instrument cable,
- recognize the same mixer concepts on X32 Compact,
- make fewer random console changes,
- restore the system more professionally,
- recover from faults more systematically.

A polished game that does not improve these behaviors has missed the point.

---

# 6. Current Build Phase

**[PROTOTYPE FACT]**

The project is currently **a spatial/navigation prototype**, not yet a gameplay simulator.

The first major phase already accomplished:

- real photo library organized,
- semantic scene graph created,
- a first-person Walk view created,
- map and floor-plan editing tools created,
- walk/turn/closeup transitions working,
- mobile-width layout tested,
- device closeups navigable,
- spatial relationships partially calibrated.

**There is no actual gameplay/device-state engine yet.**

No current gameplay logic exists for:

- device power state,
- wireless faults,
- signal propagation,
- objective completion,
- scoring,
- inventory,
- X32 controls,
- troubleshooting,
- character dialogue.

That is the next major product layer, not something to assume already exists.

---

# 7. Current Prototype Snapshot

**[PROTOTYPE FACT]**

At the snapshot used for this v2:

- **63 scene/photo nodes**
- **75 graph edges**
- **38 walk edges**
- **8 control edges**
- **29 closeup edges**
- **19/63 nodes currently have floor-plan poses**
- **10/29 closeup edges currently have authored polygon hotspots**

Current node kinds include:

- hubs
- waypoints
- closeups
- screens
- alternates
- characters
- omitted images

The photo library/manifest and graph both currently contain **63 records/nodes**.

An earlier `ASSET_STATUS.md` sentence says 62 HEICs were converted; the current machine-readable manifest/graph snapshot is 63. Treat the manifest/graph as the current count and the older prose count as historical.

---

# 8. Current Prototype Architecture

**[PROTOTYPE FACT]**

The existing interactive prototype is intentionally simple:

- plain HTML/CSS/vanilla JavaScript,
- single-file source in `tools/scene-graph-editor/template.html`,
- no frontend framework,
- no WebGL,
- no 3D engine,
- SVG for graph/plan/hotspot geometry,
- CSS transforms/clip-path/WAAPI for Walk transitions.

The current tool provides three major views:

## Map

- graph nodes/edges,
- draggable scene layout,
- scene-kind filtering,
- pan/zoom,
- graph export,
- edge/link authoring.

## Plan

- approximate top-down Salmon floor plan,
- camera position,
- camera heading,
- draggable placement,
- plan-derived distance/turn inspection.

## Walk

- real-photo first-person navigation,
- walk arrows,
- turn controls,
- route planning,
- chained moves,
- inset/closeup hotspots,
- reverse closeup transitions,
- portrait/landscape handling,
- mobile-width layout.

This prototype is valuable design evidence.

It should not automatically be treated as the final production architecture.

## Current QA caveat

The prototype has been repeatedly exercised in-browser and at emulated phone widths, including about 390 px wide, but the handoff explicitly notes that it has **not yet had a real-phone QA pass**. Treat current mobile behavior as promising, not fully validated.

---

# 9. Artifact Synchronization — Critical Caveat

**[PROTOTYPE FACT / IMPORTANT]**

The interactive prototype has been running as a **published claude.ai Artifact**.

The project owner has edited the live Artifact directly:

- moving camera positions,
- drawing hotspot polygons,
- adjusting arrows,
- editing plan positions.

Those live changes save to the Artifact's own database and **do not automatically enter Git**.

Therefore:

> **Never assume `docs/scene-graph.json` is current without checking the live Artifact state first when Artifact access is available.**

Current Artifact URL is documented in the scene-graph editor README / session handoff.

## Agent rule

Before editing scene-graph data:

1. read `docs/SESSION_HANDOFF.md`,
2. read `tools/scene-graph-editor/README.md`,
3. sync or compare the live Artifact data,
4. commit the sync as a clean checkpoint if drift exists.

If an agent does **not** have Artifact/ArtifactData access:

- say so explicitly,
- do not silently edit a possibly stale scene graph,
- work on safe non-divergent tasks.

This is a data-integrity rule, not a product preference.

---

# 10. Scene Graph Concepts

**[LOCKED at concept level]**

The world is a flexible graph.

A typical interaction is:

> **scene image → tappable hotspot/control → target scene**

Runtime computer vision is not required.

Hotspots may be:

- polygons,
- rectangles,
- direction controls,
- device regions,
- explicit turn controls.

## Current node concepts

A scene node may include:

- file
- region
- kind
- label
- source image provenance
- people flag
- editor map coordinates
- optional floor-plan coordinates
- optional camera heading

## Current edge concepts

An edge may include:

- source
- destination
- kind
- motion
- turn amount
- icon direction
- travel distance
- icon placement
- hotspot polygon
- notes

The exact schema can evolve, but the semantic distinction among these concepts is important.

---

# 11. Motion Semantics

**[PROTOTYPE FACT / PRESERVE CONCEPT]**

Current navigation discovered an important distinction:

- **`dir_degrees`** = where the on-photo arrow points
- **`turn_degrees`** = how much the camera rotates
- **`distance_m`** = how far the player/camera travels

These are not interchangeable.

Arrow screen position is also independent of semantic direction.

This separation should survive any eventual architecture rewrite.

## Walk vs control vs closeup

Current concepts:

- **walk** — spatial movement
- **control** — orientation/reposition action, e.g. turn around / go around back
- **closeup** — inspect/zoom into a device or detail

Closeups do not need the same motion model as walking.

---

# 12. Approximate Floor-Plan Model

**[PROTOTYPE FACT]**

The prototype uses a lightweight 2D floor-plan model rather than full 3D reconstruction.

Known plan dimensions used:

- approximately **61'9" × 54'6"**
- represented as **18.8 m × 16.6 m**

The supplied drawing was not perfectly to scale; it was traced/stretched as an approximation.

Current coordinate convention:

- origin near back-of-house apex,
- `plan_x` toward the stage,
- `plan_y` house-left → house-right,
- heading 0° toward stage,
- heading +90° toward house right.

Camera poses are:

- estimated,
- owner-adjustable,
- partly informed by photo geometry,
- not survey-grade truth.

**Do not turn approximate plan coordinates into falsely precise room facts.**

---

# 13. Photo-Based Motion, Not Photogrammetry

**[LOCKED for MVP direction]**

No full 3D reconstruction is required.

The current prototype creates spatial continuity through:

- authored photo adjacency,
- approximate floor-plan placement,
- camera-facing direction,
- walk/turn animations,
- hotspot zooms.

This is the intended practical direction.

A true 3D reconstruction may be reconsidered much later if compelling, but should not become an MVP dependency.

---

# 14. Current Navigable World

**[PROTOTYPE FACT]**

The current graph supports navigation through a meaningful portion of Salmon.

Core flow includes:

- outside entry
- first entry
- path toward the center
- center-wide
- FOH
- FOH rear
- crossroads
- stage-side racks
- rack rears
- musician POV / center stage
- upstage-back view
- storage path
- storage entrance
- storage closet

## High-level topology

### Outside → First Entry
The player begins outside and enters Salmon.

### First Entry
From here the player can:

- move toward stage-side racks,
- move toward center/FOH,
- look/turn toward the right-side wall/network-panel area.

### Center / FOH
Center-wide connects to FOH and deeper room navigation.

### Crossroads
A central navigational decision point.

It connects toward:

- house-left/stage-side racks,
- storage direction,
- stage/musician POV,
- back toward center/entry.

### Stage-side
Front and rear rack views.

### Stage
Musician POV and upstage-back view.

### Storage
Entry and closet, with closeups for gear/carts/latch.

---

# 15. Important Current Scene Details

**[PROTOTYPE FACT]**

## `outside-entry`
Only intended initial exit is into `first-entry`.

## `first-entry`
First interior orientation point.

## `first-entry-look-right`
A look/turn from first-entry, not a walking waypoint.

A measured/estimated relative turn of about 53° was used.

## `first-entry-rj45-ports`
Temporary placeholder view.

**[TENTATIVE / RETAKE NEEDED]**

It uses a cropped older image as a stand-in for a future proper network-panel photo.

Do not treat this placeholder as permanent visual truth.

## `path-entry-to-center`
Current single waypoint between first-entry and center-wide.

## `center-wide`
Whole-hall view near FOH.

## `crossroads`
House-center decision point facing stage.

## `racks-front-wide`
Primary stage-side rack front hub.

## `racks-rear-wide`
Rear rack/power view.

## `foh-wide`
Primary FOH hub.

## `foh-rear-wide`
Reached as a turn/control relation rather than a conventional walk.

## `musician-pov`
Center-stage view with wedges at the player's feet.

## `upstage-back-wide`
Furthest-upstage look toward the hall.

## `storage-entry`
Approach to storage doors.

## `storage-closet`
Interior storage hub.

---

# 16. Route Planning / Movement Time

**[PROTOTYPE FACT / PRODUCT-ALIGNED]**

The current prototype can compute routes and play chained photo transitions.

Long-term product behavior should preserve the idea that movement has cost.

Approximate relative cost matters more than perfect seconds.

Examples:

- X32 ↔ nearby FOH rack: seconds
- FOH ↔ stage-side: short
- Salmon ↔ storage: longer
- future Salmon ↔ upstairs BH rooms: meaningfully longer

Avoid cluttering beginner gameplay with exact travel seconds unless useful.

Game time may be compressed.

Pause should pause scenario time.

---

# 17. Hotspot / Inset Philosophy

**[LOCKED concept]**

A device closeup should feel like inspecting the actual object in the room.

Current prototype interaction:

- polygon drawn around device in wide scene,
- tap polygon,
- exact region grows into closeup,
- fixed Back action returns to parent view.

This is a strong interaction pattern and should be preserved conceptually even if implementation changes.

Current prototype has authored polygons for only part of the closeup graph; remaining closeups can still be reached through fallback UI.

---

# 18. Photo Aspect-Ratio Strategy

**[LOCKED]**

Never assume every useful photo has the same aspect ratio.

Many device shots are portrait.

The current prototype correctly learned that cropping portrait rack photos into a landscape stage can remove the very device being taught.

Preferred behavior:

- preserve source composition,
- choose display treatment at runtime,
- use contain/letterbox when needed,
- use blurred/darkened continuation if aesthetically useful,
- avoid crop-snap during transitions.

This principle becomes even more important in a portrait-first student UI.

---

# 19. Asset Pipeline

**[PROTOTYPE FACT / PRESERVE]**

Current working-photo pipeline:

- source HEICs retained locally,
- JPG working copies around 2400 px long edge,
- approximate JPEG quality around 85,
- GPS metadata stripped before committing,
- orientation baked in,
- working photos committed,
- originals gitignored/local.

**Repository is public. GPS-stripping is not optional for new committed room photos.**

## Folder organization

Working photos are grouped by scene, not shoot round.

Current scene folders include:

- `intro`
- `house`
- `path`
- `stage`
- `stage-side`
- `foh`
- `storage`
- `characters`

Subfolders may include:

- `closeups`
- `screens`
- `_alts`

Shoot batch remains metadata, not the primary folder structure.

---

# 20. Asset Naming

**[PROTOTYPE FACT / GOOD CONVENTION]**

Current naming conventions:

- lowercase
- hyphenated
- semantic
- no `salmon-` prefix
- numeric suffix only when truly necessary
- named devices may omit area prefix
- generic objects keep contextual prefix
- alternates use `-alt1`, `-alt2`, etc.
- working basenames remain globally unique

This allows photo basename to double as a scene ID.

Old `IMG_####` provenance remains in `manifest.csv`.

---

# 21. Asset Manifest

**[PROTOTYPE FACT]**

`manifest.csv` is the human-curation/provenance record.

Useful fields include:

- source/batch
- old filename
- working filename
- scene group
- scene
- view
- devices
- role
- usefulness
- duplicate relation
- retake
- people flag
- notes

Do not destroy provenance during renaming.

---

# 22. People / Characters in Photos

**[CURRENT PROJECT FACT]**

Three photographed student character nodes currently exist:

- Cary
- Morgan
- Magnolia

They are currently orphan scene nodes and are **not yet part of gameplay/navigation**.

The owner requested these people as possible future characters.

## Guardrail

Do not invent their:
- personality,
- dialogue,
- role,
- location,
- behavior

without owner direction.

Faces are acceptable for the current MVP/reference phase per the existing asset notes, but character integration is a later design decision.

**Direction (Cary, collaborator and one of the three, 2026-10-01):** the battery-in check opens on a
title card where Cary, Morgan and Magnolia say "Relax, let's handle this!" after "OH NO! USingers has
only left you 10 minutes to set up for Vocal Jazz!". That line is theirs to give; nothing else about
the characters (personality, role, behaviour in play) is decided. Text lives in the slice content
(`intro`). USingers is the university choir that rehearses in the hall right before Vocal Jazz.
Cary, 2026-10-02: the player picks one of the three as a mentor, and hints come as that mentor's
speech bubbles. The hint text is the same whoever you pick: no personalities are decided.

---

# 23. Photo Retakes / Missing Visuals

**[CURRENT PROJECT FACT / BACKLOG]**

Known opportunities include:

- proper RJ45/network-panel photo from first-entry orientation,
- clearer mic-drawer view with both drawers,
- fuller FOH computer rear/cabling view,
- possible mains-rack version with lid/front piece,
- storage-door state variants,
- live-sound cart shown with all five wedges.

Do not block core gameplay on perfect photography.

---

# 24. Real-World Hardware — FOH

## Behringer X32

**[CURRENT FACT]**

Full-size X32, **not Compact**.

Main FOH console.

Wireless mics normally occupy channels 1–16.

Bus 1 = Monitor 1.

Important simulator concepts:

- power
- channel layers
- Select
- Mute
- fader
- Main LR
- preamp gain
- HPF
- EQ
- gate
- compressor
- buses
- Sends on Fader
- routing/input source/output assignment

Rear-panel concepts should eventually distinguish:

- analog I/O
- AES50
- Dante expansion/network roles
- control/network functions

The simulator does **not** need a complete clone of the X32 operating system.

## FOH IEM rack

**[CURRENT FACT / LATER GAMEPLAY]**

A rear FOH IEM-rack view exists in the current photo set, and project notes indicate the IEM system is fed from X32 outputs.

IEM operation is intentionally **not MVP gameplay**, but its physical presence should not be erased from the room.

## FOH Mac mini

**[CURRENT FACT]**

Normally left powered on.

Current/future uses:

- playback
- Logic
- multitrack recording
- Dante Virtual Soundcard

Asset notes indicate the Mac mini is physically mounted upside-down under the desk.

## SSL 2+

**[CURRENT FACT]**

FOH playback interface.

Working conceptual path:

> Mac mini → SSL 2+ → analog outputs → X32 aux inputs

Exact input pair should remain configurable until verified.

---

# 25. FOH Network / Recording Evidence

**[CURRENT FACT from current photo/reference set]**

Current photos/screens show:

- Logic using **Dante Virtual Soundcard** as input,
- Dante Controller showing a **1:1 routing**,
- X32 rear connectivity useful for teaching AES50 vs Dante vs analog wireless inputs.

These images are useful reference evidence.

They do not require a full Dante Controller simulator in MVP.

---

# 26. Wireless System

## Receivers

**[CURRENT FACT]**

Phenyx Pro PTU-6000 receiver system.

There are multiple units.

Project notes describe approximately 24 possible wireless channels total.

The current device reference labels units as 8-channel, but exact receiver/channel assumptions should still be checked against the actual installed hardware before making them irreversible rules.

Relevant state:

- power
- selected/active channel
- RF/audio indication
- output/gain
- frequency
- signal present/absent

## Handheld transmitters

**[CURRENT FACT]**

Important behavior:

- main button controls power and tap-to-mute behavior.

A powered-but-muted transmitter is the first intended troubleshooting fault.

## Color coding

**[CURRENT FACT]**

Known:

- Ch. 1–8 = black windscreens
- Ch. 9–16 = gray windscreens
- rainbow color order is used across sets

**[UNKNOWN]**

Exact full color-to-channel mapping beyond the currently confirmed grouping should remain editable until fully documented.

---

# 27. Battery Workflow

**[CURRENT FACT]**

Normal battery type:

> rechargeable AA NiMH

Fresh alkaline cells may be used for higher-stakes gigs.

Critical teaching rule:

> **Never put alkaline batteries on the rechargeable charger.**

This is suitable for a memorable high-severity training consequence.

## Current asset observations

- CITYORK rechargeable battery charger(s) exist.
- Exact charger count is currently uncertain.
- Asset notes say 16 or 18 may be present.
- A dedicated "bad/suspicious battery" bin would have high teaching value but **does not currently exist**.

Do not depict a bad-battery bin as current room reality unless one is actually added.

---

# 28. Stagebox / Mains Rack

Preferred full name:

> **Stagebox / Mains Rack**

Short UI name:

> **Mains Rack**

**[CURRENT FACT]**

Known contents:

- Mackie Mix5
- Middle Atlantic PD-915R power center
- Numark MP103 USB legacy/deactivated player
- Behringer S32
- Crown Com-Tech 210
- installed passive mains downstream

## Physical detail

The **S32 is mounted backwards** relative to the rack, so its front is visible from the rack-rear side while other rear panels are visible.

This is exactly the kind of room-specific fact the simulator can teach.

## Mackie Mix5 playback path

**[CURRENT FACT from photo pass]**

A real phone-playback path exists through the Mix5 using:

- 3.5 mm cable
- phone adapter(s), including USB-C/Lightning-type possibilities

This should eventually be represented as a valid signal-flow path.

---

# 29. Installed Mains

**[CURRENT FACT]**

Passive ceiling-mounted L/R speakers.

Exact speaker model is not important for MVP.

Driven by the Crown amp in the Mains Rack.

---

# 30. Monitor Amp Rack

Preferred full name:

> **Monitor Amp Rack**

Short UI name:

> **Monitor Rack**

**[CURRENT FACT]**

Known hardware:

- Furman M-8Lx
- Behringer NX3000
- Behringer KM750 ×2
- Crown Com-Tech 800

The NX3000 is the primary current amp for the Vocal Jazz wedges.

Different amps may be used for different setups.

Model physical amp instances separately rather than replacing the rack with one generic "amp."

---

# 31. Monitor Wedges

## Behringer Eurolive VP1220F ×3

**[CURRENT FACT]**

- passive
- 8 Ω
- NL4/SpeakON
- 1/4-inch speaker connectors
- label indicates 200 W continuous / 800 W peak

These are the principal three Vocal Jazz wedges.

## Behringer Eurolive VS1220F ×2

**[CURRENT FACT]**

- passive
- 8 Ω
- 1/4-inch speaker connectors only
- label indicates 150 W continuous / 600 W peak

Teaching point:

> Not every wedge offers the same connector options.

---

# 32. Subwoofer Beside Rack Area

**[CURRENT FACT from photo pass]**

A subwoofer with RCA input exists beside the amp racks.

For MVP:

- include/acknowledge it as a real device if it appears in scenes,
- **do not invent its routing yet**.

Routing is currently unspecified.

---

# 33. Stage-Side Power

**[CURRENT FACT]**

Photos reveal rack power plugs going to wall AC.

Those plugs can physically be unplugged.

This creates a useful troubleshooting distinction:

> Is the failure signal, control, or power?

Power cabling may therefore become interactive later.

---

# 34. Storage

**[CURRENT FACT]**

Storage includes relevant live-sound gear such as:

- monitor wedges
- carts
- stands
- cables
- Husky toolbox
- other event-specific carts

## Door latch

A manual latch/lever exists.

If the relevant door is left unlocked, the door can open without card access.

This is a possible mini-procedure/minigame.

**[MAYBE]** — do not let it distract from signal-flow MVP.

---

# 35. Other Network / Stage Devices

## Allen & Heath DT168

**[CURRENT FACT]**

Dante stagebox.

Physically present.

Currently not the primary active device in the evolving Salmon path.

## Possible Behringer SD8

**[FUTURE / NOT INSTALLED AS FACT]**

Considered for:

- extending/breaking up AES50 path,
- adding I/O,
- possible midpoint/repeater role.

Do not depict it as installed unless confirmed.

---

# 36. Evolving Signal Transport

**[LOCKED architecture requirement]**

Salmon transport must be configurable.

Do **not** encode one permanent routing topology as if it will never change.

Possible/currently relevant transports:

- analog backup
- AES50
- Dante

## Historical / current operational observations

**[CURRENT/HISTORICAL FACT]**

Dante has historically been reliable.

A long AES50 route produced dropouts.

Observed symptoms included:

- AES50 indicator instability,
- "Mute All" flashing,
- Sync indicator dropping/recovering.

A short direct X32 ↔ S32 cable worked after an X32 power cycle.

The long route may be too long / otherwise problematic.

## Analog fallback

**[CURRENT FACT]**

A practical fallback has used:

> X32 physical Output 14 → long XLR carrying line-level signal toward stage/amp system

## Historical network-development context

**[HISTORICAL / VERIFY BEFORE USING AS CURRENT CONFIG]**

The project has also explored a dedicated direct AES50 path from FOH X32 to the stage-side S32 while retaining Dante at FOH. The desired AES50 connection is point-to-point rather than switched Ethernet. A long building-cable path produced the dropout behavior described above, while a short direct cable was stable after a console power cycle.

A dedicated port/cable run and an intermediate stagebox/repeater approach were discussed as remedies. Because this infrastructure is actively evolving, these details are useful troubleshooting/history context rather than permanent scenario truth.

## Architecture implication

Keep separate:

- physical devices
- physical connections
- transport technology
- current routing configuration
- scenario configuration

---

# 37. Core Signal-Flow References

## Wireless input

> handheld → PTU-6000 receiver → XLR → X32 local analog input

## Monitor output

> X32 Bus 1 → current transport/output route → monitor amp → passive wedges

## Main output

> X32 Main LR → current transport/stage-side path → Crown amp → installed mains

## FOH playback

> Mac mini → SSL 2+ → X32 aux input(s) → mains and/or monitors

## Stage-side phone playback

**[CURRENT FACT, exact downstream use may vary]**

> phone / adapter → 3.5 mm path → Mackie Mix5 → downstream stage-side audio path

Exact use/routing should be confirmed before making it a required scenario step.

---

# 38. Canonical Operational States

**[LOCKED]**

There is no single "ideal room state."

Use meaningful checkpoints:

## START / HOUSE STATE
Normal resting condition.

## PRE-SOUNDCHECK
Gear deployed, patched, and powered enough to test.

## SOUNDCHECK
People/system interaction:
- line check
- gain
- monitor balance
- faults

## SHOW / REHEARSAL
Stable system:
- monitor
- diagnose
- correct

## RESTORE
Return room safely to resting state.

Canonical loop:

> **START → PRE-SOUNDCHECK → SOUNDCHECK → SHOW/REHEARSAL → RESTORE → START**

Faults, staffing, difficulty, and time pressure are modifiers layered onto these states.

---

# 39. Power-State Reality

## FOH

**[CURRENT FACT]**

- long office-style power strip runs under carpet
- normally remains on
- X32 is intentionally switched on/off
- Mac mini normally stays on
- wireless rack should be intentionally powered on/off via rack power/Furman rather than casually left on forever

## Stagebox / mains rack

**[CURRENT FACT / CURRENT PRACTICE MAY EVOLVE]**

- rack power distribution normally on
- Mackie Mix5 normally on
- main-speaker path may remain live in current practice

## Monitor amp rack

Typical sequence:

1. connect rack to wall power
2. Furman on
3. required amp(s) on

## Shutdown

Professional best-practice concept:

> amplification off first

Where current Salmon habit differs from ideal practice, label the difference rather than pretending it does not exist.

---

# 40. Vocal Jazz Scenario — Time Story

Working title:

> **Vocal Jazz — Ready by 5:00**

**[LOCKED as first major scenario]**

Timeline:

- **4:30 PM** — expected engineer arrival
- **4:50 PM exactly** — Salmon doors open; active gameplay begins
- **4:50–5:00 PM** — deployment/testing/troubleshooting
- **5:00 PM** — rehearsal should begin

Pre-4:50 story may mention:

- data transfer
- battery preparation
- other Recording Engineer duties

Time pressure provides realism.

Time should not be the only measure of success.

---

# 41. Vocal Jazz — Core Physical Workflow

**[LOCKED direction]**

At 4:50 the player should perform or participate in:

- entering Salmon,
- orienting to FOH/stage-side/storage,
- retrieving wedges,
- moving wedges to stage,
- connecting monitor chain,
- checking stage-side racks,
- checking power/amps,
- checking X32 readiness,
- testing known playback,
- testing mains first,
- testing Monitor 1,
- preparing wireless mics,
- distributing mics,
- talking through each mic,
- preparing one spare,
- correcting at least one fault,
- reaching READY.

---

# 42. Monitor Deployment

**[CURRENT FACT]**

Typical Vocal Jazz setup:

- 3 passive wedges
- one long NL4/SpeakON run from amp
- wedges daisy-chained
- Behringer NX3000 is the key current amp

Teaching concepts include:

- SpeakON/NL4
- 1/4-inch speaker connection
- speaker cable
- instrument cable
- line-level cable
- speaker-level signal
- impedance later

Important:

> Passive wedges do not have their own gain knobs.

The relevant gain is in upstream devices/amplification.

---

# 43. Test Order

**[LOCKED for first scenario unless field experience changes it]**

Use a known source first.

Suggested order:

1. known stereo playback
2. mains
3. Monitor 1
4. wireless microphones

This reduces the number of unknowns during troubleshooting.

**Owner note (2026-09-27):** keep this full order. For a rehearsal, the monitors are what the
musicians actually need, but knowing mains vs monitors is part of the education, so the scenario
still tests both.

Listen/check for:

- missing channel
- hum/buzz
- distortion
- dead speaker
- bad routing
- feedback/ringing
- unexpectedly silent output

---

# 44. FOH Test / Talkback Option

**[MVP/NEXT OPTION]**

A switched SM58 or spare wireless mic can serve as an FOH test/talkback source, potentially routed to monitors only.

This is useful for:
- confirming the monitor path,
- communicating between A1 and A2,
- testing without relying on a performer.

It is an option, not a required first-scenario mechanic.

---

# 45. Wireless Prep / Handoff

**[CURRENT WORKFLOW FACT]**

Player/A2 should:

- install/check good batteries,
- confirm receiver power,
- understand mic↔receiver/channel relation,
- preserve color order,
- speak into each mic as it is handed out,
- have one spare ready.

Line check is essential because the transmitter can be powered but muted.

Frequency scanning/pairing can come later.

**Two different mic checks (owner, 2026-09-27):**

- **Battery-in check at FOH:** as soon as batteries go into each mic, and before the mics go to the
  stage, check that each one produces signal. This catches battery and mute problems early, while
  the A2 is still next to the receivers and the console.
- **Line check (the official one):** later, with the mics in the musicians' hands on stage; each
  musician makes sound and the A1 confirms each channel at the X32.

The first gameplay slice's "line-check" is really the battery-in check and should be named that way.

**Owner answers, round 3 (2026-09-27):**

- **Mic count:** about 13 musicians, so 13 mics + 2 spares (in case one dies from bad batteries or
  frequencies) + 1 at FOH for the A1 to talk to the stage through the monitors = 16 mics to check.
  Which channels are the spares and the talkback mic is not yet recorded.
- **Where checked mics go:** "honestly probably a spare chair just next to FOH, off to the left"
  (tentative). The game may show it as a text box rather than a place on the map.
- **The on-but-muted fault belongs to the on-stage line check**, not the battery-in check (a freshly
  powered mic starts unmuted, since a power cycle clears the mute). The battery-in slice keeps it for
  now; it moves when the line check is built. In the slice, the muted mic is the 2nd or 3rd of the
  first three checked by hand.
- **Channels:** 1-13 are the musicians' mics; 14, 15 and 16 are three interchangeable spares kept at
  FOH: any of them can be the A1's talkback mic, or the emergency mic the A2 runs down to the stage to
  replace a dead one. **Carrying:** two mics in hand is fine. **Timing:** make each check faster for now;
  real timing gets adjusted later.

**Line check, from Cary (collaborator, 2026-10-02):**

- It happens after all the mics are ready. The singers talk into their own mics on the main Salmon
  stage, out past the mixer; the A1 is behind the mixer (the X32).
- It goes down the line one mic at a time, starting with black / red, making sure each mic works.
- What usually goes wrong: someone on stage switches off a mic that was already on, mutes it, speaks
  too quietly, or points it at the monitors and causes feedback.
- The wedges are part of the line check: they are fed from X32 Bus 1, and each channel's send on
  fader to Bus 1 sets how loud it is in the wedges.
- Also (2026-10-02): bad mics go back in the drawer; 32 charged batteries is right; spare batteries
  are in a bin near the FOH computer.

**Owner answers, round 4 (2026-09-28):**

- **The battery-in procedure, per mic:** grab the right mic (windscreen colour, then ring colour); put
  two batteries in from the charger (the charger then holds fewer); switch it on; talk into it and watch
  its meter at the X32, which is the win criterion; put it on the chair. Batteries are usually the right
  way round, but one of the first few mics could have them reversed: a good early fault.
- **Reading the mic's display is optional** when it works, and essential when troubleshooting.
- **Mic N is not RF channel N.** Each mic has its own group and channel number (a frequency), set by
  pairing with the receivers (a procedure of its own). For now every mic is assumed paired; an unpaired
  mic, or any other problem, is a "bad mic" that gets swapped for a spare. Pairing can be a later level.
- **Future scenario:** a mic dies on stage and the A2 runs a spare from FOH (14-16 are the spares).
- **Routing confirmed:** mic N -> receiver slot N -> X32 input N; only the RF group/channel differs.
  For the game, RF numbers may be seeded at random: about 6 groups x 6 channels, unique per mic, the
  same on the mic and its receiver slot.
- **UI direction:** the game should eventually be played on the photos themselves, with fewer extra
  boxes. For now, functionality and gameplay come first and cosmetics come later.

---

# 46. First Troubleshooting Fault

**[LOCKED]**

First fault:

> **One wireless mic is ON but muted.**

This should be intentionally simple.

Preferred learner path:

1. notice silence,
2. trace upstream,
3. inspect transmitter,
4. identify mute,
5. unmute,
6. speak into mic,
7. verify receiver activity,
8. verify X32 activity,
9. verify expected output.

Preferred hint ladder:

1. **Concept:** "No signal is reaching the receiver. Where could the problem be upstream?"
2. **Location:** "Inspect the handheld transmitter."
3. **Direct:** "The transmitter is muted. Unmute it and verify signal."

---

# 47. READY-by-5 State

The room should be in a condition where Vocal Jazz can begin without engineers still wondering whether the PA works.

## Power/infrastructure

**[CURRENT/TENTATIVE MIX]**

- FOH power strip already on
- X32 on/booted
- Mac mini available
- wireless rack powered
- Mains Rack operating as expected
- mains amplifier ready
- Monitor Rack connected/powered appropriately

## Physical

- 3 wedges positioned
- long speaker cable to first wedge
- daisy-chain correct
- monitor amp known/ready
- mains available

## X32

**[TENTATIVE FIELD-CALIBRATE]**

- wireless inputs ch. 1–16
- ch. 1–8 black windscreens
- ch. 9–16 gray windscreens
- faders roughly around -5 dB as a possible working start
- gain structure reasonably consistent
- Bus 1 = Monitor 1
- sends roughly around -5 to -10 dB as a tentative start
- Main LR safe
- HPF/basic EQ known
- no surprise processing states
- routing correct for current transport

The numerical gain/send values are **not immutable truth**.

## System proof

- playback verified through mains
- Monitor 1 verified
- wireless path verified
- one spare ready

---

# 48. Roles

## A2 — first playable role

**[LOCKED]**

A2 is the initial player role.

Responsibilities include:

- stage-side work
- batteries
- mic preparation
- mic handoff
- line checks
- physical checks
- monitor deployment
- stage-side troubleshooting

## A1

Responsibilities include:

- FOH
- console
- routing
- mains/monitors
- higher-level diagnosis

## Recording Engineer

**[LOCKED as secondary/bonus early role]**

Recording Engineer duties are a secondary hat in the first version.

A1/A2 may also handle recording tasks.

Roles are responsibilities, **not permissions**.

The player can roam and interact outside the nominal role.

---

# 49. Mentor NPC

**[LOCKED for first tutorial]**

The first A2 tutorial includes an A1 mentor.

Style:

- short
- practical
- coworker-like
- not lecture-heavy

Mentor can give operational direction.

Deeper "why" learning should often come from:

- hints
- Codex
- signal-flow map
- debrief

Possible mood/personality modifiers:

- friendly
- neutral
- stressed
- hangry
- patient
- rushed

Mood may affect tone and volunteered help.

Technical truth never changes.

Critical progress never depends on mood.

MVP mentor instructions are trustworthy.

---

# 50. Staffing Modifiers

**[FUTURE-READY, not necessary for earliest playable build]**

Possible staffing states:

- on time
- late
- late + notified
- late + no notice
- no-show
- working alone
- absurd/random flavor event

Staffing changes:

- workload
- available help
- time pressure
- presentation

It must not change technical truth.

---

# 51. Interaction State Model

Future gameplay should separate several kinds of state.

## Physical state

Examples:

- device present
- device moved
- cable connected
- cable disconnected
- plug connected to AC
- wedge positioned

## Device state

Examples:

- powered
- muted
- fader value
- preamp gain
- bus send
- processing bypass
- routing assignment
- battery installed

## Signal state

Examples:

- signal exists at source
- reaches receiver
- reaches console
- reaches bus
- reaches output
- reaches amplifier
- reaches speaker

## Objective state

Examples:

- not started
- in progress
- mechanically satisfied
- verified complete

## Verification state

Evidence that proves an objective.

## Assistance state

Examples:

- hints used
- map visible
- Codex opened
- fault highlighting active

## Scenario state

Examples:

- game time
- role
- staffing
- fault set
- difficulty
- seed

Keeping these concepts separate will make troubleshooting and debrief much more meaningful.

---

# 52. Direct Manipulation

Obvious controls should be directly manipulable when practical:

- power switch
- mute
- fader
- battery
- cable end
- output/input selection
- physical plug

A student should not need to open a generic menu to perform every physical action.

---

# 53. Inspect Mode

Inspecting a device can reveal:

- current state
- current value
- professional term
- what the device is doing in the path
- relevant connection
- expected/normal range in easier modes

Beginner priority:

1. current state
2. current purpose
3. signal-flow relation
4. optional expected range

Harder modes reduce explanatory overlays.

---

# 54. Physical Carrying / Inventory

**[LOCKED concept, implementation flexible]**

Physical logistics should matter.

Possible model:

- left hand
- right hand
- pockets
- bag/cart later

Examples:

- bulky speaker uses both hands
- cable can be carried
- DI box can be picked up elsewhere
- battery can remain in pocket accidentally
- forgotten equipment can cause extra travel

This is not an RPG inventory.

It teaches planning and physical production workflow.

---

# 55. Objectives

**[LOCKED]**

Beginner mode should show visible objectives.

Objectives describe goals, not recipes.

Good:

> Get Monitor 1 working.

Avoid:

> Click Bus 1, enable Sends on Fader, move fader to X.

Whenever possible, completion occurs only after verification.

Example toast:

> Signal verified: receiver → X32 → Monitor 1.

Use brief non-blocking feedback.

Preserve a scenario log for debrief.

---

# 56. Hint System

**[LOCKED]**

Layered hints:

## Level 1 — concept
Help the student reason.

## Level 2 — location
Narrow the system area.

## Level 3 — direct action
Reveal the concrete fix.

Beginner:

- hint button available
- automatic nudge after inactivity or repeated ineffective action

Intermediate:

- fewer automatic nudges

Hard:

- stronger hint cost
- less assistance

Hints should scaffold troubleshooting, not bypass it immediately.

---

# 57. Codex

**[LOCKED concept]**

The Codex is an in-game knowledge/reference system.

Possible content:

- terms
- signal-flow concepts
- equipment references
- diagrams
- mini-checklists
- worksheet-style prompts
- unlocked notes

Possible progression:

- encounter concept → partial entry
- use + verify concept → fuller entry

Opening Codex during a live scenario may cost small game time.

Hard/expert mode may disable it.

---

# 58. Signal-Flow Map

**[LOCKED concept]**

Separate from Codex.

May show:

- ideal path
- live/current path
- device state
- connection state
- how far signal currently reaches

Difficulty:

- Beginner: visible
- Intermediate: reduced
- Hard: hidden

Important:

> Showing where signal currently reaches is itself a hint.

The map should train students to read conventional real-world signal-flow diagrams, not only game-specific graphics.

---

# 59. Device Simulation Philosophy

The game should simulate **conceptually meaningful controls**, not every control.

For the X32, the important teaching surface includes:

- power
- layers
- Select
- Mute
- fader
- preamp
- HPF
- EQ
- gate
- compressor
- buses
- Sends on Fader
- Main LR
- input/output routing

Real mistake to preserve:

> changing compressor settings while the compressor is bypassed.

A full X32 OS clone is unnecessary.

---

# 60. Console Learning Is Transfer Learning

**[LOCKED]**

The X32 is not the educational endpoint.

Concepts are.

Teach:

- gain
- mute
- fader
- bus
- send
- Main LR
- routing
- processing state

Then prove transfer with X32 Compact in OH B01.

---

# 61. OH B01 X32 Compact Variation

**[LOCKED as an MVP/early architecture proof]**

OH B01 contains an X32 Compact.

The point is to show that:

> the same concept can appear on different physical hardware/layout variants.

This is a key reason to distinguish:

- device type
- device variant
- physical instance

Do not create an entirely separate engine for B01.

---

# 62. Cable Literacy

The simulator should eventually teach the distinction among:

- XLR mic/line cable
- 1/4-inch instrument cable
- 1/4-inch speaker cable
- NL4/SpeakON
- Ethernet carrying AES50
- Ethernet carrying Dante/network/control
- USB/data connections

Key lesson:

> **If it physically fits, that does not mean it is electrically/functionally correct.**

---

# 63. Scoring / Debrief

Avoid a giant arcade score as the dominant feedback.

Suggested debrief categories:

- ✅ system ready/restored
- 🧠 diagnostic quality
- ⏱️ efficiency
- 🆘 help used
- 📚 concepts mastered

Debrief may explain:

- what failed
- what learner noticed
- what learner changed
- how learner verified
- unnecessary actions
- extra trips
- hints used
- regressions created/fixed

Do not shame a student who solved the system inefficiently.

---

# 64. Diagnostic Quality

A player may stumble into a working system.

If the system genuinely works, allow progress.

But the debrief can distinguish:

- systematic diagnosis
- lucky clicking
- unnecessary changes
- strong verification
- repeated regressions

The game should teach better thinking without creating arbitrary "wrong solution path" locks.

---

# 65. Failure Severity

## Minor
Examples:
- inefficient route
- unnecessary action
- small procedural miss

## Serious
Examples:
- risky power sequence
- avoidable interruption
- repeated bad routing

## Catastrophic
Examples:
- sustained feedback/howl
- serious unsafe battery behavior
- dramatic major error

Catastrophic failure may be visually absurd/funny.

Then use Safety Rewind.

Learning > punishment.

---

# 66. Procedural Scenario Generation

**[LOCKED concept]**

"Procgen" means **procedural scenario generation**, not procedural room generation.

The room remains canonical.

Variables may include:

- selected fault
- battery state
- cable state
- routing error
- power state
- staffing
- time pressure
- combinations

Use reproducible seeds.

Example:

> `VJ-48217`

Seed may be visible in debug/instructor mode.

Normally hidden from students.

---

# 67. Modes

## Sandbox / Debug

- inspect ideal state
- break anything
- observe consequences
- useful to students/instructors/developers

## Guided Training

- procedure
- terminology
- hints
- scaffolding

## Scenario Game

- known system
- unknown fault(s)
- time/context
- diagnosis

## Hard / Expert

- less Codex
- hidden map
- no fault highlighting
- fewer hints

---

# 68. Difficulty Progression

## Beginner

- visible goals
- easy hint access
- signal-flow map
- device explanations
- expected ranges
- subtle warnings

## Intermediate

- less map detail
- fewer highlights
- fewer automatic hints

## Hard

- hidden map
- no fault highlight
- reduced Codex
- stronger hint cost

## Expert

- minimal assistance
- potentially no Codex
- realistic ambiguity

---

# 69. Scenario Progression

Suggested progression:

1. muted wireless path
2. dead monitor path
3. randomized simple faults
4. multiple plausible causes
5. staffing/time pressure
6. reduced mentor help
7. independent A2 setup
8. later A1 responsibility
9. eventually player trains someone else

---

# 70. Teardown / Restore

For early MVP:

- require safety-critical restore actions,
- abstract mundane cleanup if necessary.

Safety-critical examples:

- amps handled safely
- wireless rack intentionally shut down as appropriate
- batteries sorted correctly
- no alkalines on rechargeable charger

A "cleanup fairy" abstraction is acceptable early.

Full playable teardown can come later.

---

# 71. Game Time / Travel

Time pressure is context, not the only win condition.

The player should care about:

- readiness,
- correctness,
- professional behavior,
- diagnostic quality,
- efficiency.

A slightly slower correct setup can still be better than fast random clicking.

---

# 72. Scenario Logging

Future engine should consider logging:

- scene transitions
- inspections
- power changes
- mute changes
- gain/routing changes
- cable changes
- inventory actions
- hints
- Codex/map use
- verification attempts
- successful evidence
- regressions

This supports:

- debrief
- debugging
- classroom analytics
- scenario replay

---

# 73. Professionalism Layer

Professional behavior can be taught through mechanics rather than a giant professionalism meter.

Examples:

- arriving with enough time
- preparing a spare
- checking each mic
- communicating with A1/A2
- minimizing random changes
- verifying readiness
- restoring room
- protecting equipment

---

# 74. Tone

The experience should feel:

- practical
- professional
- slightly playful
- occasionally absurd
- not childish
- not overloaded with exposition
- realistic enough to build confidence
- forgiving enough for experimentation

Coworker language is preferable to tutorial-bot language.

---

# 75. Humor / Flavor

**[FUTURE/MAYBE]**

Possible flavor:

- absurd catastrophic visual consequence
- mentor being hangry
- unusual staffing mishap
- experienced-engineer Easter egg
- "audio horror" skin/DLC

These are fun because the underlying system is serious.

Do not prioritize them over the educational engine.

---

# 76. Simple Secondary Scenario

**[MVP/NEXT]**

A one-mic + backing-track / karaoke setup in Salmon is useful because it proves:

- source
- mixer
- output
- mic
- playback
- mains

with lower complexity than Vocal Jazz.

---

# 77. Future Gig Types

**[FUTURE]**

Possible later scenarios:

## Concert/show
More mains/FOH/higher stakes.

## Commercial Music Ensemble
Potential:
- keyboard
- vocal/piano mics
- additional monitors

## Mariachi
Potential:
- section leaders
- multiple monitor mixes

## Portable recording
- carts
- interfaces
- stereo mics
- field setup

## Full Salmon recording
- audio/video capture
- Recording Engineer workflow

## Musco
- different environment
- multiple rooms
- heavier video role
- backend signal flow not fully known

Do not invent Musco infrastructure.

## IEM
Later, not MVP.

---

# 78. Audio / DSP Simulation

**[FUTURE]**

Web Audio / DSP may eventually simulate:

- gain
- HPF
- EQ
- compression
- reverb/effects
- feedback
- clicks/pops
- rumble/ring
- howl

Possible severity:

- clicks/pops: moderate
- ring/rumble: minor/moderate
- sustained howl: catastrophic

Do not block first gameplay on sophisticated DSP.

---

# 79. Recording / Dante Future

**[FUTURE / PARTIAL CURRENT REFERENCE]**

Current room evidence includes Dante Controller and Logic/DVS.

Future multitrack workflow may include:

- X32 source/card routing
- Dante Controller
- Dante Virtual Soundcard
- Logic input configuration

Full Dante Controller simulation is not required for V1.

---

# 80. Instructor / Debug Mode

Instructor/developer tools should eventually expose:

- scenario seed
- selected fault(s)
- expected state
- actual state
- live signal reachability
- objective state
- verification evidence
- hints used
- active modifiers
- player inventory
- current location

This is useful for teaching and debugging.

---

# 81. Field-Test / Real-Gig Feedback

**[FUTURE but valuable]**

Students may eventually use the app around real gigs to compare simulation with reality.

Possible in-app issue report:

- location
- scene
- device
- scenario
- simulated state
- observed real-world state
- note/photo

This project should be easy to correct when Salmon changes.

A GitHub Issue workflow may be appropriate.

---

# 82. Architecture Principles for the Real App

**[LOCKED at principle level]**

The long-term product should behave like a reusable training engine populated with room/device/scenario data.

But:

> **Do not abstract prematurely.**

The first real engine should be built from actual Salmon needs.

Prefer:

- data-driven room truth
- configurable signal routes
- reusable device concepts
- explicit scenario state
- clear separation of content and presentation

Avoid:

- giant generic simulation framework before the first gameplay works
- room facts scattered through UI code
- hard-coded forever-routing
- separate codebase per room

---

# 83. Recommended Conceptual Layers

Potential layers:

## Spatial graph
Where can the player move?

## Device graph
What physical devices exist?

## Connection graph
How are devices physically connected?

## Signal graph
Where can valid audio propagate right now?

## State store
Power, mute, gain, routing, battery, inventory.

## Scenario state
Time, objectives, faults, staffing, role, difficulty.

## Assistance layer
Hints, map, Codex, highlighting.

## Debrief/logging layer
Actions + verification evidence.

Implementation details remain flexible.

---

# 84. Current Architecture Fork — Do Not Let an Agent Decide Alone

**[OPEN PRODUCT/IMPLEMENTATION DECISION]**

At the current transition point there are two plausible paths:

1. continue evolving the single-file prototype
2. use it as a reference and build a proper application around the scene graph/assets

This choice affects:

- state management
- gameplay architecture
- persistence
- testing
- future content tools

A coding agent should **not** silently choose a major migration path without owner agreement.

Safe work can continue on the prototype/data in the meantime.

---

# 85. Current Safe Spatial-Prototype Work

**[CURRENT HANDOFF PRIORITY, not permanent product scope]**

Before gameplay, useful safe tasks include:

- sync live Artifact state
- complete more plan placement
- fill missing hotspot polygons
- validate motion/arrow placement
- test real touch/mobile behavior
- replace obvious placeholder images when convenient

These tasks improve the spatial substrate without prematurely designing gameplay architecture.

---

# 86. Current Prototype Decisions Worth Preserving

Even if the implementation is rewritten, preserve the learned behaviors:

- scene graph instead of rigid tree
- directional paths can differ by travel direction
- turns are distinct from walks
- icon position is independent of semantic motion
- hotspots are direct-on-photo geometry
- closeup transition feels spatial
- portrait device photos must remain fully visible
- wide room photography should remain compositionally intact
- floor-plan pose is useful but approximate
- real-world distance can influence motion duration
- phone-width behavior matters from the beginning

---

# 87. Privacy / Public-Repo Guardrails

**[LOCKED operational rule]**

Repository is public.

Therefore:

- strip GPS metadata from committed room photos,
- do not commit raw originals with location metadata,
- preserve people only intentionally,
- avoid exposing unrelated personal data in screenshots/photos,
- keep source originals local/gitignored unless there is a deliberate reason otherwise.

**Public website (owner, 2026-09-28):** the three character portraits may be shown. Nobody else in the
room (director, ensemble members, audience) may be identifiable on the public site: they are replaced
with generic figures at build time (`tools/public-site/`). The repository itself still holds the
original photos.

---

# 88. Known Unknowns — Do Not Invent

## Wireless
- exact full color/channel mapping
- exact per-receiver normal gain values
- exact receiver configuration if required by gameplay

## Batteries
- exact charger count
- final bad/suspicious battery workflow

## X32
- exact normal preamp values
- exact Main LR startup convention
- exact aux input pair from SSL 2+
- exact current routing-page state

## Vocal Jazz calibration
- exact Bus 1 send starting values
- exact receiver/X32 gain relationship
- exact normal amp gain setting

## Stage-side
- exact current role of Mix5 in every scenario
- subwoofer routing
- exact current AES50/Dante/analog topology on any given week

## Power
- exact devices intentionally left always-on vs merely left on by habit

## Musco
- large portions of infrastructure/signal flow

Unknowns should become configurable fields or explicit TODOs, not guessed constants.

---

# 89. Tentative Values — Field Calibrate

These are useful working values but not canonical truth:

- X32 vocal faders roughly around -5 dB
- Bus 1 sends roughly around -5 to -10 dB
- exact movement-time scaling
- staffing probabilities
- hint penalties
- amplifier gain starting positions
- some floor-plan travel distances

Label these in data if they enter the app.

---

# 90. Locked vs Flexible

## Strongly locked

- mobile-first
- real-photo spatial navigation
- scene/hotspot graph
- educational transfer to real room
- troubleshooting emphasis
- NOTICE → TRACE → ACT → VERIFY
- verification-based completion
- A2 first
- Vocal Jazz first major scenario
- real device identities where known
- no soft-locks
- real mistakes possible
- current vs ideal state distinction
- X32 → X32 Compact transfer proof
- reproducible scenario variation
- Codex/map as assistance systems
- room facts stay configurable

## Flexible implementation choices

- frontend framework
- state library
- exact hotspot editor
- exact transition math
- exact scoring formula
- exact CSS treatment
- schema naming
- internal module boundaries
- persistence layer
- deployment stack

## Tentative

- numerical gains/sends
- exact scenario timing compression
- exact difficulty penalties
- exact staffing probabilities

---

# 91. Scope Ladder

This section exists to prevent agents from building exciting side features before core gameplay works.

## NOW — finish reliable spatial substrate

- keep Artifact/repo synchronized
- preserve working navigation
- complete important hotspot authoring
- improve floor-plan/route confidence
- validate mobile/touch behavior
- preserve asset provenance

## MVP — first educational game loop

- real-photo navigation
- first Vocal Jazz scenario
- basic physical/device state
- muted wireless fault
- signal reachability
- objectives
- verification
- layered hints
- simple Codex
- simple signal-flow map
- basic inventory/carrying
- debrief
- debug/sandbox
- seedable scenario setup
- mains + Monitor 1
- one spare mic
- architecture that supports X32 Compact variation

## NEXT — prove breadth

- dead monitor fault
- additional simple faults
- simple karaoke/backing-track scenario
- OH B01 X32 Compact proof
- stronger restore/teardown
- bug-report/field-calibration workflow

## LATER

- A1 progression
- Recording Engineer expansion
- CME
- Mariachi
- full recording workflows
- detailed Dante
- advanced DSP
- IEMs
- multiplayer
- Musco
- real-gig observer mode

## MAYBE / FLAVOR

- audio horror
- elaborate narrative arc
- extreme Easter eggs
- cable-tester minigames
- full 3D reconstruction
- highly elaborate character system

---

# 92. MVP Non-Goals

MVP does **not** require:

- full Dante Controller emulator
- full X32 operating system
- multiplayer
- IEM simulation
- Musco
- full photogrammetry
- full 3D room
- perfect photo cleanup
- every gig type
- every hardware device
- advanced audio DSP
- giant branching story
- exhaustive teardown
- elaborate scoring economy

---

# 93. First-Build Product Test

The first real gameplay build should prove:

1. I recognize the room.
2. I can navigate to relevant equipment.
3. I can inspect meaningful state.
4. I can change something real.
5. Signal state responds.
6. I can diagnose one real fault.
7. I must verify the fix.
8. The debrief understands what I did.

If this works, the product idea works.

---

# 94. Suggested First Gameplay Architecture Slice

Without committing to a framework, the first gameplay slice should minimally support:

- one spatial scene
- one interactive device
- one state change
- one signal chain
- one fault
- one objective
- one hint ladder
- one verification event
- one debrief entry

A good vertical slice could be:

> First Entry / FOH / wireless transmitter → receiver → X32 meter → Monitor 1, with transmitter mute fault.

Do not implement 50 devices before one chain works end-to-end.

---

# 95. Suggested Data Truth Boundaries

Room truth should eventually be editable without rewriting UI code.

Possible content categories:

- locations
- scenes
- devices
- device instances
- components
- connections
- routes
- house states
- scenarios
- faults
- objectives
- hints
- verification rules
- calibration values

Do not force all of this into one giant JSON file if the real app grows.

The current scene graph should remain focused on spatial navigation.

---

# 96. Naming / IDs

Current useful examples:

- `foh-x32`
- `foh-mac-mini`
- `foh-ssl2plus`
- `wireless-rack`
- `ptu6000-receiver-01`
- `mains-rack`
- `stagebox-s32`
- `mains-amp-crown-comtech210`
- `monitor-amp-rack`
- `monitor-amp-nx3000`
- `monitor-wedge-vp1220f-01`
- `monitor-wedge-vs1220f-01`
- `stagebox-dt168`

These are recommendations, not sacred API names.

---

# 97. Source Files Future Agents Should Know

## Product intent
- `docs/PRODUCT_DESIGN.md` / this v2 once adopted

## Current implementation
- `docs/SESSION_HANDOFF.md`

## Spatial data
- `docs/scene-graph.json`

## Scene graph tooling
- `tools/scene-graph-editor/README.md`
- `tools/scene-graph-editor/template.html`
- `tools/scene-graph-editor/build.py`

## Asset truth
- `manifest.csv`
- `docs/ASSET_STATUS.md`

## Room/device reference
- `docs/DEVICE_REFERENCE.md`

## Floor plan / motion history
- `docs/FLOOR_PLAN.md`
- `docs/PATH_ANALYSIS.md`

The repository should become the durable shared memory rather than forcing future agents to reread giant chats.

---

# 98. Recommended Durable Project Docs

As the app develops, maintain:

- `docs/PRODUCT_DESIGN.md`
- `docs/SESSION_HANDOFF.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/DECISIONS.md`
- `docs/NEXT_STEPS.md`
- `docs/ASSET_STATUS.md`

A coding session should leave a concise handoff rather than requiring reconstruction from chat.

---

# 99. Agent Autonomy Rules

Agents may decide reversible implementation details.

Agents should **not** independently redefine:

- learning goals
- room truth
- signal flow
- role responsibilities
- scenario intent
- known device identity
- major architecture migration
- character roles
- uncertain real-world values

When uncertain:

- prefer reversible choices
- document assumptions
- keep values configurable
- do not invent room facts

Do not stop for every minor ambiguity.

Do stop/defer when there is a serious risk of:

- destroying owner edits
- diverging from unsynced Artifact data
- inventing real-world truth
- choosing a major architecture path
- exposing private information

---

# 100. What Not to Do

Do not:

- turn MVP into a full 3D game
- hard-code one permanent Salmon signal topology
- clone every X32 screen
- require exact click order when valid state is reached
- reward random clicking as if it were good diagnosis
- hide all mistakes
- make roles arbitrary permission walls
- force a long replay after one catastrophic mistake
- crop away important device content
- invent hardware details
- make critical interaction hover-dependent
- mark objectives complete merely because a control moved
- let an agent overwrite live Artifact edits from a stale graph
- confuse approximate floor-plan coordinates with surveyed geometry

---

# 101. Long-Term Progression Arc

Possible learner progression:

1. mentored A2
2. A2 with reduced guidance
3. independent A2
4. A1 support
5. independent A1
6. combined A1 / Recording Engineer responsibility
7. advanced rooms/scenarios
8. player mentors another engineer

Loose narrative inspiration may come from a Hero's Journey / story-circle structure.

Story remains subordinate to learning.

---

# 102. Final North Star

A successful Salmon Simulator does not merely teach:

> "Click this button when this screen appears."

It teaches:

> "I understand what the system is trying to do, where the signal should be, what evidence I have, and what to check next."

The product should gradually reduce the learner's dependence on:

- labels
- hints
- map overlays
- expected values
- instructor narration

until the learner can enter the real room and reason from the system itself.

> **THE GAME TEACHES YOU TO SEE THE SYSTEM.**
