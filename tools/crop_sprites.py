"""Crop one painted animal from each painting as a soft-masked sprite.

Usage:  python3 tools/crop_sprites.py
Writes: assets/sprites/<id>.png         sprite with feathered alpha
        assets/sprites/<id>-plate.jpg   painting with the animal softly filled in
        assets/sprites/sprites.json     bounding boxes (painting pixel coords)

Polygons were traced by hand on gridded zooms of each painting.
"""
import json, random
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SPRITES = {
    "eden-lion": {
        "painting": "assets/paintings/garden-of-eden.jpg",
        "feather": 2.5,  # small figure: keep the edge tight
        "poly": [(706, 369), (717, 359), (736, 358), (750, 365), (763, 375), (771, 391),
                 (773, 412), (768, 430), (754, 438), (735, 440), (716, 440), (702, 430),
                 (699, 405), (700, 383)],
    },
    "durer-dog": {
        "painting": "assets/paintings/knight-death-devil.jpg",
        "poly": [(443, 935), (468, 914), (508, 902), (545, 904), (576, 919), (602, 934),
                 (625, 955), (642, 975), (604, 1010), (562, 1032), (532, 1013),
                 (504, 986), (470, 976), (443, 961)],
    },
    "marc-deer": {
        "painting": "assets/paintings/fate-of-the-animals.jpg",
        "poly": [(454, 289), (481, 284), (506, 320), (531, 370), (546, 420), (551, 470),
                 (542, 518), (561, 560), (541, 601), (511, 641), (471, 681), (439, 671),
                 (430, 621), (400, 581), (387, 541), (400, 500), (440, 470), (474, 450),
                 (489, 400), (470, 340)],
    },
}
FEATHER = 4   # px of soft edge
PAD = 12      # margin around the polygon


def wobble(poly, amount=2.0, seed=7):
    """Add a little hand-made irregularity to the outline (subdivide + jitter)."""
    rnd = random.Random(seed)
    out = []
    for i, (x0, y0) in enumerate(poly):
        x1, y1 = poly[(i + 1) % len(poly)]
        for t in (0, 0.33, 0.66):
            out.append((x0 + (x1 - x0) * t + rnd.uniform(-amount, amount),
                        y0 + (y1 - y0) * t + rnd.uniform(-amount, amount)))
    return out


def fill_plate(img, mask):
    """Fill the masked hole by repeatedly blurring known pixels inward (cheap inpaint)."""
    a = np.asarray(img, dtype=np.float32)
    known = (np.asarray(mask) < 8).astype(np.float32)
    blur = lambda arr, r: gaussian_filter(arr.astype(np.float32), r)
    out = a.copy()
    # normalised convolution from coarse to fine: each hole pixel takes the
    # weighted average of nearby known pixels; finer scales overwrite where valid
    for r in (48, 24, 12, 6):
        den = blur(known, r)
        num = np.stack([blur(a[..., c] * known, r) for c in range(3)], -1)
        est = num / np.maximum(den[..., None], 1e-6)
        ok = (den > 0.15)[..., None] & (known[..., None] == 0)
        out = np.where(ok, est, out)
    soft = np.asarray(mask.filter(ImageFilter.GaussianBlur(FEATHER)), dtype=np.float32)[..., None] / 255
    res = a * (1 - soft) + out * soft
    return Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))


meta = {}
for sid, s in SPRITES.items():
    img = Image.open(s["painting"]).convert("RGB")
    W, H = img.size
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(wobble(s["poly"]), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(s.get("feather", FEATHER)))

    xs = [p[0] for p in s["poly"]]; ys = [p[1] for p in s["poly"]]
    box = (max(0, min(xs) - PAD), max(0, min(ys) - PAD),
           min(W, max(xs) + PAD), min(H, max(ys) + PAD))

    sprite = img.crop(box).convert("RGBA")
    sprite.putalpha(mask.crop(box))
    sprite.save(f"assets/sprites/{sid}.png")

    # a slightly larger fill so the sprite can sway without revealing the original
    hole = Image.new("L", (W, H), 0)
    ImageDraw.Draw(hole).polygon(s["poly"], fill=255)
    hole = hole.filter(ImageFilter.MaxFilter(9))
    fill_plate(img, hole).save(f"assets/sprites/{sid}-plate.jpg", quality=90)

    meta[sid] = {"painting": s["painting"], "size": [W, H],
                 "box": list(box), "sprite": f"assets/sprites/{sid}.png",
                 "plate": f"assets/sprites/{sid}-plate.jpg"}
    print(sid, box)

json.dump(meta, open("assets/sprites/sprites.json", "w"), indent=2)
