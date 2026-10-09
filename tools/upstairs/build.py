#!/usr/bin/env python3
"""
Builds the upstairs signal-flow page (BH208 + BH209) into tools/upstairs/dist/ (or --out DIR):
  index.html   the page, with content/upstairs.json inlined
  p/*.jpg      the photos (already anonymized and stripped of metadata when they were added)
  t/*.jpg      640 px thumbnails of them

Checks the content first (ids, statuses, sources, layout bounds) and refuses photos with GPS data.

  python3 tools/upstairs/build.py
  cd tools/upstairs/dist && python3 -m http.server 8150      # then open http://localhost:8150/
  python3 tools/upstairs/build.py --out tools/public-site/dist/upstairs   # what the public site does
"""
import argparse, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WIDTH = 420  # the diagram's viewBox width (index.html)


def check(c):
    errs = []
    st, kinds, src = set(c['statuses']), set(c['kinds']), set(c['sources'])
    rooms = {r['id'] for r in c['rooms']}
    dev = {}
    for d in c['devices']:
        if d['id'] in dev: errs.append(f'duplicate device id {d["id"]}')
        dev[d['id']] = d
        if d['status'] not in st: errs.append(f'device {d["id"]}: unknown status {d["status"]}')
        if d['room'] not in rooms: errs.append(f'device {d["id"]}: unknown room {d["room"]}')
        if d['x'] < 0 or d['x'] + d['w'] > WIDTH: errs.append(f'device {d["id"]}: outside the {WIDTH}-wide diagram')
        for n in d.get('notes', []):
            if n['status'] not in st: errs.append(f'device {d["id"]}: note with unknown status {n["status"]}')
            if n.get('source') and n['source'] not in src: errs.append(f'device {d["id"]}: unknown source {n["source"]}')
    links = set()
    for l in c['links']:
        if l['id'] in links: errs.append(f'duplicate link id {l["id"]}')
        links.add(l['id'])
        for end in ('from', 'to'):
            if l[end] not in dev: errs.append(f'link {l["id"]}: {end} {l[end]!r} is not a device')
        if l['kind'] not in kinds: errs.append(f'link {l["id"]}: unknown kind {l["kind"]}')
        if l['status'] not in st: errs.append(f'link {l["id"]}: unknown status {l["status"]}')
        if l.get('source') and l['source'] not in src: errs.append(f'link {l["id"]}: unknown source {l["source"]}')
    for p in c['paths']:
        for lid in p['links']:
            if lid not in links: errs.append(f'path {p["name"]}: no link {lid}')
    for q in c['questions']:
        if q.get('about') and q['about'] not in dev: errs.append(f'question about unknown device {q["about"]}')
    for d in c['dante_devices']:
        if d['status'] not in st: errs.append(f'dante device {d["name"]}: unknown status {d["status"]}')
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(HERE, 'dist'))
    out = ap.parse_args().out
    try:
        from PIL import Image
    except ImportError:
        sys.exit('Needs Pillow: pip3 install Pillow')
    content = json.load(open(os.path.join(HERE, 'content', 'upstairs.json')))
    errs = check(content)
    for p in content['photos']:
        f = os.path.join(HERE, 'photos', p['file'])
        if not os.path.isfile(f): errs.append(f'missing photo {p["file"]}'); continue
        ex = Image.open(f).getexif()
        if 0x8825 in ex or ex.get_ifd(0x8825): errs.append(f'GPS metadata in photos/{p["file"]} (public repo: strip it)')
    if errs:
        sys.exit('upstairs content errors:\n  ' + '\n  '.join(errs))
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(os.path.join(out, 'p')); os.makedirs(os.path.join(out, 't'))
    dump = json.dumps(content, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
    open(os.path.join(out, 'index.html'), 'w').write(open(os.path.join(HERE, 'index.html')).read().replace('__DATA__', dump))
    for p in content['photos']:
        src = os.path.join(HERE, 'photos', p['file'])
        shutil.copy(src, os.path.join(out, 'p', p['file']))
        im = Image.open(src).convert('RGB'); im.thumbnail((640, 640)); im.save(os.path.join(out, 't', p['file']), quality=78)
    print(f'Built {out}/index.html: {len(content["devices"])} devices, {len(content["links"])} links, '
          f'{len(content["questions"])} open questions.')


if __name__ == '__main__':
    main()
