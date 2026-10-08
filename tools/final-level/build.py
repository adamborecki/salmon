#!/usr/bin/env python3
"""
Builds the SUPER SECRET FINAL LEVEL into tools/final-level/dist/ (or --out DIR):
  index.html   the page, with content/final-battle.json inlined
  battle.js    the battle engine (the page imports it as a module)
  p/*.jpg      the party's portraits (the same crops as the gameplay slice's title card), and the
               boss's photo if content boss.photo names one (none yet: the page draws a silhouette)

  python3 tools/final-level/build.py
  cd tools/final-level/dist && python3 -m http.server 8140      # then open http://localhost:8140/
  python3 tools/final-level/build.py --out tools/public-site/dist/final   # what the public site does
"""
import argparse, importlib.util, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(HERE, 'dist'))
    out = ap.parse_args().out
    try:
        from PIL import Image
    except ImportError:
        sys.exit('Needs Pillow: pip3 install Pillow')
    # the portrait crops live with the gameplay slice's build (one place to change them)
    spec = importlib.util.spec_from_file_location('slice_build', os.path.join(ROOT, 'tools', 'gameplay-slice', 'build.py'))
    sb = importlib.util.module_from_spec(spec); spec.loader.exec_module(sb)
    content = json.load(open(os.path.join(HERE, 'content', 'final-battle.json')))
    os.makedirs(os.path.join(out, 'p'), exist_ok=True)
    dump = json.dumps(content, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
    open(os.path.join(out, 'index.html'), 'w').write(open(os.path.join(HERE, 'index.html')).read().replace('__BATTLE__', dump))
    shutil.copy(os.path.join(HERE, 'battle.js'), os.path.join(out, 'battle.js'))
    for m in content['party']:
        im = Image.open(os.path.join(ROOT, 'photos-working', 'characters', m['id'] + '.jpg')).convert('RGB').crop(sb.CHARACTERS[m['id']])
        im.thumbnail((240, 240)); im.save(os.path.join(out, 'p', m['id'] + '.jpg'), quality=82)
    if content['boss'].get('photo'):
        im = Image.open(os.path.join(ROOT, 'photos-working', content['boss']['photo'])).convert('RGB'); im.thumbnail((480, 480))
        im.save(os.path.join(out, 'p', 'boss.jpg'), quality=82)
    print(f'Built {out}/index.html: {len(content["party"])} party members vs {content["boss"]["name"]}.')


if __name__ == '__main__':
    main()
