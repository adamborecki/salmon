#!/usr/bin/env python3
"""
Writes public copies of the photos that show people (tools/public-site/people.json), so the public
site never shows an identifiable person apart from the three character portraits the owner cleared.
Each marked person becomes a heavy blur with a plain grey figure on top; unlinked alt photos with
people are blurred entirely. The originals in photos-working/ (and the live editor) are untouched.

  python3 tools/public-site/anonymize.py <out-dir>        # writes <out-dir>/<node file path>
  python3 tools/public-site/anonymize.py <out-dir> --check  # also draws the boxes, for review

Every node flagged `people: true` in docs/scene-graph.json must be covered (kept, blurred whole,
or listed with boxes), or this refuses to run.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FIG, EDGE = (148, 158, 170, 238), (92, 102, 116, 255)


def blur_region(im, box, strength=1.0):
    """pixelate hard, then blur, inside the box (grown a little), pasted back with a soft edge"""
    W, H = im.size
    x0, y0, x1, y1 = box
    gx, gy = (x1 - x0) * 0.06, (y1 - y0) * 0.06
    x0, y0, x1, y1 = max(0, int(x0 - gx)), max(0, int(y0 - gy)), min(W, int(x1 + gx)), min(H, int(y1 + gy))
    w, h = x1 - x0, y1 - y0
    if w < 4 or h < 4:
        return
    crop = im.crop((x0, y0, x1, y1))
    small = crop.resize((max(2, int(w / (28 / strength))), max(2, int(h / (28 / strength)))), Image.BOX)
    crop = small.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(max(3, min(w, h) / 14)))
    mask = Image.new('L', (w, h), 0)
    m = int(min(w, h) * 0.12)
    ImageDraw.Draw(mask).rounded_rectangle((m // 2, m // 2, w - m // 2, h - m // 2), radius=m, fill=255)
    im.paste(crop, (x0, y0), mask.filter(ImageFilter.GaussianBlur(max(1, m / 2))))


def figure(d, x0, y0, x1, y1, bust=False):
    """a plain, deliberately generic standing figure (or head and shoulders) filling the box"""
    w, h = x1 - x0, y1 - y0
    cx = (x0 + x1) / 2
    r = min(w * 0.26, h * (0.2 if bust else 0.105))
    lw = max(1, int(r * 0.12))
    hy = y0 + r * 1.1
    if bust:
        sw = min(w * 0.9, r * 4.2)
        d.rounded_rectangle((cx - sw / 2, hy + r * 1.05, cx + sw / 2, y1), radius=r * 0.9, fill=FIG, outline=EDGE, width=lw)
    else:
        tw = min(w * 0.78, r * 3.1)
        top, hip = hy + r * 1.15, y0 + h * 0.56
        lg = tw * 0.4
        for sx in (cx - tw / 2 + tw * 0.04, cx + tw / 2 - tw * 0.04 - lg):
            d.rounded_rectangle((sx, hip - r * 0.3, sx + lg, y1), radius=lg * 0.45, fill=FIG, outline=EDGE, width=lw)
        d.rounded_rectangle((cx - tw / 2, top, cx + tw / 2, hip + r * 0.2), radius=r * 0.7, fill=FIG, outline=EDGE, width=lw)
    d.ellipse((cx - r, hy - r, cx + r, hy + r), fill=FIG, outline=EDGE, width=lw)


def anonymize(im, marks, check=False):
    im = im.convert('RGB')
    W, H = im.size
    px = lambda b: (b[0] * W / 100, b[1] * H / 100, b[2] * W / 100, b[3] * H / 100)
    for m in marks:
        blur_region(im, px(m['box']))
    over = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for m in marks:
        x0, y0, x1, y1 = px(m['box'])
        if m['kind'] == 'person':
            figure(d, x0, y0, x1, y1)
        elif m['kind'] == 'bust':
            figure(d, x0, y0, x1, y1, bust=True)
        elif m['kind'] == 'group':
            n = m['n']; step = (x1 - x0) / n
            for i in range(n):                       # slight, fixed height variation so a row reads as people
                dy = (y1 - y0) * (0.04 * ((i * 7) % 3))
                figure(d, x0 + i * step - step * 0.1, y0 + dy, x0 + (i + 1) * step + step * 0.1, y1)
        if check:
            d.rectangle((x0, y0, x1, y1), outline=(255, 0, 255, 255), width=3)
    return Image.alpha_composite(im.convert('RGBA'), over).convert('RGB')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    out, check = sys.argv[1], '--check' in sys.argv
    spec = json.load(open(os.path.join(HERE, 'people.json')))
    graph = json.load(open(os.path.join(ROOT, 'docs', 'scene-graph.json')))
    photos = os.path.join(ROOT, graph.get('photos_root') or 'photos-working')
    covered = set(spec['keep']) | set(spec['whole_photo_blur']) | set(spec['scenes'])
    missing = [k for k, n in graph['nodes'].items() if n.get('people') and k not in covered]
    if missing:
        sys.exit('people.json does not cover these scenes flagged people: true: ' + ', '.join(missing))
    n = 0
    for k, node in graph['nodes'].items():
        if k in spec['keep'] or (k not in spec['whole_photo_blur'] and k not in spec['scenes']):
            continue
        im = Image.open(os.path.join(photos, node['file']))
        if k in spec['whole_photo_blur']:
            im = im.convert('RGB'); w, h = im.size
            im = im.resize((max(2, w // 40), max(2, h // 40)), Image.BOX).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(12))
        else:
            im = anonymize(im, spec['scenes'][k], check)
        dst = os.path.join(out, node['file'])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst, quality=88)                    # no EXIF is carried over
        n += 1
    print(f'anonymized {n} photos into {out}')


if __name__ == '__main__':
    main()
