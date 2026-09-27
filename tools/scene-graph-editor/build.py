#!/usr/bin/env python3
"""
Builds the scene-graph editor into tools/scene-graph-editor/dist/:
  - index.html   (template.html with docs/scene-graph.json embedded as the fallback graph)
  - t/*.jpg      (360x270 thumbnails, for the map view and side panel)
  - p/*.jpg      (1280x960 previews, for the Walk / first-person view)

Usage (from repo root):
  python3 tools/scene-graph-editor/build.py

Then publish tools/scene-graph-editor/dist/index.html as a claude.ai Artifact
(with capabilities: {"db": {}}) and pass every t/*.jpg and p/*.jpg as `files`
alongside it. See docs/SESSION_HANDOFF.md for the full publish/sync workflow.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, 'dist')

def main():
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
    html = tpl.replace('__GRAPH__', json.dumps(graph, separators=(',', ':')))

    os.makedirs(os.path.join(DIST, 't'), exist_ok=True)
    os.makedirs(os.path.join(DIST, 'p'), exist_ok=True)
    open(os.path.join(DIST, 'index.html'), 'w').write(html)

    n = 0
    for node_id, node in graph['nodes'].items():
        src = os.path.join(ROOT, 'photos-working', node['file'])
        if not os.path.exists(src):
            print(f'  ! missing photo for {node_id}: {src}')
            continue
        im = Image.open(src)
        t = im.copy(); t.thumbnail((360, 270)); t.save(os.path.join(DIST, 't', node_id + '.jpg'), quality=70)
        p = im.copy(); p.thumbnail((1280, 960)); p.save(os.path.join(DIST, 'p', node_id + '.jpg'), quality=78)
        n += 1
    print(f'Built {DIST}/index.html with {len(graph["nodes"])} nodes, {len(graph["edges"])} edges, {n} photo pairs.')

if __name__ == '__main__':
    main()
