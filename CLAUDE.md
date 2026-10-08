# Salmon Simulator: notes for every Claude session

Mobile-first educational simulator of live sound in Chapman's Salmon Recital Hall, built on real
photos. North star: **the game teaches you to see the system** (NOTICE -> TRACE -> ACT -> VERIFY).

## Read first, in this order
1. `docs/IMPLEMENTATION_STATUS.md`: current state, open owner questions, next steps (newest truth).
2. `docs/PRODUCT_DESIGN.md`: what and why. Highest authority on product intent; read the sections
   your task touches, and section 91 (scope ladder) and 99 (autonomy rules) always.
3. `docs/SESSION_HANDOFF.md`: how the scene-graph prototype works.
4. The README of whatever tool you touch (`tools/scene-graph-editor/`, `tools/gameplay-slice/`).

## Rules that bite
- **Live Artifact sync.** The owner edits the live editor at
  https://claude.ai/artifact/YL4fwPRru76zLs75Vppadr, whose database can be newer than
  `docs/scene-graph.json`. Before changing the graph: pull and diff (`tools/scene-graph-editor/sync.py`).
  Write back only with `ArtifactData` pinned by `if_version`. Never overwrite owner edits.
- **Don't invent room facts.** Unknown or uncertain values go in content JSON with a `status`
  (`tentative` / `unknown`), not as constants in code. Owner answers are recorded there with a date.
- **Public repo.** No GPS in photos (`validate.py` checks), no private data.
- **Open decision:** app architecture (PRODUCT_DESIGN section 84). Don't pick it silently.
- Git: small logical commits; the owner wants everything to end up on `main`.

## Checks before you push
```bash
python3 tools/scene-graph-editor/validate.py
python3 tools/scene-graph-editor/build.py && node tools/scene-graph-editor/tests/walk-touch.mjs && node tools/scene-graph-editor/tests/hotspots.mjs
python3 tools/gameplay-slice/build.py && node --test tools/gameplay-slice/test/engine.test.mjs tools/gameplay-slice/test/line.test.mjs tools/gameplay-slice/test/monitor.test.mjs && node tools/gameplay-slice/test/harness.e2e.mjs
python3 tools/final-level/build.py && node --test tools/final-level/test/battle.test.mjs && node tools/final-level/test/final.e2e.mjs
```
(Pillow for the Python scripts; Playwright + Chromium for the browser tests.)

## Before you end a session
Update `docs/IMPLEMENTATION_STATUS.md` (what changed, what was tested, what needs the owner, next
steps, sync status) so the next session doesn't depend on chat history.
