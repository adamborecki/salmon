# Asset status (photo pass 1)

Source of truth for per-photo data: [`manifest.csv`](../manifest.csv). This note is the human summary and the bridge into the build spec.

## What was done
- 62 HEIC photos converted to JPG (2400 px long edge, quality ~85), GPS stripped, orientation baked in. Originals stay local in `photos-original/` (gitignored).
- Folders are by scene, not by shoot: `intro/ house/ path/ stage/ stage-side/ foh/ storage/ characters/`, with `closeups/`, `screens/` and `_alts/` (weaker or duplicate shots) subfolders. The shoot round is a column in the manifest (`batch`). Newer beats older by default.
- Naming: `<subject>[-<view>][-<detail>].jpg`, lowercase, hyphenated, no `salmon-` prefix and no numbers by default. Views come after the subject (`-wide`, `-front`, `-rear`, `-top`, `-closeup`, `-screen`). Named devices drop the area prefix (`x32-top`, `ssl2plus`); generic subjects keep it (`foh-computer`, `foh-computer-rear`). Walk waypoints use `-step1`, `-step2`. Weaker/duplicate shots sit in `_alts/` as `<name>-alt1`, `-alt2`. Basenames are unique across the whole set, so a basename can serve as a scene ID. The old `IMG_xxxx` name is kept in the manifest (`source_name`).
- No photos were cropped; composition is preserved. Mobile portrait display is a UI concern (cover/pan/zoom), not an asset one.

## Scene groups
`intro`, `house` (center wide, crossroads), `path` (walking waypoints), `foh`, `stage-side` (Mains Rack, Monitor Amp Rack), `stage` (musician POV, upstage back), `storage`, `characters`. Provisional; not a final vocabulary.

## Best images (role = nav-hub or high usefulness)
- Intro: `outside-entry-wide-01`, `first-entry-wide-01`
- Hubs: `racks-front-wide-01`, `racks-rear-wide-01`, `center-crossroads-01`, `center-wide-01`, `foh-wide-01`, `foh-rear-wide-01`, `upstage-back-wide-01`, `musician-pov-01`, `storage-entry-doors-open-01`
- Stage-side devices: `mains-rack-front-closeup-01`, `mains-rack-mix5-closeup-01`, `mains-rack-rear-01`, `monitor-amp-rack-front-01`, `monitor-amp-rack-rear-01`
- FOH devices: `foh-x32-top-01`, `foh-x32-rear-01`, `foh-rack-front-closeup-01`, `foh-rack-rear-01`, `foh-computer-area-01`, `foh-computer-rear-01`, `foh-ssl2plus-closeup-01`, `foh-mic-drawer-rack-01`
- Screens: `foh-logic-audio-settings-screen-01`, `foh-dante-controller-screen-01`

## Navigation graph (draft, machine-readable copy in `scene-graph.json`)
Regions: intro, house (center/crossroads), foh, stage-side racks, stage (musician POV, upstage back), storage.

Walking edges:
- outside-entry -> first-entry (only exit)
- first-entry -> racks-front-wide (direct)
- first-entry -> center-wide via `path-entry-to-center-01`, `-02`; the reverse (center-wide -> first-entry) shows `path-center-to-entry-01` instead. Routes are directional.
- center-wide <-> foh-wide (adjacent)
- center-wide -> crossroads: direct, no stop between (`center-to-stage-omitted`, IMG_4247, is dropped)
- crossroads -> first-entry goes through `crossroads-left` (IMG_4252) as the middle step
- crossroads -> left -> racks-front-wide (direct); crossroads -> right -> path-to-storage -> storage-entry -> storage-closet
- crossroads -> forward = 180 degree spin -> musician-pov (center stage, monitors at feet)
- musician-pov -> racks-front-wide; musician-pov <-> upstage-back-wide (furthest upstage looking out); upstage-back-wide <-> racks-rear-wide ("back of carts"). This is a triangle. musician-pov <-> racks-rear-wide also connects directly.

Control edges (button/icon, not click-in-photo):
- racks-front-wide -> racks-rear-wide ("go around back"); racks front/rear closeups hang off both hubs
- foh-wide -> foh-rear-wide (deliberately not a walk edge: 180 degree turn)
- One-way closeups (device views, screens) are children of their hub; see `closeups/` and `screens/` folders.

At racks-front-wide (4218, the front of both racks) you can: open Mains Rack front (medium, closeup, Mix5 closeup), open Monitor Amp Rack front, go around back to racks-rear-wide (then rear closeups), or walk to musician-pov.

## Design impacts learned from photos
- Phone playback into the Mackie Mix5 via 3.5 mm cable plus USB-C/Lightning adapters is a real signal path; the device reference and signal flow need updating.
- A subwoofer (RCA input) exists beside the amp racks: include as a device in MVP, no routing yet.
- Rack power (Furman on each rack) can be unplugged: model power plugs as devices.
- Storage door has a manual latch lever; unlocked doors open without card access: candidate mini-game.
- S32 is mounted backwards in the Mains Rack (front visible from the rear).
- FOH Mac mini is upside down under the desk top; Logic uses Dante Virtual Soundcard as input; Dante Controller shows a 1:1 routing.
- Needs: a bad/suspicious battery bin (does not exist yet, high teaching value). Charger count unconfirmed (16 or 18).

## Questionable / weak
- 4126 is the wireless receiver rack (confirmed). Owner dislikes it; unlikely in the flow.
- `center-wide-02`, `center-wide-03` near-duplicates. `center-wide-03` (4130) marked reject per owner.
- All `*-02` alternates from round 1 are lower quality; kept only for fallback.
- X32 screen shots (`x32-screen-01..04`) are probably replaced by an emulator overlay.

## Missing / retake ideas
- A clear view of mic drawers open, both drawers (only `foh-mic-drawer-rack-01`).
- Full HDMI/power/data cabling behind the FOH monitor (`foh-computer-rear-01` cuts it off).
- Mains rack with lid and front piece on (or AI-generated).
- AI variants: storage doors closed / one open; live sound cart with all 5 wedges.
- People: several students (Cary, Morgan, Magnolia) asked to be in the game; faces kept for MVP, swap later if needed. The manifest column `has_people` marks affected photos.

## Open questions
1. Which overlays do we need to make regions and "go around back" clear?
2. Fill in `turn_degrees` on every link (rotation between views drives transitions/animations). Known so far: crossroads -> left -90, right +90, forward/musician-pov 180, racks front -> rear 180, FOH -> FOH rear 180.

## Scene graph
`scene-graph.json` (every photo is a node with x/y for layout; links are `walk`, `control` or `closeup` with `turn_degrees`). It is edited in the scene-graph editor artifact; export from there, or ask Claude to sync the shared copy back into this file.
