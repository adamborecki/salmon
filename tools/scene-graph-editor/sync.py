#!/usr/bin/env python3
"""
Helpers for keeping docs/scene-graph.json and the live Artifact's database copy in step.

The live page stores the graph in its db doc `graph/main` as {json: "<compact graph>", updated}.
An agent reads it with ArtifactData (get, collection "graph", doc_id "main", out_dir <dir>),
which saves that doc as <dir>/graph/main.json. These commands take that file directly.

  python3 tools/scene-graph-editor/sync.py diff A B
      Field-level differences between two graphs (either file shape). Exit 1 if they differ.

  python3 tools/scene-graph-editor/sync.py pull <db-export.json>
      Overwrite docs/scene-graph.json with the live graph (keeps photos_root, same formatting
      as the committed file), after printing the diff. Run validate.py afterwards.

  python3 tools/scene-graph-editor/sync.py payload <out.json> [graph.json]
      Write a db doc ({json, updated}) from docs/scene-graph.json (or graph.json), ready for
      ArtifactData update with file_path=<out.json> and if_version=<the version you last read>.
      The json string is byte-identical to what the page itself would save for the same graph.
"""
import datetime, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPO_GRAPH = os.path.join(ROOT, 'docs', 'scene-graph.json')


def load(path):
    raw = json.load(open(path))
    if 'json' in raw and 'nodes' not in raw:
        raw = json.loads(raw['json'])
    return {'nodes': raw['nodes'], 'edges': raw['edges']}


def edge_key(e):
    return f'{e.get("from")} -> {e.get("to")} ({e.get("kind")})'


def diff(a, b):
    out = []
    for nid in sorted(set(a['nodes']) | set(b['nodes'])):
        x, y = a['nodes'].get(nid), b['nodes'].get(nid)
        if x is None:
            out.append(f'+ node {nid}')
        elif y is None:
            out.append(f'- node {nid}')
        else:
            for k in sorted(set(x) | set(y)):
                if x.get(k) != y.get(k):
                    out.append(f'~ node {nid}.{k}: {x.get(k)!r} -> {y.get(k)!r}')
    ea = {edge_key(e): e for e in a['edges']}
    eb = {edge_key(e): e for e in b['edges']}
    for k in sorted(set(ea) | set(eb)):
        x, y = ea.get(k), eb.get(k)
        if x is None:
            out.append(f'+ edge {k}')
        elif y is None:
            out.append(f'- edge {k}')
        else:
            for f in sorted(set(x) | set(y)):
                if x.get(f) != y.get(f):
                    vx, vy = x.get(f), y.get(f)
                    if f == 'hotspot':
                        vx = f'{len(vx)} pts' if vx else None
                        vy = f'{len(vy)} pts' if vy else None
                    out.append(f'~ edge {k}.{f}: {vx!r} -> {vy!r}')
    if not out and [edge_key(e) for e in a['edges']] != [edge_key(e) for e in b['edges']]:
        out.append('~ edge order differs (content identical)')
    return out


def write_repo(graph):
    doc = {'photos_root': 'photos-working', 'nodes': graph['nodes'], 'edges': graph['edges']}
    with open(REPO_GRAPH, 'w') as f:
        f.write(json.dumps(doc, indent=1, ensure_ascii=False))


def main(argv):
    if not argv:
        print(__doc__); return 2
    cmd, args = argv[0], argv[1:]
    if cmd == 'diff' and len(args) == 2:
        d = diff(load(args[0]), load(args[1]))
        print('\n'.join(d) if d else 'identical')
        return 1 if d else 0
    if cmd == 'pull' and len(args) == 1:
        live, repo = load(args[0]), load(REPO_GRAPH)
        d = diff(repo, live)
        print('\n'.join(d) if d else 'repo already matches the live graph')
        if d:
            write_repo(live)
            print(f'wrote {os.path.relpath(REPO_GRAPH, ROOT)}')
        return 0
    if cmd == 'payload' and len(args) in (1, 2):
        g = load(args[1] if len(args) == 2 else REPO_GRAPH)
        doc = {'json': json.dumps(g, separators=(',', ':'), ensure_ascii=False),
               'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'}
        json.dump(doc, open(args[0], 'w'), ensure_ascii=False)
        print(f'wrote {args[0]} ({len(doc["json"])} chars of graph json)')
        return 0
    print(__doc__); return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
