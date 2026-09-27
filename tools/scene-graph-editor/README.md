# Scene-graph editor

`template.html` is the source for a single-file, no-build interactive editor and viewer for
`docs/scene-graph.json`: a top-down floor Plan tab, a node/edge Map tab, and a first-person
Walk tab with the real transitions (yaw turns, dolly forward/back/strafe, curved turn-in-place
icons, polygon hotspot insets, letterboxed closeups). This *is* the interactive prototype —
there is no separate app yet. See `docs/SESSION_HANDOFF.md` for the full picture.

It has lived only as a published claude.ai Artifact so far (Claude's `Artifact` tool), not as a
running local dev server — there's no `npm install`/`vite` here, just one HTML file plus a JSON
graph plus JPGs.

## Regenerate the built page

```bash
python3 tools/scene-graph-editor/build.py
```

Reads `docs/scene-graph.json` + `photos-working/`, writes `tools/scene-graph-editor/dist/`
(`index.html`, `t/*.jpg` 360x270 thumbnails, `p/*.jpg` 1280x960 previews). `dist/` is gitignored
— it's fully reproducible from `template.html` + `docs/scene-graph.json` + `photos-working/`.
Needs Pillow (`pip3 install Pillow`).

The build runs `validate.py` first and refuses to build on an ERROR (dangling edge, missing
photo, malformed hotspot, a scene you can walk into but not back out of, or GPS metadata in a
committed photo). Run it on its own for the full report, including warnings and hotspot coverage:

```bash
python3 tools/scene-graph-editor/validate.py                  # the repo graph
python3 tools/scene-graph-editor/validate.py <db-export.json>  # a raw live-DB export, before pulling it
```

To try it locally: `cd tools/scene-graph-editor/dist && python3 -m http.server 8123`, then open
`http://localhost:8123`. Without a `db` capability it runs off the embedded graph only ("local
only", nothing saved) — fine for checking the code works, but edits don't persist and won't
show live per-viewer position/rotation drags.

## Publish it live (so it has the drag-to-edit, saved-in-the-cloud behavior)

Use the `Artifact` tool: `file_path` = `dist/index.html`, `root` = `dist`, `files` = every
`t/*.jpg` and `p/*.jpg` (published path same as source path, e.g. `t/foh-wide.jpg`), and
`capabilities: {"db": {}}`. The current live one (owned by the project owner's account) is:

    https://claude.ai/artifact/YL4fwPRru76zLs75Vppadr

To update it instead of creating a new one, pass that same `url`. **Read it first** with
`Artifact({action:"read", url:"..."})` in the same conversation before publishing, or the
publish is refused.

## Pull live edits back into the repo

The published page keeps a live copy of the graph in its own database (collection `graph`,
doc `main`) — every position drag, hotspot polygon draw, angle tweak the project owner makes
in the browser saves there via `dbDoc.set(...)`, **not** into this repo automatically.

To sync: `ArtifactData({action:"get", url:"<the artifact url>", collection:"graph", doc_id:"main",
out_dir:"<scratch dir>"})` saves the doc to `<scratch dir>/graph/main.json` (note the `version`
it reports), then:

```bash
python3 tools/scene-graph-editor/sync.py diff docs/scene-graph.json <scratch dir>/graph/main.json
python3 tools/scene-graph-editor/validate.py <scratch dir>/graph/main.json
python3 tools/scene-graph-editor/sync.py pull <scratch dir>/graph/main.json   # writes docs/scene-graph.json
```

`pull` writes exactly the committed file's formatting, so a no-op sync is a no-op diff. Going the
other way (a graph change made in the repo that the live page should get),
`sync.py payload <out.json>` writes a doc whose `json` string is byte-identical to what the page
itself saves; send it with `ArtifactData({action:"update", ..., file_path:"<out.json>",
if_version:<the version you read>})` so it is refused if the owner saved in between. Do this *before* trusting `docs/scene-graph.json`
as current, and re-run `build.py` + republish after any change you make to `template.html` or
to the graph from the repo side, so the live page and the repo don't drift apart. Every commit
in this repo's history from a "Salmon Scene Graph" session did a get-diff-set(if_version)-sync
round trip like this — see `git log` for the pattern.

**Concurrent-edit note:** the project owner edits the live page directly and often. A `set`
needs the exact current `version` (`if_version`) or it's rejected — re-fetch and retry rather
than forcing. Prefer `ArtifactData` `str_replace` for small, surgical changes (one field on one
edge) over a full `set` when you know the owner may be actively dragging things around; it
doesn't need `if_version` and won't stomp on an unrelated concurrent edit the way a full
`set` of a stale snapshot would.
