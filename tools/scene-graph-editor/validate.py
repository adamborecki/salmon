#!/usr/bin/env python3
"""
Sanity checks for docs/scene-graph.json and the committed photo library.

Usage (from repo root):
  python3 tools/scene-graph-editor/validate.py              # checks docs/scene-graph.json
  python3 tools/scene-graph-editor/validate.py some.json    # checks another graph file, e.g. a
                                                             # fresh export of the live Artifact DB
  python3 tools/scene-graph-editor/validate.py --quiet       # errors only (build.py uses this)

Exit status is 1 if any ERROR was found, 0 otherwise. WARN/INFO lines never fail.

What counts as an error (the page would break, the player could get stuck, or the public repo
would leak something):
  - an edge pointing at a node that doesn't exist, or an unknown node/edge kind
  - a node whose photo file is missing
  - a malformed hotspot (fewer than 3 points, or points outside 0-100)
  - the same from/to/kind edge twice
  - a soft-lock: a scene you can walk into from the start but can't walk back out of
    (closeup/screen insets are exempt, since the Back button always reverses them)
  - GPS metadata in any committed photo (the repo is public)

Accepts both the repo file shape ({photos_root, nodes, edges}) and the live Artifact DB doc
shape ({json: "<compact graph>", updated}) so a raw ArtifactData export can be checked as-is.
"""
import csv, glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NODE_KINDS = {'hub', 'waypoint', 'closeup', 'screen', 'character', 'alt', 'omitted'}
EDGE_KINDS = {'walk', 'control', 'closeup'}
START = 'outside-entry'
# the Walk stage is always 4:3; this is its size at a ~390 px-wide phone (measured in Chromium)
PHONE_STAGE_PX = (366, 275)
MIN_TAP_PX = 32


def load_graph(path):
    raw = json.load(open(path))
    if 'json' in raw and 'nodes' not in raw:  # live Artifact DB doc
        raw = json.loads(raw['json'])
    return raw


def check(graph, photos_root, quiet=False):
    errors, warns, infos = [], [], []
    N, E = graph.get('nodes', {}), graph.get('edges', [])

    # ---- nodes ----
    for nid, n in N.items():
        if n.get('kind') not in NODE_KINDS:
            errors.append(f'node {nid}: unknown kind {n.get("kind")!r}')
        f = os.path.join(photos_root, n.get('file', ''))
        if not n.get('file') or not os.path.isfile(f):
            errors.append(f'node {nid}: photo missing ({n.get("file")})')
        if n.get('kind') in ('hub', 'waypoint') and (n.get('plan_x') is None or n.get('plan_y') is None):
            warns.append(f'node {nid}: {n["kind"]} has no floor-plan pose')

    # ---- edges ----
    seen = set()
    for i, e in enumerate(E):
        tag = f'edge #{i} {e.get("from")} -> {e.get("to")}'
        for end in ('from', 'to'):
            if e.get(end) not in N:
                errors.append(f'{tag}: {end} node does not exist')
        if e.get('kind') not in EDGE_KINDS:
            errors.append(f'{tag}: unknown kind {e.get("kind")!r}')
        key = (e.get('from'), e.get('to'), e.get('kind'))
        if key in seen:
            errors.append(f'{tag}: duplicate {e.get("kind")} edge')
        seen.add(key)
        hs = e.get('hotspot')
        if hs is not None:
            if e.get('kind') != 'closeup':
                warns.append(f'{tag}: hotspot on a non-closeup edge (ignored by the page)')
            if not isinstance(hs, list) or len(hs) < 3:
                errors.append(f'{tag}: hotspot needs 3+ points')
            else:
                bad = [p for p in hs if not (isinstance(p, dict) and all(isinstance(p.get(k), (int, float)) and 0 <= p[k] <= 100 for k in ('x', 'y')))]
                if bad:
                    errors.append(f'{tag}: hotspot points outside 0-100 or malformed: {bad[:2]}')
                else:
                    w = (max(p['x'] for p in hs) - min(p['x'] for p in hs)) / 100 * PHONE_STAGE_PX[0]
                    h = (max(p['y'] for p in hs) - min(p['y'] for p in hs)) / 100 * PHONE_STAGE_PX[1]
                    if min(w, h) < MIN_TAP_PX:
                        warns.append(f'{tag}: hotspot is only {w:.0f}x{h:.0f} px on a phone (under {MIN_TAP_PX} px is hard to tap)')

    # ---- insets: coverage, and every closeup/screen reachable ----
    closeups = [e for e in E if e.get('kind') == 'closeup']
    missing = [e for e in closeups if not e.get('hotspot')]
    infos.append(f'hotspots: {len(closeups) - len(missing)}/{len(closeups)} closeup edges have one')
    for e in missing:
        infos.append(f'  no hotspot yet: {e["from"]} -> {e["to"]} (reachable from the Insets list only)')
    incoming = {e.get('to') for e in E}
    for nid, n in N.items():
        if n.get('kind') in ('closeup', 'screen') and nid not in incoming:
            warns.append(f'node {nid}: {n["kind"]} with no link into it (unreachable)')

    # ---- soft-locks: walk/control graph from the start ----
    adj, radj = {}, {}
    for e in E:
        if e.get('kind') in ('walk', 'control') and e.get('from') in N and e.get('to') in N:
            adj.setdefault(e['from'], set()).add(e['to'])
            radj.setdefault(e['to'], set()).add(e['from'])

    def reach(src, g):
        out, stack = {src}, [src]
        while stack:
            for nx in g.get(stack.pop(), ()):
                if nx not in out:
                    out.add(nx); stack.append(nx)
        return out

    if START not in N:
        errors.append(f'start scene {START!r} is missing')
    else:
        fwd, back = reach(START, adj), reach(START, radj)
        for nid in sorted(fwd - back):
            errors.append(f'soft-lock: {nid} is reachable from {START} but has no walking route back')
        spatial = {nid for nid, n in N.items() if n.get('kind') in ('hub', 'waypoint')}
        for nid in sorted(spatial - fwd):
            warns.append(f'{N[nid]["kind"]} {nid} cannot be walked to from {START}')

    # ---- reverse pairs whose camera turns don't mirror (often intentional, so INFO only) ----
    by = {(e.get('from'), e.get('to')): e for e in E if e.get('kind') in ('walk', 'control')}
    for (a, b), e in by.items():
        r = by.get((b, a))
        if a < b and r and e.get('turn_degrees') is not None and r.get('turn_degrees') is not None:
            s = (e['turn_degrees'] + r['turn_degrees']) % 360
            s = min(s, 360 - s)
            if s > 15:
                infos.append(f'turns do not mirror: {a} -> {b} {e["turn_degrees"]}, back {r["turn_degrees"]} (off by {s})')

    # ---- manifest <-> graph ----
    mpath = os.path.join(ROOT, 'manifest.csv')
    if os.path.isfile(mpath):
        rows = list(csv.DictReader(open(mpath, newline='')))
        mfiles = {r['working_file'] for r in rows}
        gfiles = {n.get('file') for n in N.values()}
        for f in sorted(gfiles - mfiles):
            warns.append(f'photo {f} is in the graph but has no manifest.csv row')
        for f in sorted(mfiles - gfiles):
            warns.append(f'manifest.csv row {f} has no graph node')
        for r in rows:
            if not os.path.isfile(os.path.join(photos_root, r['working_file'])):
                errors.append(f'manifest.csv row points at a missing photo: {r["working_file"]}')

    # ---- privacy: no GPS in committed photos ----
    try:
        from PIL import Image
        for f in sorted(glob.glob(os.path.join(photos_root, '**', '*.jp*g'), recursive=True)):
            ex = Image.open(f).getexif()
            if 0x8825 in ex or ex.get_ifd(0x8825):
                errors.append(f'GPS metadata present in {os.path.relpath(f, ROOT)} (public repo: strip it)')
    except ImportError:
        warns.append('Pillow not installed, GPS check skipped (pip3 install Pillow)')

    for level, items in (('ERROR', errors), ('WARN', warns), ('INFO', infos)):
        if quiet and level != 'ERROR':
            continue
        for m in items:
            print(f'{level}: {m}')
    print(f'scene graph: {len(N)} nodes, {len(E)} edges; {len(errors)} errors, {len(warns)} warnings')
    return errors


def main(argv):
    quiet = '--quiet' in argv
    args = [a for a in argv if not a.startswith('--')]
    path = args[0] if args else os.path.join(ROOT, 'docs', 'scene-graph.json')
    graph = load_graph(path)
    photos_root = os.path.join(ROOT, graph.get('photos_root') or 'photos-working')
    return 1 if check(graph, photos_root, quiet) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
