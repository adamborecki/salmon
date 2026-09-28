#!/usr/bin/env python3
"""
Builds the public GitHub Pages site into tools/public-site/dist/:
  index.html        the "under construction" landing page (tools/public-site/index.html)
  walk/             the scene-graph editor in public mode: walk, zoom, try the edit tools; nothing is
                    saved, and Export JSON downloads the edited graph
  battery-check/    the gameplay harness (battery-in check)

People in the photos are anonymized first (tools/public-site/anonymize.py + people.json); the
builds read the anonymized copies through --photos-overlay, so photos-working/ is never changed.

  python3 tools/public-site/build.py
  cd tools/public-site/dist && python3 -m http.server 8130      # then open http://localhost:8130/

Deployed by .github/workflows/pages.yml on every push to main.
"""
import datetime, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DIST = os.path.join(HERE, 'dist')
WORK = os.path.join(HERE, 'work')        # anonymized photos + the harness build; not published


def run(*cmd):
    subprocess.run([sys.executable, *cmd], cwd=ROOT, check=True)


def main():
    shutil.rmtree(DIST, ignore_errors=True); shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(DIST)
    anon = os.path.join(WORK, 'photos')
    run('tools/public-site/anonymize.py', anon)

    walk = os.path.join(DIST, 'walk')
    run('tools/scene-graph-editor/build.py', '--public', '--photos-overlay', anon, '--out', walk)
    page = open(os.path.join(walk, 'index.html')).read()
    open(os.path.join(walk, 'index.html'), 'w').write('<!doctype html>\n<html lang="en">\n' + page + '\n</html>\n')

    game_tmp = os.path.join(WORK, 'battery-check')
    run('tools/gameplay-slice/build.py', '--photos-overlay', anon, '--out', game_tmp)
    game = os.path.join(DIST, 'battery-check')
    os.makedirs(os.path.join(game, 'p'))
    shutil.copy(os.path.join(game_tmp, 'local.html'), os.path.join(game, 'index.html'))   # the copy with a doctype
    shutil.copy(os.path.join(game_tmp, 'engine.js'), game)
    for f in os.listdir(os.path.join(game_tmp, 'p')):
        shutil.copy(os.path.join(game_tmp, 'p', f), os.path.join(game, 'p'))

    g = json.load(open(os.path.join(ROOT, 'docs', 'scene-graph.json')))
    try:
        commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    except OSError:
        commit = ''
    commit = (os.environ.get('GITHUB_SHA') or commit or 'local')[:7]
    fill = {'__SCENES__': str(len(g['nodes'])), '__LINKS__': str(len(g['edges'])),
            '__INSETS__': str(sum(1 for e in g['edges'] if e.get('hotspot'))),
            '__UPDATED__': datetime.date.today().isoformat(), '__COMMIT__': commit}
    html = open(os.path.join(HERE, 'index.html')).read()
    for k, v in fill.items():
        html = html.replace(k, v)
    open(os.path.join(DIST, 'index.html'), 'w').write(html)
    open(os.path.join(DIST, '.nojekyll'), 'w').write('')
    shutil.rmtree(WORK, ignore_errors=True)
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(DIST) for f in fs)
    print(f'Built public site in {DIST} ({size / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
