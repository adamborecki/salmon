# Floor plan and camera poses

Source: a supplied floor plan of Salmon Recital Hall, 61'9" (18.8 m) long by 54'6" (16.6 m) wide. The drawing is not to scale, so the outline was traced and stretched to those two dimensions. It is an approximation.

## Coordinates
- Units: metres. Origin: the back-of-house apex. `plan_x` runs toward the stage, `plan_y` runs from house left to house right (top to bottom on the plan).
- Plan orientation: top = house left (entry, racks), right = upstage, left = back of house, bottom = house right (storage closet connection).
- `heading_deg`: which way the camera faces. 0 = toward the stage, 90 = toward house right, clockwise from above. Fields live on each scene in `scene-graph.json` (`plan_x`, `plan_y`, `heading_deg`).

## How the poses were set
Positions are estimates from the floor plan, the owner's hints (crossroads near the center, slightly toward the back), and measured headings (see `PATH_ANALYSIS.md`). Adjust them in the editor's Plan tab. Link distances are derived from these positions; the plan's direction and turn values were within a few degrees of many hand-set arrow angles (for example crossroads to center-wide, foh-wide to center-wide), which is a useful consistency check.
