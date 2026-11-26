"""Crop museum photographs down to the painting: drop the plain backdrop around it and the
colour / grey-scale cards photographed beside it. Usage: python tools/v2_crop.py [--apply] [ids...]
Without --apply it only reports (and writes a before/after contact sheet to the folder in $CROP_SHEET)."""
import json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def band(is_bg, min_frac):
    # the widest run of painting (non-backdrop) lines; narrow runs (a colour card) are ignored
    runs, start = [], None
    for i, b in enumerate(list(is_bg) + [True]):
        if not b and start is None: start = i
        if b and start is not None: runs.append((start, i)); start = None
    if not runs: return 0, len(is_bg)
    big = [r for r in runs if r[1] - r[0] >= min_frac * len(is_bg)] or [max(runs, key=lambda r: r[1] - r[0])]
    s, e = max(big, key=lambda r: r[1] - r[0])
    # neighbouring big runs separated by a thin gap belong to the same painting
    for r in big:
        if r[0] >= e and r[0] - e < 0.03 * len(is_bg): e = r[1]
        if r[1] <= s and s - r[1] < 0.03 * len(is_bg): s = r[0]
    return s, e

def crop_box(a):
    g = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.int16)
    H, W = g.shape
    # backdrop = the colour of the outermost strip on the left/right (photo studios use black, grey or white)
    edge = np.concatenate([g[:, :max(3, W // 100)].ravel(), g[:, -max(3, W // 100):].ravel()])
    bg = np.median(edge)
    near = np.abs(g - bg) < 18
    flat = cv2.blur((g - cv2.blur(g, (9, 9))) ** 2, (9, 9)) < 30          # no texture: studio backdrop, not paint
    bgpix = near & flat
    col_bg = bgpix.mean(0) > 0.85
    row_bg = bgpix.mean(1) > 0.85
    x0, x1 = band(col_bg, 0.12); y0, y1 = band(row_bg, 0.12)
    pad = 2
    x0, y0, x1, y1 = max(0, x0 + pad), max(0, y0 + pad), min(W, x1 - pad), min(H, y1 - pad)
    if (x1 - x0) * (y1 - y0) > 0.96 * W * H or (x1 - x0) < 0.15 * W or (y1 - y0) < 0.15 * H: return None
    return x0, y0, x1, y1

if __name__ == '__main__':
    apply = '--apply' in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    col = json.load(open(os.path.join(ROOT, 'js/collection.json')))
    found = []
    for c in col:
        if ids and c['id'] not in ids: continue
        p = os.path.join(ROOT, f"assets/paintings/v2/{c['id']}.jpg")
        im = Image.open(p).convert('RGB'); a = np.array(im)
        b = crop_box(a)
        if not b: continue
        found.append((c, im, b))
        print(c['id'], b, im.size, c['title'][:50])
        if apply:
            out = im.crop(b); out.save(p, quality=86, optimize=True, progressive=True)
            t = out.copy(); t.thumbnail((420, 420)); t.save(os.path.join(ROOT, f"assets/paintings/v2/thumbs/{c['id']}.webp"), quality=78)
            c['size'] = list(out.size); c.pop('parts', None)          # re-read by v2_analyse.py
    if apply: json.dump(col, open(os.path.join(ROOT, 'js/collection.json'), 'w'), indent=1, ensure_ascii=False)
    sheet = os.environ.get('CROP_SHEET')
    if sheet and found:
        tiles = []
        for c, im, b in found:
            t = im.copy(); t.thumbnail((260, 260)); k = t.size[0] / im.size[0]
            d = ImageDraw.Draw(t); d.rectangle([b[0] * k, b[1] * k, b[2] * k, b[3] * k], outline=(255, 40, 40), width=3)
            tile = Image.new('RGB', (270, 290), (30, 30, 30)); tile.paste(t, (5, 5)); ImageDraw.Draw(tile).text((5, 272), c['id'], fill=(230, 230, 230)); tiles.append(tile)
        cols = 6; rows = (len(tiles) + cols - 1) // cols
        S = Image.new('RGB', (cols * 270, rows * 290), (20, 20, 20))
        for i, t in enumerate(tiles): S.paste(t, ((i % cols) * 270, (i // cols) * 290))
        S.save(os.path.join(sheet, 'sheet.jpg'), quality=85)
    print(len(found), 'to crop')
