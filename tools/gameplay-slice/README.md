# Gameplay slice: muted handheld (engine + content)

The first NOTICE -> TRACE -> ACT -> VERIFY loop from `docs/PRODUCT_DESIGN.md` (sections 3, 46, 94),
as small as it can be while still being real:

- **one signal chain:** handheld -> PTU-6000 receiver -> XLR -> X32 input (section 37)
- **one fault:** a handheld powered on but muted (section 46), picked by a reproducible seed (section 66)
- **one objective:** line-check the mics in play; a mic counts only when talking into it shows
  signal at its X32 input (sections 45, 55)
- **one hint ladder:** the three hints from section 46, verbatim
- **one debrief:** what failed, and whether NOTICE / TRACE / ACT / VERIFY each happened (section 63)

## What is here

| File | What it is |
|---|---|
| `engine.js` | Pure functions over plain JSON state. No DOM, no dependencies, no framework. |
| `content/vj-line-check.json` | Devices, connections, displays, fault, objective, hints. Every value that isn't current room fact is labelled `tentative` or `unknown` next to it. |
| `test/engine.test.mjs` | `node --test tools/gameplay-slice/test/engine.test.mjs` (Node 18+). |

## The rule that matters

"Fixed is not the same as verified" (section 3) is enforced by data, not by UI: a mic is verified only
by evidence (talking into it while its X32 input meter is in view) that is **newer than the last
state change of any device on its path**. Unmuting alone never completes anything, and a mic
verified earlier drops back to "re-check" if anything on its path changes. Tests cover this, plus
a no-soft-lock property test: after 150 random 60-action sequences, the same recovery always reaches
READY.

State is kept in the separate kinds of section 51: device state (`devices`), signal state (derived
by `reach()`, never stored), verification evidence (`evidence`), assistance (`hints`), scenario
(`seed`, `fault`, clock), and an action `log` that the debrief reads.

## What is deliberately not decided or not modelled

- **No architecture choice.** The engine has no UI and no persistence, so it fits either option in
  section 84: evolve `template.html`, or build an app around the scene graph. It is an ES module;
  the scene ids it uses (`foh-mic-drawer`, `x32-top`, `foh-rack-closeup`) are the scene-graph node ids.
- **Not modelled:** X32 controls (gain, mute, buses), Monitor 1 / mains output, batteries, RF,
  receiver channel layout, the spare mic, carrying more than one thing. The path data is ready to
  extend downstream (X32 Bus 1 -> transport -> monitor amp -> wedges) once those facts are confirmed.
- **Unknowns kept as flagged content values**, not guesses in code: whether a mute survives a power
  cycle (currently `true`), what a muted transmitter shows, the power gesture ("hold" is an
  assumption), per-mic channel numbering, per-action game seconds.
