# Public site (GitHub Pages)

A public "under construction" page for showing progress, with two ways in:

- **`walk/`**: the scene-graph editor in public mode. Anyone can walk the hall, zoom into
  equipment, use "Walk to…", and even try the editing tools. **Nothing is saved**: it never connects to
  the live editor's database. **Export JSON** downloads the edited graph as a file. It goes through the
  usual `sync.py diff` / `validate.py` / `sync.py pull` workflow (see `tools/scene-graph-editor/README.md`),
  so someone can send the owner a file of suggested changes.
- **`battery-check/`**: the gameplay harness (the mics, the monitors, the line check).
- **`final/`**: the SUPER SECRET FINAL LEVEL (`tools/final-level/`), behind a password gate.

## People in the photos

Owner, 2026-09-28: the three character portraits (Cary, Morgan, Magnolia) may be shown. **Everyone else
in the room must not be identifiable.** `anonymize.py` reads `people.json` and writes public copies of
the photos. Each marked person becomes a heavy blur with a plain grey figure on top, and body parts at
the frame edge are blurred. Unlinked alt photos with people are blurred entirely. The originals in
`photos-working/` and the live editor are untouched.

- The boxes in `people.json` were placed by eye and every result was reviewed. **After a photo retake
  or a new photo, add or update its boxes**, then look at the output (`anonymize.py <dir> --check`
  draws the boxes).
- `anonymize.py` refuses to run if a scene flagged `people: true` in the graph isn't covered. Some
  photos show people without that flag (listed in `people.json`), so the flag alone isn't proof.
- The public **repository** still contains the original photos (and its git history does); only the
  website is anonymized.

## Build, test, deploy

```bash
python3 tools/public-site/build.py                 # -> tools/public-site/dist/ (gitignored)
node tools/public-site/test/site.e2e.mjs           # phone-size check, served under /salmon/ like Pages
cd tools/public-site/dist && python3 -m http.server 8130   # look at it: http://localhost:8130/
```

`.github/workflows/pages.yml` builds and deploys on every push to `main`. **One-time setup (owner):**
GitHub repo -> Settings -> Pages -> Build and deployment -> Source: **GitHub Actions**. The site is then
at `https://adamborecki.github.io/salmon/`.

Since the site is built from `docs/scene-graph.json`, pull live-editor edits into the repo first
(`sync.py`) when you want the public walk-around to catch up with them.
