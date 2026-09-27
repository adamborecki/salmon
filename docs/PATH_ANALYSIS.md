# First entry to center-wide: measured path

Method: straight-line vanishing points (room axes) and SIFT feature matching with essential-matrix pose, assuming an iPhone ultra-wide lens (about 108 degrees horizontal, focal length 0.36 x image width). Angles are rough (a few degrees, more when few features match). Headings use stage = 0 degrees, clockwise from above = positive. Scale (metres) cannot be recovered from these photos, so distances are estimates.

## Measured headings
| Photo | Heading | Notes |
|---|---|---|
| first-entry (IMG_4251) | 91 | faces along the rows, toward house right |
| step1 (IMG_4228) | 144 | 53 degrees right of first-entry (554 feature inliers, strong) |
| step2 (IMG_4229) | 88 | 3 degrees left of first-entry (121 inliers); stage is about 88 degrees to its left |
| path-center-to-entry (IMG_4131) | -33 | 33 degrees left of center-wide (80 inliers) |
| center-wide (IMG_4230) | 0 | faces the stage |

## Moves
| Move | Turn | Travel | Result |
|---|---|---|---|
| first-entry to step1 | right about 53 | almost none | turn in place, as described |
| step1 to step2 | left about 56 | forward, about 4 m (estimate) | bigger left swing than "a little" |
| step2 to center-wide | left about 88 | long, about 9 m (estimate) | matches the description |

Net rotation from first-entry to step2 is about 3 degrees left: step1 is a glance right that step2 immediately undoes.

IMG_4131 faces 33 degrees left of center-wide, so it is not on the straight line between step2 and center-wide. Using it as a midpoint would mean a 121 degree left turn then a 33 degree right turn.

## Options
- A. Keep both: turn right 53, walk and swing left 56, long walk and turn left 88. Three moves.
- B. Make step1 a side look from first-entry (turn icon, not on the path) and go first-entry to step2 directly, then step2 to center-wide. Two moves.
- C. Keep IMG_4131 only for the return trip (center-wide to entry).

## Decision: option B (applied)
- `path-entry-to-center-step1` (IMG_4228) is now `first-entry-look-right`: a turn-in-place of +53 degrees from first-entry and a turn back of -53 (control links, curved turn icon). It is no longer on the path.
- `path-entry-to-center-step2` (IMG_4229) is now `path-entry-to-center`, the only waypoint between first-entry and center-wide.
- Path: first-entry to path-entry-to-center (walk 4 m forward-right, camera turn -3), then to center-wide (walk 9 m, turn -88). Walking through the waypoint plays as one chained move.
- Distances are estimates. Headings above were measured; earlier names in the tables refer to the old step1/step2.

## RJ45 ports view (placeholder)
- `first-entry-rj45-ports` (`intro/first-entry-rj45-ports.jpg`) is a crop of IMG_4131 showing the wall network panel beside the three doors. It is a stand-in until a proper photo is taken from the first-entry spot.
- Choosing the turn icon at first-entry now plays one continuous right turn: first-entry, through `first-entry-look-right` (now a waypoint), to the RJ45 view. Turning back from the RJ45 view unwinds the same way to first-entry.
- Chaining now also continues through turn-in-place links, not just walk links.

## Plan-informed pass over Walk arrows (applied)
Once every scene had a floor-plan position and facing, distances and unset camera turns for 25 links each were recalculated from those positions rather than left as guesses or defaults. Hand-set values (arrow position, and turns that were deliberately measured or chosen, such as first-entry to first-entry-look-right at 53 degrees, or the crossroads/musician-pov 180 degree turns) were left alone. If a distance now looks wrong, the fix is to move that camera's dot in the Plan tab rather than edit the link directly, since the link is derived from it.

## Free arrow placement and distance-aware turns
- Every arrow icon (not just the curved turn icons) can now be dragged to any exact spot on the photo, matching what the doorway/path actually looks like on screen. The arrow's rotation still comes from its direction/camera-turn numbers; only its screen position is freed. "Reset position" clears the override.
- Turn-in-place moves (racks front/rear, FOH front/rear, and any link with motion set to "turn") now scale their duration and blur by the real plan distance between the two cameras, not just the turn angle. A short repositioning (racks front to rear, 2.0 m) plays quick and light; a longer one (FOH front to rear, 3.6 m) plays noticeably longer; the crossroads/musician-pov 180 degree spin (about 6.7 m apart) plays slowest of all, since it represents walking across the room and turning around.
- The first-entry look-right and its continuation to the RJ45 placeholder view were kept at 0 m on purpose, even though their plan positions are far apart, so tapping the turn icon still feels like one continuous glance rather than a walk.

## Inset (hotspot) views
Closeup links (e.g. foh-wide to x32-top, foh-rack, foh-right-side) work fundamentally differently from walking: no distance/turn model applies. In the editor's Walk tab, turn on Edit angles and use the new "Insets" panel to draw a polygon directly on the photo around the object (tap 3+ points, tap near the first point or press Done). Tapping that polygon while viewing plays a clip-path/scale morph: the destination photo grows out of the polygon's exact shape and position to fill the frame, roughly 0.65s, easing in opacity as it grows so a rough polygon still looks intentional. A fixed "Back" button at the bottom of the photo reverses it (shrinking back into the same polygon) and works the same way for ordinary walking scenes. Closeups without a drawn hotspot yet still work via the "Insets" thumbnail list, using the older simple zoom crossfade, so nothing regresses while hotspots get drawn in one at a time.

## Fixed: twist in the inset transition
CSS `clip-path: polygon()` animations interpolate vertex-by-vertex by index. The drawn hotspots (e.g. foh-wide to x32-top) were saved in whatever order they were tapped, and didn't necessarily wind the same direction or start at the same corner as the fixed full-frame rectangle used as the animation's end shape - causing a visible twist as points chased the wrong target corner. Playback now canonicalizes any hotspot's points (forces clockwise winding, rotates to start at the top-left-most vertex) and builds a matching-order target shape from the rectangle's perimeter, so the same stored points always expand cleanly regardless of the order they were drawn in. No data changes were needed; this is a playback-only fix.

## Back button and reverse-transition fixes
- The fixed bottom Back button no longer shows a "(n)" step count, and it only appears while viewing an inset (a closeup-kind scene); it stays hidden during ordinary walking, where the arrows and sidebar already cover navigation.
- Fixed a real bug in the reverse inset transition: going back out of an inset briefly showed the wrong photo full-frame before the shrink animation caught up and self-corrected, because the two image layers were assigned backwards for that direction. The layer holding the outgoing (inset) photo and the layer holding the destination (parent) photo are now swapped correctly for the reverse case, so leaving an inset now shows the wide shot underneath immediately with no flash.

## Overlays now clear immediately on any transition
Turn icons, walk arrows, and inset hotspot polygons stayed visible throughout the animation and only refreshed at the very end. Now every kind of move (walk, turn in place, zoom into an inset, and going back from any of those) clears all on-photo overlays and hides the fixed Back button the instant the move starts, before any animation plays, so nothing stale sits on top of a photo that's already changing.

## Fixed: mismatched tap-highlight box on rotated/skewed overlays
Mobile browsers draw a translucent default highlight (and a default focus ring) on any tappable element, and that highlight is always an axis-aligned rectangle around the element's own box - never the element's actual visual shape. On a rotated arrow icon or a skewed hotspot quad, that rectangle doesn't line up with what's drawn, which read as the overlay being "off" or wrongly transformed. Since our own fill/stroke already gives correctly-shaped feedback, the native tap highlight and default outline are now suppressed (`-webkit-tap-highlight-color: transparent`, `outline: none` as the resting state) on the arrow buttons and hotspot polygons.

## Letterboxed portrait closeups
Surveyed every photo's real pixel dimensions: walking shots and most closeups are landscape 2400x1800 (matches the 4:3 stage almost exactly), but a large group of device closeups (mains rack, monitor amp rack, storage items, most FOH rack closeups) are portrait 1800x2400 crops - cover-fitting those into the landscape stage cropped off roughly the top and bottom half of the photo, which for a tall rack or a door latch often cut off the actual subject.

Fix: at rest (not mid-animation), each photo's aspect ratio is compared to the stage's; a photo that's portrait, or otherwise far enough from 4:3, switches from `object-fit: cover` to `contain` and a blurred, darkened copy of the same photo fills the leftover space behind it (`#stageBg`), rather than plain black bars. Landscape closeups (x32-top, the screen captures, etc.) are unaffected and still fill the frame edge-to-edge as before.

Superseded: a crossfade-after-grow version (grow cropped, then dissolve to the letterboxed frame) still read as two beats chained together rather than one motion, per owner feedback. Replaced with a single continuous animation: when the destination needs letterboxing, `imgB` is set to `object-fit: contain` from the very first frame, so the object never gets cropped at any point in the growth - the "black slivers cutting across a small clipped shape" this was avoided for turned out not to be a real problem, since the letterbox gaps reveal the outgoing wide shot behind (still visible there throughout the grow) rather than black, which reads as the zoom revealing more of the room as it grows, not as a glitch. The photo's own size and position inside the frame are therefore consistent from the first frame to the last; the only thing that changes at the very end (the normal imgB-to-imgA handoff every move already does) is the backdrop switching from the sharp wide shot to a blurred copy of the closeup itself.
