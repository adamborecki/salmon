#!/usr/bin/env python3
"""
Builds the gameplay-slice harness into tools/gameplay-slice/dist/:
  - index.html  harness.html with the content and the slice's part of docs/scene-graph.json inlined
                (no <!doctype>/<head>: the Artifact publisher wraps it, like the scene-graph editor)
  - local.html  the same page with a doctype skeleton, for trying it locally / Playwright
  - engine.js, line-engine.js   copied unchanged; the page imports them as modules (the line check's
                content, content/vj-line-check.json, is inlined too)
  - p/*.jpg     1280x960 previews of the slice's scenes (same size as the editor's p/ files), plus
                320px crops of the three character portraits for the title card

Usage (from repo root):
  python3 tools/gameplay-slice/build.py
  cd tools/gameplay-slice/dist && python3 -m http.server 8124   # then open /local.html
  python3 tools/gameplay-slice/build.py --photos-overlay DIR --out DIR     # e.g. the public site copy

The hotspots come straight from docs/scene-graph.json, so redrawing one in the editor (and syncing)
changes it here on the next build.
"""
import argparse, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DIST_DEFAULT = os.path.join(HERE, 'dist')
SCENES = ['foh-wide', 'x32-top', 'foh-rack', 'foh-rack-closeup', 'foh-right-side', 'foh-mic-drawer',
          # the monitors (vj-monitors.json): the walk from FOH to the storage closet, the stage, and the Monitor Rack
          'center-wide', 'crossroads', 'crossroads-left', 'crossroads-right', 'path-to-storage', 'storage-entry', 'storage-closet',
          'musician-pov', 'upstage-back-wide', 'racks-front-wide', 'racks-rear-wide', 'monitor-amp-rack-front', 'monitor-amp-rack-rear']
# the title card's portraits: head-and-shoulders crops of photos-working/characters/*.jpg, as
# [x0, y0, x1, y1] in pixels of the 1800x2400 originals; tight enough to leave out the people
# in the background (another person at the edge of cary.jpg, students on stage behind morgan.jpg)
CHARACTERS = {'cary': (480, 220, 1440, 1180), 'morgan': (540, 564, 1308, 1332), 'magnolia': (444, 624, 1284, 1464)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--photos-overlay', help='a folder laid out like photos-working/ whose files win (anonymized copies)')
    ap.add_argument('--out', default=DIST_DEFAULT)
    args = ap.parse_args()
    out = args.out
    try:
        from PIL import Image
    except ImportError:
        sys.exit('Needs Pillow: pip3 install Pillow')
    content = json.load(open(os.path.join(HERE, 'content', 'vj-battery-in-check.json')))
    graph = json.load(open(os.path.join(ROOT, 'docs', 'scene-graph.json')))
    sub = {'nodes': {k: graph['nodes'][k] for k in SCENES},
           'edges': [e for e in graph['edges'] if e['from'] in SCENES and e['to'] in SCENES]}
    missing = [e['from'] + ' -> ' + e['to'] for e in sub['edges'] if not e.get('hotspot') and e.get('kind') == 'closeup']   # walk links get arrows
    if missing:
        print('  ! these slice links have no hotspot, so they will not be tappable:', ', '.join(missing))
    used = {d['scene'] for d in content['devices'].values() if 'scene' in d} | set(content['displays'])
    used |= {content['places']['drawer']['scene']} | set(content['places']['chair']['reachable_from'])
    for scene in used:
        if scene not in SCENES:
            sys.exit(f'content refers to scene {scene!r}, which the harness does not include')

    tpl = open(os.path.join(HERE, 'harness.html')).read()
    dump = lambda o: json.dumps(o, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
    line = json.load(open(os.path.join(HERE, 'content', 'vj-line-check.json')))
    for scene in line['scenes'].values():
        if isinstance(scene, str) and ' ' not in scene and scene not in SCENES:
            sys.exit(f'line-check content refers to scene {scene!r}, which the harness does not include')
    mon = json.load(open(os.path.join(HERE, 'content', 'vj-monitors.json')))
    for k, scene in mon['scenes'].items():
        if k != 'status' and scene not in SCENES:
            sys.exit(f'monitors content refers to scene {scene!r}, which the harness does not include')
    page = tpl.replace('__CONTENT__', dump(content)).replace('__GRAPH__', dump(sub)).replace('__LINE__', dump(line)).replace('__MON__', dump(mon))
    os.makedirs(os.path.join(out, 'p'), exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w').write(page)
    open(os.path.join(out, 'local.html'), 'w').write('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>\n' + page + '\n</body></html>')
    for js in ('engine.js', 'line-engine.js', 'monitor-engine.js'):
        shutil.copy(os.path.join(HERE, js), os.path.join(out, js))
    for k in SCENES:
        src = os.path.join(ROOT, 'photos-working', graph['nodes'][k]['file'])
        if args.photos_overlay and os.path.exists(os.path.join(args.photos_overlay, graph['nodes'][k]['file'])):
            src = os.path.join(args.photos_overlay, graph['nodes'][k]['file'])
        im = Image.open(src)
        im.thumbnail((1280, 960)); im.save(os.path.join(out, 'p', k + '.jpg'), quality=78)
    for key, ph in mon.get('photos', {}).items():                     # the monitors' close-up insets (not graph nodes)
        if key == 'status': continue
        src = os.path.join(ROOT, 'photos-working', ph['file'])
        if args.photos_overlay and os.path.exists(os.path.join(args.photos_overlay, ph['file'])): src = os.path.join(args.photos_overlay, ph['file'])
        im = Image.open(src); im.thumbnail((1280, 960)); im.save(os.path.join(out, 'p', 'inset-' + key + '.jpg'), quality=80)
    for name, box in CHARACTERS.items():
        im = Image.open(os.path.join(ROOT, 'photos-working', 'characters', name + '.jpg')).convert('RGB').crop(box)
        im.thumbnail((320, 320)); im.save(os.path.join(out, 'p', name + '.jpg'), quality=82)
    print(f'Built {out}/index.html: {len(sub["edges"])} slice links, {len(SCENES)} scenes.')


if __name__ == '__main__':
    main()
