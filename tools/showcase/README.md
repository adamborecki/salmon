# Showcase signal flow (2026-10-18)

The **Chapman Faculty Electroacoustic Showcase** in Salmon Recital Hall, as it was actually patched:
nine pieces through the hall's X32, the S32 stage box with an SD8 daisy-chained off its AES50 B, and
a separate 8-channel system (Clarett 8PreX, four STAGEPAS, a sub) for TUNNEL. One night's setup on the
downstairs system, not the hall's everyday patch. Documentation, built the same way as
[`tools/upstairs/`](../upstairs/README.md) (same page code, adapted).

| File | What it is |
|---|---|
| `content/showcase.json` | Everything on the page: devices (with diagram positions), links, a path per piece, lessons, open questions, the log, photo captions. **Edit this to correct or add facts.** |
| `index.html` | The page: the SVG diagram drawn from the content, tap for details, a path per piece, the lists. |
| `build.py` | Checks the content (ids, statuses, sources, layout bounds, no GPS in photos) and builds `dist/` (gitignored). |
| `photos/` | Gear-only photos from load-in and the show. **No people in frame** (two are cropped to keep it so), re-saved without metadata. |
| `test/showcase.e2e.mjs` | Phone-size check in light and dark: everything drawn, text fits, the detail sheet, a path, the lists, the photos. |

```bash
python3 tools/showcase/build.py
node tools/showcase/test/showcase.e2e.mjs
cd tools/showcase/dist && python3 -m http.server 8151      # then open http://localhost:8151/
```

## Where the facts come from
- `debrief`: the crew's debrief, dictated in class the day after (2026-10-19). Crew names are left out.
- `photos`: load-in, rehearsal and show photos (2026-10-12 to 2026-10-18).
- `setup`: the owner's own notes from load-in (hum and power, Thunderbolt, AES50 settings).
- `salmon-docs`: the X32 routing facts in `docs/DEVICE_REFERENCE.md`.
- `program`: the printed program. Pieces are named by program number, title and composer.

## How sure each fact is
`confirmed`, `tentative`, `unknown` as in the upstairs page, plus `failed`: worked in rehearsal and
broke during the show (the SD8's outputs). Failed is drawn red and dash-dotted.

## Layout extras (beyond the upstairs page)
- A link can end on a box's left side: `tside: "left"` (with `ty`, 0-1 down the side). `fy` sets where
  a `fside: "right"` link leaves.
- A path can light up boxes with no wire in the path: `nodes` (the rear-projection screen).
- Kinds: `mic`, `line`, `aes50`, `data` (USB, Thunderbolt, MIDI), `air` (acoustic), `video`.
