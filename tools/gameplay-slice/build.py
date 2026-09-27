#!/usr/bin/env python3
"""
Builds the gameplay-slice harness into tools/gameplay-slice/dist/:
  - index.html  harness.html with the content and the slice's part of docs/scene-graph.json inlined
                (no <!doctype>/<head>: the Artifact publisher wraps it, like the scene-graph editor)
  - local.html  the same page with a doctype skeleton, for trying it locally / Playwright
  - engine.js   copied unchanged; the page imports it as a module
  - p/*.jpg     1280x960 previews of the slice's scenes (same size as the editor's p/ files)

Usage (from repo root):
  python3 tools/gameplay-slice/build.py
  cd tools/gameplay-slice/dist && python3 -m http.server 8124   # then open /local.html

The hotspots come straight from docs/scene-graph.json, so redrawing one in the editor (and syncing)
changes it here on the next build.
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DIST = os.path.join(HERE, 'dist')
SCENES = ['foh-wide', 'x32-top', 'foh-rack', 'foh-rack-closeup', 'foh-right-side', 'foh-mic-drawer']


def main():
    try:
        from PIL import Image
    except ImportError:
        sys.exit('Needs Pillow: pip3 install Pillow')
    content = json.load(open(os.path.join(HERE, 'content', 'vj-line-check.json')))
    graph = json.load(open(os.path.join(ROOT, 'docs', 'scene-graph.json')))
    sub = {'nodes': {k: graph['nodes'][k] for k in SCENES},
           'edges': [e for e in graph['edges'] if e['from'] in SCENES and e['to'] in SCENES]}
    missing = [e['from'] + ' -> ' + e['to'] for e in sub['edges'] if not e.get('hotspot')]
    if missing:
        print('  ! these slice links have no hotspot, so they will not be tappable:', ', '.join(missing))
    for scene in set(d['scene'] for d in content['devices'].values()) | set(content['displays']):
        if scene not in SCENES:
            sys.exit(f'content refers to scene {scene!r}, which the harness does not include')

    tpl = open(os.path.join(HERE, 'harness.html')).read()
    dump = lambda o: json.dumps(o, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
    page = tpl.replace('__CONTENT__', dump(content)).replace('__GRAPH__', dump(sub))
    os.makedirs(os.path.join(DIST, 'p'), exist_ok=True)
    open(os.path.join(DIST, 'index.html'), 'w').write(page)
    open(os.path.join(DIST, 'local.html'), 'w').write('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>\n' + page + '\n</body></html>')
    shutil.copy(os.path.join(HERE, 'engine.js'), os.path.join(DIST, 'engine.js'))
    for k in SCENES:
        im = Image.open(os.path.join(ROOT, 'photos-working', graph['nodes'][k]['file']))
        im.thumbnail((1280, 960)); im.save(os.path.join(DIST, 'p', k + '.jpg'), quality=78)
    print(f'Built {DIST}/index.html: {len(sub["edges"])} slice links, {len(SCENES)} scenes.')


if __name__ == '__main__':
    main()
