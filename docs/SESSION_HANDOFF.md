# Session handoff — Salmon Recital Hall simulator

Written by the Sonnet session that did the photo/asset organization and built the first
interactive prototype, for a fresh agent (Opus) taking over. Read this whole file before
touching anything — the git repo alone is misleading about how far the build has actually
gotten, because most of the interactive work lives in a live claude.ai Artifact, not in
committed app code. See "The single biggest thing to understand" below first.

**Read `docs/PRODUCT_DESIGN.md` too, and read it as the higher-authority document.** It's the
canonical product/pedagogy/design source of truth, distilled by the project owner from a long
prior design process, added after this file was first written. The division of labor between
the two:
- `PRODUCT_DESIGN.md` = **what** is being built and **why** (product vision, pedagogy, design
  intent) — authoritative on anything it covers. This handoff file does not attempt to
  summarize or restate it; go read it directly.
- `SESSION_HANDOFF.md` (this file) = what **currently exists** in the repo/Artifact and **how**
  this prototype works, mechanically — a snapshot of implementation state, not of intent.

If anything below (in the "decisions made" or "next tasks" sections especially) reads as
disagreeing with `PRODUCT_DESIGN.md`, treat that as this prototype having been built before the
canonical design doc existed, and `PRODUCT_DESIGN.md` as the tie-breaker — flag the conflict to
the project owner rather than silently picking one.

Game concept (from the project owner, for orientation — not something this session designed):
a mobile-first, Myst/Riven-style point-and-click educational simulator of live sound,
signal flow, troubleshooting, and concert recording workflows in Chapman's Salmon Recital
Hall, built from real photos of the venue and its gear. `PRODUCT_DESIGN.md` supersedes this
paragraph as the real statement of intent.

## The single biggest thing to understand

**There is no app/game codebase in this repo yet.** What exists is:
1. A real photo asset library (`photos-working/`) with a navigation graph over it
   (`docs/scene-graph.json`) describing how to move between photos and zoom into device
   closeups — this *is* committed, in git, up to date.
2. A ~1000-line single-file interactive prototype (`tools/scene-graph-editor/template.html`,
   now committed for the first time by this handoff — it was NOT in git before) that renders
   that graph as three things: a node/edge map editor, a top-down floor-plan editor, and a
   working first-person Walk view with real transitions (see "What's implemented" below).
   This is the actual playable prototype of the "point and click through the hall" experience.
3. That prototype has been running as a **published claude.ai Artifact**, not a local dev
   server:

       https://claude.ai/artifact/YL4fwPRru76zLs75Vppadr

   The project owner has been live-editing it directly in that browser page — dragging camera
   positions on the floor plan, drawing hotspot polygons, tweaking arrow angles — and those
   edits save into the Artifact's own cloud database, **not into this git repo automatically**.
   Every commit in this repo's recent history is this session manually pulling that live
   database state and writing it into `docs/scene-graph.json`, then committing.

**Before doing anything else**, pull the current live state and make sure `docs/scene-graph.json`
matches it — the project owner may have kept editing after this handoff was written. Use the
`ArtifactData` tool: `get` with that URL, collection `graph`, doc `main`; the `data.json` field
is the current `{nodes, edges}`. Compare its node/edge count and a spot-check of a few `plan_x`/
`hotspot` values against what's in `docs/scene-graph.json` now. Full instructions and the
concurrent-edit caveat are in `tools/scene-graph-editor/README.md` — read that before writing
to the Artifact's database.

If you (Opus) don't have Artifact/ArtifactData tools available in whatever environment you're
running in, say so explicitly rather than silently working from a possibly-stale
`docs/scene-graph.json` — that's the single most likely way to waste a night's work (editing a
graph that gets overwritten by the next sync, or that's already out of date relative to what
the owner did after this handoff).

## 1. What exists right now

### Repo structure
```
salmon/
  photos-original/        gitignored — raw HEIC originals, 3 shoot rounds, local only
  photos-working/          committed — 63 JPGs, 2400px long edge, GPS stripped, organized by
                            scene (not by shoot round): intro/ house/ path/ stage/ stage-side/
                            foh/ storage/ characters/, with closeups/ screens/ _alts/ subfolders
  manifest.csv             one row per working photo: batch, old IMG_ number, path, scene info,
                            role/usefulness, has_people, notes — the human-curation record
  docs/
    PRODUCT_DESIGN.md        canonical product/pedagogy/design doc — read this first, it is
                             higher authority than everything else in docs/
    scene-graph.json        THE navigation graph — nodes (scenes/photos) + edges (moves between
                             them). Source of truth for the prototype. See schema below.
    DEVICE_REFERENCE.md     equipment reference (X32, wireless, racks, signal flow) from the
                             owner's notes — for content/copy later, not yet wired into any UI
    ASSET_STATUS.md         photo-organization pass notes: renaming, scene groups, best/weak
                             shots, missing shots
    PATH_ANALYSIS.md        this session's day-by-day log of every scene-graph/animation change,
                             with reasoning — closest thing to a decision log, read it if you
                             want the "why" behind a specific edge's numbers
    FLOOR_PLAN.md           how plan_x/plan_y/heading_deg were seeded from a supplied floor plan
    SESSION_HANDOFF.md       this file
  tools/scene-graph-editor/
    template.html            the prototype's full source (newly committed by this handoff)
    build.py                 regenerates dist/index.html + thumbnails from the current graph
    README.md                 how to build/publish/sync it — read before touching the Artifact
    dist/                    gitignored, build.py output
```

### Tech stack
- **The prototype**: plain HTML/CSS/vanilla JS in one file, no framework, no build step, no
  dependencies. Runs as a claude.ai Artifact using its `db` capability (a small cloud JSON
  document store, reached from the page via `window.claude.use('db')`) for live persistence,
  or standalone off an embedded fallback graph (edits don't save) when just opened as a file.
  SVG for the map/plan views and hotspot polygons; CSS `clip-path`/`transform`/WAAPI
  (`element.animate()`) for all Walk-view transitions; no canvas, no WebGL, no 3D library.
- **Asset pipeline**: macOS `sips` for HEIC→JPG conversion, `exiftool` for stripping GPS,
  Python + Pillow for resizing/thumbnails and for the floor-plan/vanishing-point measurements
  (OpenCV + numpy were used once, in a throwaway scratch venv, for measuring real camera angles
  from photo geometry — not a repo dependency).
- **Nothing else** — no React, no server, no database beyond the Artifact's own.

### Implemented features (in the prototype, `template.html`)
- **Map tab**: all 63 scenes as draggable nodes, colored/shaped by kind, with edges drawn
  between them; a scene-kind filter, pan/zoom (mouse + pinch), an "Export" panel showing raw
  JSON, and a link-mode for creating new edges by tapping two nodes.
- **Plan tab**: a to-scale (61'9" x 54'6") top-down floor plan traced from a supplied drawing,
  with each placed scene shown as a camera icon (position + facing-direction wedge), draggable
  position and a draggable rotate handle; per-link panel showing the distance/direction/turn
  that the two cameras' plan positions imply, with buttons to copy those values onto the actual
  edge. Only 19 of 63 nodes are placed on the plan so far (see Next tasks).
- **Walk tab** (the actual first-person prototype):
  - Directional arrows for `walk`/`control` edges, auto-spaced so they never overlap, each
    showing a preview thumbnail on hover and, if it chains through waypoint photos, walking the
    whole chain in one move (see `chainAfter`/`walkPath` in the source).
  - A distinct curved "turn" icon (not a straight arrow) for pure rotations — draggable
    to an arbitrary photo position/rotation, independent of the walking-motion math.
  - **Motion model**: every walk edge has a `motion` (auto/forward/backward/strafe/turn), a
    `distance_m`, and a `turn_degrees`. The camera "dollies" (translates in 3D via a real
    perspective transform + `rotateY`, not just a crossfade) along the edge's direction, scaled
    by distance; a pure "turn in place" edge instead plays a duration/blur that scales with the
    plan-derived distance between the two camera positions, so a short repositioning (2m) feels
    different from a long one (6-7m) even though the underlying spin is the same.
  - **Route planning**: "Walk to..." picks a destination and finds up to 3 shortest paths
    (Dijkstra-ish DFS over `distance_m`), playing the whole route as one chained animation with
    a Stop button.
  - **Inset/hotspot zoom** (`kind: "closeup"` edges): a polygon drawn directly on the wide photo
    around a device; tapping it grows that exact polygon shape to fill the frame (CSS
    `clip-path` + `transform`, canonicalized point winding so it doesn't twist), landing on the
    closeup photo. A fixed "Back" pill button (only shown while inside an inset) reverses it.
    Only 10 of ~29 closeup edges have a drawn hotspot so far; the rest fall back to a plain
    thumbnail-grid "Insets" list in the sidebar with a simple zoom crossfade (still works, just
    not the polished polygon-tap interaction).
  - **Letterboxing**: many closeups are portrait photos (device racks shot vertically); cropping
    them to the landscape frame was cutting off the actual subject. Fixed by comparing each
    photo's real aspect ratio to the frame's and, when it's far enough off (portrait, or >~25%
    deviation), showing the whole photo with a blurred/darkened copy of itself filling the
    letterbox space, applied from the very first frame of the zoom (not after) so it reads as
    one continuous move in both directions.
  - Auto light/dark theme (CSS `prefers-color-scheme` + a manual override button); works down
    to phone width (tested at 390px).
- **Not implemented at all**: gameplay (no interactivity beyond navigation — no device state,
  no faults/troubleshooting, no signal-flow logic, no X32 emulator, no scoring/objectives,
  no character dialogue). This has all been pure "walk around and look at things" so far.

### Current playable flow
Open the Artifact, use the Walk tab. Start at `outside-entry` → `first-entry`. From there you
can walk toward FOH (via a path waypoint or via the crossroads/racks route), reach the
stage-side mains/monitor racks, spin around to their rear views, walk to the musician POV and
upstage-back on the stage, detour to storage, and from FOH-wide zoom into the X32, the rack,
the computer, and the wireless/mic drawer as insets, with drilling further into some of those
(mic drawer closeups, X32 screen photos, Dante Controller / Logic screens). Three student
"characters" (Cary, Morgan, Magnolia) exist as photo nodes but aren't linked into the walk graph
at all yet — they were requested by the owner to be included as characters later, not surfaced
anywhere in the UI right now.

### Asset/photo organization
Photos are organized by **scene**, not by which of the 3 shoot rounds they came from (round
number is kept as a `batch` column in `manifest.csv` for provenance only). Filenames are
lowercase-hyphenated, no numeric suffix unless there's a real duplicate (`-alt1`, `-alt2`), no
`salmon-` prefix, and every basename is unique across the whole set so it doubles as the scene's
node ID in `scene-graph.json` — see the naming-convention paragraph in `ASSET_STATUS.md` for
the exact rules if you need to add a new photo.

## 2. Important decisions made this session

- **Photos organized by scene, filenames rewritten**, with the old `IMG_####` numbers preserved
  in `manifest.csv` for traceability, not baked into the working filenames.
- **GPS EXIF stripped from every working photo** before it was ever committed (the repo is
  public) — the project owner confirmed this explicitly; do the same for any new photo you add.
  `photos-original/` (raw, GPS-intact) is gitignored and stays local-only, by the owner's choice
  (already backed up elsewhere, not urgent to move).
- **`first-entry-look-right` / `first-entry-rj45-ports`**: a placeholder inset was added at the
  owner's request — a crop of an older photo standing in for a not-yet-taken RJ45 wall-jack
  shot, chained after a "keep turning right" gesture from `first-entry`. Flagged in the graph as
  a retake need; treat it as temporary content, not a design pattern to repeat elsewhere.
  Its turn-in-place edges are deliberately pinned to 0m "distance" so they always animate fast
  (a quick glance, not a walk) even though the two cameras' plan positions ended up far apart —
  see the "RJ45 ports view" section of `PATH_ANALYSIS.md` for why that's intentional, not a bug.
- **`distance_m` / `turn_degrees` / `dir_degrees` are three separate concepts**, not one
  degrees-in-disguise value: `dir_degrees` is purely where the arrow icon *points* (cosmetic,
  matches the photo), `turn_degrees` is how far the *camera actually rotates* on arrival, and
  `distance_m` is real plan-derived (or estimated) travel distance driving how long/dramatic
  the dolly or turn animation feels. Getting these conflated was the source of several bugs this
  session (e.g. treating a 180-degree-turn edge as a normal forward walk). If you add new edges,
  set `motion` explicitly rather than leaving it on `auto` whenever the direction is ambiguous
  (near-90-degree turns especially) — `auto`'s heuristic is a reasonable guess, not gospel.
- **Every arrow/icon's on-screen position is a separate, optional override** (`icon_x`/`icon_y`,
  percent of the photo) from its semantic direction (`dir_degrees`). Auto-layout spaces arrows
  around a ring by default; dragging one in Edit mode sets an explicit override so it can point
  at the actual doorway/path visible in the photo instead of a generic ring position.
- **Hotspot hit-shapes are stored as raw drawn points, canonicalized at *playback* time**
  (winding direction + starting vertex normalized), not at draw time — so old data never needs
  migrating if the canonicalization logic changes.
- **Mobile-first, but composition-preserving**: photos are never cropped at the asset-prep
  stage even though the eventual UI is portrait-first; per-scene aspect handling (crop vs.
  letterbox) is a *display*-time decision (see letterboxing above), because a wide/landscape
  shot can still be the right navigable scene even in a portrait app frame.
- **No 3D reconstruction / room model was built.** Considered early, deliberately deferred —
  ~60 photos with sparse overlap wasn't going to support real photogrammetry. The floor-plan
  poses (`plan_x`/`plan_y`/`heading_deg`) are a *lightweight stand-in*: a 2D top-down position +
  facing angle per camera, manually placed/dragged by the owner (seeded from real measurements
  on a few key photos via vanishing-point + feature-matching analysis — see `PATH_ANALYSIS.md`
  "measured path" section for the one case this was done rigorously). Treat `plan_x`/`plan_y` as
  approximate, owner-adjustable scaffolding, not surveyed truth.
- **The claude.ai Artifact *is* the current build environment for the interactive prototype**,
  not a demo of something built elsewhere — see "The single biggest thing to understand" above.
  This was not a deliberate architectural choice so much as how the iteration naturally
  happened (fast visual feedback loop with the owner, no local dev environment friction); a
  real app (with an actual framework, routing, state management, etc.) has not been started and
  this prototype's JS was never designed to be "production" — expect to either evolve it in
  place or use it as a reference implementation while building the real thing, and say which
  you're doing.

## 3. Current state of the build

### Works
- All navigation (map/plan/walk tabs), all transition types, route planning, hotspot insets
  (where drawn), letterboxing, light/dark theme, phone-width layout — tested directly in a
  browser by this session throughout (see commit messages for what was specifically verified
  each time; nothing here is "should work," it was watched running).

### Mocked / placeholder
- `first-entry-rj45-ports` photo (see decisions above) — needs a real photo.
- No actual device/gameplay logic anywhere — every "closeup" is just a photo to look at, not an
  interactive control (no X32 fader you can move, no signal-flow simulation).

### Incomplete
- **Hotspots**: 10/29 closeup edges have a drawn polygon; the other ~19 only work via the
  sidebar thumbnail list (functional, just not the polished tap-on-the-photo interaction).
- **Floor plan**: 19/63 nodes are placed; most `stage-side`/`storage` closeups and all
  `foh` closeups/screens are unplaced, so their edges still use estimated/default distances
  rather than plan-derived ones.
- **Characters** (Cary, Morgan, Magnolia): photographed, in the graph as orphan nodes, not
  linked into any scene or given any role in the UI.
- **Device reference content** (`DEVICE_REFERENCE.md`) has never been surfaced in the prototype
  — no tooltips, no info panels, nothing reads it yet.
- Screens closeups (X32 screens 1-4, Dante Controller, Logic settings) exist as static photos
  only — an actual console/software emulator was suggested by the owner early on as a probable
  eventual replacement for these ("we will just have an emulator as a mini-game"), not built.

### Known bugs
None known open at handoff time — every bug found during this session (see full list of fixes
in `git log`: tap-highlight mismatch, transition flash/twist/pop in both directions, overlay
z-order/timing, back-button visibility, etc.) was fixed and re-verified in-browser before being
committed. That said, this was one session's testing, not a QA pass — treat "no known bugs" as
"nothing currently reported," not "guaranteed correct," especially on real touch devices (all
testing here was via automated browser control on desktop viewport sizes plus emulated mobile
widths, never a real phone).

## 4. Files Opus should read first

1. **This file**, all of it.
2. **`docs/PRODUCT_DESIGN.md`**, all of it — the canonical product/pedagogy/design doc, higher
   authority than anything below. Read it before forming opinions about what to build next.
3. `tools/scene-graph-editor/README.md` — how to build/publish/sync the prototype; do this
   before touching the live Artifact or trusting `docs/scene-graph.json`.
4. `docs/scene-graph.json` — skim the shape; full schema is:
   - Node: `{file, region, kind, label, src, people, x, y, plan_x?, plan_y?, heading_deg?}`.
     `kind` ∈ hub/waypoint/closeup/screen/character/alt/omitted. `x`/`y` are Map-tab canvas
     coordinates (unrelated to `plan_x`/`plan_y`, which are real-world-ish floor-plan metres).
   - Edge: `{from, to, kind, motion?, turn_degrees?, dir_degrees?, distance_m?, icon_x?, icon_y?,
     icon_rot?, icon_flip?, hotspot?, note?}`. `kind` ∈ walk/control/closeup. `hotspot` is an
     array of `{x,y}` percent points when present.
5. `docs/PATH_ANALYSIS.md` — the decision log; skim for anything touching an area you're about
   to change, it usually explains a specific number's origin.
6. `tools/scene-graph-editor/template.html` — the actual prototype source. It's long
   (~1000 lines) but not architecturally deep: read `motionOf`/`slide`/`slideHotspot`/
   `renderWalk` first (the Walk-view engine), then `renderPlan` (Plan tab) if you're touching
   floor-plan logic.
7. `manifest.csv` and `docs/ASSET_STATUS.md` only if you're adding/reorganizing photos.
8. `docs/DEVICE_REFERENCE.md` if you're starting to build actual gameplay/device logic.

## 5. Next tasks, priority order

Ordered for "what most increases the odds the next session with the owner goes well," not
strictly by difficulty. Items marked **[autonomous-safe]** don't need the owner's judgment calls
and are reasonable to do overnight without checking in; items marked **[needs owner]** involve a
design/content decision only they can make — do the safe groundwork but don't guess the answer.

1. **[autonomous-safe]** Sync `docs/scene-graph.json` from the live Artifact DB first, before
   anything else (see top of this doc). If there's drift, commit that sync on its own before
   starting other work, so it's a clean checkpoint.
2. **[autonomous-safe]** Place the remaining ~44 nodes on the Plan tab's floor plan using the
   same estimation approach as the placed ones (relative position from which photos were taken
   from where, informed by what's visible/adjacent in each photo) — or at minimum, apply
   `needsContain`-style measured real distances between already-plan-placed neighboring nodes to
   fill in more `distance_m` values, so more of the Walk experience gets accurately-paced
   animations instead of defaults. Move conservatively and use "Apply plan distance"/"Apply plan
   turn" per-edge rather than the bulk "apply to all" button, so you can sanity-check each one
   in Walk before moving to the next.
3. **[autonomous-safe]** Draw hotspot polygons for the remaining ~19 closeup edges that don't
   have one, following the existing pattern (draw in Edit mode, `foh-wide`'s four hotspots are
   good reference examples). Test each one's zoom-in and zoom-out in the Walk tab after drawing
   it — this session found real bugs specifically by doing that, don't skip it.
4. **[needs owner]** Decide what to do with the three character nodes (Cary/Morgan/Magnolia) —
   where they'd appear, what role they play. Don't invent this.
5. **[needs owner]** Decide the real architecture for "the actual app" if/when this moves past
   prototype: keep evolving `template.html` in place (simple, works, already has a real feature
   set) vs. start a proper framework-based app that reads `scene-graph.json` as data. This is a
   real fork in the road and affects everything downstream — flag it, don't decide it alone.
6. **[needs owner]** Any actual gameplay/device-interaction design (what does clicking the X32
   fader do, what's the first troubleshooting scenario, etc.) — `DEVICE_REFERENCE.md` has the
   raw material but no gameplay was ever designed on top of it.
7. **[autonomous-safe, lower priority]** Take the real RJ45 wall-jack photo to replace the
   `first-entry-rj45-ports` placeholder, if this session or a later one gets a chance to shoot
   at the venue again — not urgent, just flagged so it doesn't get forgotten.

## 6. Git status

- Branch: `main` (only branch, no others).
- Remote: `https://github.com/adamborecki/salmon.git`, **public**.
- Working tree: clean as of this handoff (verify with `git status` — if it's not clean when you
  read this, someone made changes after this file was written; check `git log -1` against the
  commit that added this file).
- Safe for another agent to start editing: **yes**, with the one big caveat repeated throughout
  this doc — `docs/scene-graph.json` can be stale relative to the live Artifact database at any
  moment, because it's a manually-synced snapshot, not a live link. Pull-and-diff before you
  trust it, every session, not just this handoff.
