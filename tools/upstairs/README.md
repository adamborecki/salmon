# Upstairs signal flow (BH208 + BH209)

The rooms above Salmon Recital Hall: **BH208**, the "audio side", and **BH209**, the "video side".
This is a separate system from the downstairs setup that the rest of the project is about. The owner
asked for it on 2026-10-09: "the most important thing is visualizing the signal flow". It starts as
**documentation** (a page on the public site); it may become a game later.

| File | What it is |
|---|---|
| `content/upstairs.json` | Everything on the page: devices (with diagram positions), links, the three paths, Dante devices, open questions, the change log, photo captions. **Edit this to correct or add facts.** |
| `index.html` | The page: an SVG diagram drawn from the content, tap for details, path highlighting, the lists. |
| `build.py` | Checks the content (ids, statuses, sources, layout bounds, no GPS in photos) and builds `dist/` (gitignored). |
| `photos/` | Photos from 2026-10-09. **Already anonymized** (people and faces on posters blurred) and re-saved without metadata when they were added, so the public site doesn't run them through `anonymize.py`. New photos need the same treatment before they're committed. |
| `test/upstairs.e2e.mjs` | Phone-size check in light and dark: everything drawn, text fits, the detail sheet, a path, the lists, the photos. |

```bash
python3 tools/upstairs/build.py
node tools/upstairs/test/upstairs.e2e.mjs
cd tools/upstairs/dist && python3 -m http.server 8150      # then open http://localhost:8150/
```

The public site builds it into `upstairs/` and links it from the landing page.

## How sure each fact is
Every device, link and note has a `status`, and notes name a `source`:
- `confirmed`: seen (photo, Dante Controller) or said plainly by the owner;
- `tentative`: from the old splitter diagram, a hedged answer ("I think"), or an inference;
- `unknown`: listed in `questions`;
- `legacy`: still there but being retired (the Focusrite 8PreX);
- `planned`: not set up yet (the board feed over Dante).

The diagram draws tentative as dashed, unknown as grey dotted with a "?", legacy faded, planned
dotted. Don't upgrade something to `confirmed` without a source. When an answer comes in, update the
note, drop the question, and add a line to `log`.

## Layout
The diagram is 420 units wide and reads top to bottom (phone first). Devices carry `x`, `y`, `w`
(and optionally `h`); rooms are horizontal bands. A link goes from the bottom of `from` (at `fx`,
0-1 across) to the top of `to` (at `tx`); `fside: "right"` starts it from the right edge, and `via`
routes it through points (used to slip between boxes). `tag` puts a short label on the wire (`tagAt`
0-1 along it). `build.py` refuses boxes outside the width; the e2e test fails if text spills out of a box.
