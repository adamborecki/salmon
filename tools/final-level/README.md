# The SUPER SECRET FINAL LEVEL

Cary's idea (2026-10-08): a final, password-protected level, a Final Fantasy style, party-based,
turn-based battle against Adam Borecki. "Let's at least get the infrastructure part up on the game
site." This folder is that infrastructure, playable end to end. Its moves, numbers and words are
placeholders for Cary and the crew to change in `content/final-battle.json`.

| File | What it is |
|---|---|
| `content/final-battle.json` | The party (you plus the mentors Cary, Morgan and Magnolia), the skills, items, the boss and his moves, the intro, victory and defeat lines, the password's SHA-256. Placeholders are labelled. |
| `battle.js` | The battle engine: pure functions, seeded (the random state lives in the game). |
| `index.html`, `build.py` | The page: the gate, the intro, the battle. The build inlines the content and crops the portraits (the same crops as the gameplay slice's title card). `dist/` is gitignored. |
| `test/battle.test.mjs` | `node --test tools/final-level/test/battle.test.mjs` |
| `test/final.e2e.mjs` | The gate (wrong, then right), the intro, a whole fight won (FL-1) and lost (FL-16) through the menus, at iPhone size. |

```bash
python3 tools/final-level/build.py
node --test tools/final-level/test/battle.test.mjs
node tools/final-level/test/final.e2e.mjs
```

The public site builds it into `final/` and links it from the landing page.

## How it plays
- **The gate:** a password box. Only the password's SHA-256 is in the page; the unlock lasts for
  the browser session. On a static public site this is a fun lock, **not security**: the level's
  code is in the public repo. (Cary chose the password; it isn't written down in the repo.)
- **A party of 4** (Cary, 2026-10-08: "final fantasy is best with a party of 4!"): you (type your
  name; a headphones avatar) plus the three mentors. **Your mentor leads**: the one you last picked
  in the main game (same site, same browser storage), or pick one in the intro. The leader gets a ★.
- **Each round:** pick a command for every standing party member: ATTACK, SKILL (costs MP), DEFEND
  (halves damage that round) or ITEM. Then everyone, the boss included, acts in speed order.
- **Skills (placeholders):**
  - yours: Trace the Signal (exposes the boss: everyone hits harder) and Fixed ≠ Verified (a big hit);
  - Wii Shop Theme (heals the party);
  - Reseat (clears MUTE ALL from an ally);
  - Check the Rest (three hits);
  - Phantom Power (attack up);
  - Gain Staging (a big hit);
  - Sends on Fader (the boss's attack down).
- **Items:** Fresh AA (heal), Iced coffee (MP), Spare mic (revive).
- **The boss:**
  - Pop Quiz;
  - Feedback Squeal;
  - MUTE ALL (no skills for two rounds);
  - "It's 4:59" (phase 2, below half health).
  - These are affectionate in-jokes from the project.
- **Balance:** a sensible strategy wins most seeds in about 9-10 rounds; it can still lose.
  `#FL-123` replays a seed.

## Adam's photo
There's no photo of Adam in the repo, so the boss is a silhouette. It's his public site: add a photo
only once Adam sends one he's happy with (put its path, under `photos-working/`, in `boss.photo`;
the build crops it into `p/boss.jpg`).
