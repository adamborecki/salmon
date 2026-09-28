#!/usr/bin/env python3
"""
Builds the scene-graph editor into tools/scene-graph-editor/dist/:
  - index.html   (template.html with docs/scene-graph.json embedded as the fallback graph)
  - t/*.jpg      (360x270 thumbnails, for the map view and side panel)
  - p/*.jpg      (1280x960 previews, for the Walk / first-person view)

Usage (from repo root):
  python3 tools/scene-graph-editor/build.py
  python3 tools/scene-graph-editor/build.py --public --photos-overlay DIR --out DIR   # the public site copy
    --public          never connects to the cloud DB; shows Export JSON and a Home link; opens in Walk
    --photos-overlay  a folder laid out like photos-working/ whose files win (anonymized copies)
    --out             where to write (default: tools/scene-graph-editor/dist)

Then publish tools/scene-graph-editor/dist/index.html as a claude.ai Artifact
(with capabilities: {"db": {}}) and pass every t/*.jpg and p/*.jpg as `files`
alongside it. See docs/SESSION_HANDOFF.md for the full publish/sync workflow.
"""
import argparse, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, 'dist')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--public', action='store_true')
    ap.add_argument('--photos-overlay')
    ap.add_argument('--out', default=DIST)
    args = ap.parse_args()
    out = args.out
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Needs Pillow: pip3 install Pillow")

    graph = json.load(open(os.path.join(ROOT, 'docs', 'scene-graph.json')))
    sys.path.insert(0, HERE)
    import validate
    if validate.check(graph, os.path.join(ROOT, graph.get('photos_root') or 'photos-working'), quiet=True):
        sys.exit('Not building: fix the ERROR lines above (details: python3 tools/scene-graph-editor/validate.py)')
    graph = {k: graph[k] for k in ('nodes', 'edges')}  # drop photos_root before embedding

    tpl = open(os.path.join(HERE, 'template.html')).read()
    if '__GRAPH__' not in tpl:
        sys.exit("template.html has no __GRAPH__ placeholder")
    if '__PUBLIC__' not in tpl:
        sys.exit("template.html has no __PUBLIC__ placeholder")
    html = tpl.replace('__GRAPH__', json.dumps(graph, separators=(',', ':'))).replace('__PUBLIC__', 'true' if args.public else 'false')

    os.makedirs(os.path.join(out, 't'), exist_ok=True)
    os.makedirs(os.path.join(out, 'p'), exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w').write(html)

    n = 0
    for node_id, node in graph['nodes'].items():
        src = os.path.join(ROOT, 'photos-working', node['file'])
        if args.photos_overlay and os.path.exists(os.path.join(args.photos_overlay, node['file'])):
            src = os.path.join(args.photos_overlay, node['file'])
        if not os.path.exists(src):
            print(f'  ! missing photo for {node_id}: {src}')
            continue
        im = Image.open(src)
        t = im.copy(); t.thumbnail((360, 270)); t.save(os.path.join(out, 't', node_id + '.jpg'), quality=70)
        p = im.copy(); p.thumbnail((1280, 960)); p.save(os.path.join(out, 'p', node_id + '.jpg'), quality=78)
        n += 1
    print(f'Built {out}/index.html{" (public)" if args.public else ""} with {len(graph["nodes"])} nodes, {len(graph["edges"])} edges, {n} photo pairs.')

if __name__ == '__main__':
    main()
