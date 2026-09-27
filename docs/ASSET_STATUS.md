# Asset status (photo pass 1)

Source of truth for per-photo data: [`manifest.csv`](../manifest.csv). This note is the human summary and the bridge into the build spec.

## What was done
- 62 HEIC photos converted to JPG (2400 px long edge, quality ~85), GPS stripped, orientation baked in. Originals stay local in `photos-original/` (gitignored).
- Batches live in `photos-working/round1-older/`, `round2-newer/`, `round3-newer/`. Newer beats older by default.
- Every file renamed `salmon-<scene>-<view>-NN.jpg` (NN 01 = preferred, 02+ = alternates). The old `IMG_xxxx` name is kept in the manifest (`source_name`).
- No photos were cropped; composition is preserved. Mobile portrait display is a UI concern (cover/pan/zoom), not an asset one.

## Scene groups
`outside`, `house` (first entry, center wide, crossroads), `path` (walking waypoints), `foh`, `stage-side` (Mains Rack, Monitor Amp Rack), `stage` (listening position), `storage`, `characters`. Provisional; not a final vocabulary.

## Best images (role = nav-hub or high usefulness)
- Intro: `outside-entry-wide-01`, `first-entry-wide-01`
- Hubs: `stageside-racks-wide-01`, `amp-racks-rear-wide-01`, `center-crossroads-01`, `center-wide-01`, `foh-wide-01`, `foh-rear-wide-01`, `listening-wide-01`, `storage-entry-doors-open-01`
- Stage-side devices: `mains-rack-front-closeup-01`, `mains-rack-mix5-closeup-01`, `mains-rack-rear-01`, `monitor-amp-rack-front-01`, `monitor-amp-rack-rear-01`
- FOH devices: `foh-x32-top-01`, `foh-x32-rear-01`, `foh-rack-front-closeup-01`, `foh-rack-rear-01`, `foh-computer-area-01`, `foh-computer-rear-01`, `foh-ssl2plus-closeup-01`, `foh-mic-drawer-rack-01`
- Screens: `foh-logic-audio-settings-screen-01`, `foh-dante-controller-screen-01`

## Navigation graph (draft)
Walking edges (click a spot in the image):
- outside-entry -> first-entry (only exit)
- first-entry -> stageside-racks-wide (direct)
- first-entry -> path-entry-to-foh-01 -> path-entry-to-foh-02 -> center-wide / foh-wide (the route up the way in)
- center-wide <-> foh-wide (adjacent)
- center-wide -> path-house-left-01 (left) -> ... house back row (house-left route, first-entry to back)
- center-wide -> center-to-stage-01 (down the center aisle) -> center-crossroads (alternate route)
- center-crossroads -> crossroads-left-01 (toward stage boxes; may link straight to stageside-racks-wide) / crossroads-right-01 -> path-to-storage-01 -> storage-entry
- stageside-racks-wide -> listening-wide-01 -> listening-closeup-01
- storage-entry -> storage-closet-one-door-open-01 -> door-latch, school-of-rock-cart, live-sound-cart, rear-view, husky-toolbox

Control edges (button/icon, not a click-in-photo; some turns are 180 degrees or unclickable):
- stageside-racks-wide -> amp-racks-rear-wide-01 ("go around back"); rear-wide can chain on to listening-wide since the camera keeps rotating
- amp-racks-rear-wide -> monitor-amp-rack-rear, mains-rack-rear
- stageside-racks-wide -> mains-rack-front-medium -> mix5-closeup / front-closeup; -> monitor-amp-rack-front
- foh-wide -> x32-top -> screens; -> foh-rack-medium -> rack-front-closeup -> drawer; -> computer-area -> ssl2plus / logic settings / dante controller screens; -> right-side-wide -> mic-drawer-rack
- foh-wide -> foh-rear-wide (button, not part of walk path) -> x32-rear, rack-rear, computer-rear, iem-rack-rear
- Deliberately not a walk edge: center crossroads -> foh-rear-wide (180 degree turn is jarring).

## Design impacts learned from photos
- Phone playback into the Mackie Mix5 via 3.5 mm cable plus USB-C/Lightning adapters is a real signal path; the device reference and signal flow need updating.
- A subwoofer (RCA input) exists beside the amp racks: include as a device in MVP, no routing yet.
- Rack power (Furman on each rack) can be unplugged: model power plugs as devices.
- Storage door has a manual latch lever; unlocked doors open without card access: candidate mini-game.
- S32 is mounted backwards in the Mains Rack (front visible from the rear).
- FOH Mac mini is upside down under the desk top; Logic uses Dante Virtual Soundcard as input; Dante Controller shows a 1:1 routing.
- Needs: a bad/suspicious battery bin (does not exist yet, high teaching value). Charger count unconfirmed (16 or 18).

## Questionable / weak
- Dictation vs photo: 4126 was described as an amp; the photo shows the wireless receiver rack. Treated as the photo says.
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
1. 4248: is this from the monitor-listening spot looking at the house, or from the back of the hall looking at the stage? It reads as the listening position; confirm.
2. What are the four exits at center crossroads: left (4252), right (4253), forward (toward stage), and back (toward FOH / first entry)?
3. Does the center aisle to stage lead to the same stage-side racks as the first-entry route?
4. 4131 (house-left path): which photo continues it toward the back row, and where does the first-entry-to-FOH transition photo you mentioned live?
