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
