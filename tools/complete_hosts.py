"""Complete painted animals whose bodies are partly hidden behind other figures, so they
appear whole when they get up and walk (run after segment_hosts.py).

The hidden part's outline is traced by hand (painting pixels). It is filled with the
animal's own coat, quilted from small patches of its visible body (so spots and fur
direction carry on), then shaded for volume: darker underneath and towards the edge,
with a soft painted outline. Large hidden areas are not given to LaMa, which would pull
in the colours of whatever hides them (here, a black bear).

Usage:  python tools/complete_hosts.py
Updates assets/hosts/<id>.png/.webp and hosts.json (box = the whole animal, patchBox =
the area of the painting that is repainted when it leaves).
"""
import json
import numpy as np
import cv2
from PIL import Image

HD = {"hicks": "assets/paintings/hd/peaceable-kingdom.jpg"}
COMPLETE = {
    # a lying leopard: haunch and tail behind the bear
    "hicks-leopard": {"poly": [(1832, 1500), (1878, 1486), (1960, 1498), (2040, 1518), (2100, 1553), (2132, 1608), (2137, 1680),
                               (2122, 1740), (2152, 1772), (2160, 1800), (2136, 1822), (2060, 1827), (1970, 1818), (1878, 1806), (1832, 1798)],
                      "coat": [1700, 1552, 1858, 1692]},
    # (the goat was tried too, but its hidden underside could not be made convincing: it
    #  stays in the painting and does not get up)

meta =json.load(open("assets/hosts/hosts.json"))
rng = np.random.default_rng(7)

import sys
for hid, c in COMPLETE.items():
    if len(sys.argv) > 1 and hid not in sys.argv[1:]: continue
    e = meta[hid]
    img = np.array(Image.open(HD[e["work"]]).convert("RGB"))
    old = e.get("patchBox", e["box"])
    spr = np.array(Image.open(f"assets/hosts/{hid}.png").convert("RGBA"))
    if "patchBox" in e:   # already completed once: start again from the original cut
        raise SystemExit(f"{hid} already completed; re-run segment_hosts.py {hid} first")
    bx0, by0, bx1, by1 = e["box"]
    poly = np.array(c["poly"], np.int32)
    nx0, ny0 = min(bx0, poly[:, 0].min() - 6), min(by0, poly[:, 1].min() - 6)
    nx1, ny1 = max(bx1, poly[:, 0].max() + 6), max(by1, poly[:, 1].max() + 6)
    W, H = nx1 - nx0, ny1 - ny0
    canvas = np.zeros((H, W, 4), np.uint8)
    canvas[by0 - ny0:by0 - ny0 + spr.shape[0], bx0 - nx0:bx0 - nx0 + spr.shape[1]] = spr

    # where the body continues
    region = np.zeros((H, W), np.uint8)
    cv2.fillPoly(region, [poly - [nx0, ny0]], 255)
    have = canvas[..., 3] > 40
    fill = (region > 0) & ~have

    # quilt the coat: overlapping patches with soft edges, random source positions
    cx0, cy0, cx1, cy1 = c["coat"]
    coat = img[cy0:cy1, cx0:cx1].astype(np.float32)
    acc = np.zeros((H, W, 3), np.float32); wsum = np.zeros((H, W), np.float32)
    P = int(min(60, coat.shape[0], coat.shape[1])); step = int(P * 0.77)   # big patches, little overlap: crisp coat
    ramp = np.clip(np.minimum(np.arange(P), np.arange(P)[::-1]) / 7.0, 0, 1) + 1e-3   # only the outer 7 px fade
    win = np.outer(ramp, ramp).astype(np.float32)
    ys, xs = np.where(fill)
    if len(xs):
        for y in range(max(0, ys.min() - P), ys.max() + 1, step):
            for x in range(max(0, xs.min() - P), xs.max() + 1, step):
                sy = rng.integers(0, max(1, coat.shape[0] - P)); sx = rng.integers(0, max(1, coat.shape[1] - P))
                patch = coat[sy:sy + P, sx:sx + P]
                if rng.random() < 0.5: patch = patch[:, ::-1]          # vary the patches so no tiling shows
                if rng.random() < 0.3: patch = patch[::-1, :]
                h, w = min(P, H - y), min(P, W - x)
                if h <= 0 or w <= 0: continue
                acc[y:y + h, x:x + w] += patch[:h, :w] * win[:h, :w, None]
                wsum[y:y + h, x:x + w] += win[:h, :w]
    quilt = acc / np.maximum(wsum, 1e-3)[..., None]
    if c.get("soft"):                                    # a soft coat: no stamped pattern
        quilt = cv2.GaussianBlur(quilt, (0, 0), c["soft"]) + rng.normal(0, 4, quilt.shape).astype(np.float32)
    if c.get("plain"):                                   # a plain white coat: the animal's own cream, with fur grain
        vis = spr[spr[..., 3] > 200][:, :3].astype(np.float32)
        lum = vis.mean(1); cream = vis[lum >= np.percentile(lum, 85)].mean(0)
        grain = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 1.2)
        grain = cv2.filter2D(grain, -1, np.ones((1, 9), np.float32) / 9)   # short horizontal strokes, like painted fur
        quilt = cream[None, None, :] * (1 + 0.06 * grain[..., None])

    # volume: darker towards the underside and the outer edge of the new part
    dist = cv2.distanceTransform((region > 0).astype(np.uint8), cv2.DIST_L2, 5)
    edge = np.clip(1 - dist / 14, 0, 1)
    yy = (np.arange(H)[:, None] - poly[:, 1].min() + ny0) / max(1, int(np.ptp(poly[:, 1])))
    under = np.clip(yy, 0, 1) ** 1.6
    shade = 1 - (0.12 if c.get("plain") else 0.28) * under - (0.16 if c.get("plain") else 0.32) * edge
    quilt = np.clip(quilt * shade[..., None], 0, 255)

    # blend into the existing animal across a soft seam
    soft = cv2.GaussianBlur(fill.astype(np.float32), (0, 0), 3)
    soft = np.where(region > 0, np.maximum(soft, fill.astype(np.float32) * 0.0), 0)
    rgb = canvas[..., :3].astype(np.float32)
    k = np.where(have, soft * 0.5, fill.astype(np.float32))[..., None]
    rgb = rgb * (1 - k) + quilt * k
    alpha = np.maximum(canvas[..., 3].astype(np.float32), cv2.GaussianBlur((region > 0).astype(np.float32) * 255, (0, 0), 1.1))
    out = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.clip(alpha, 0, 255).astype(np.uint8)])
    Image.fromarray(out).save(f"assets/hosts/{hid}.png")
    Image.fromarray(out).save(f"assets/hosts/{hid}.webp", "WEBP", quality=88, method=6)
    e["patchBox"] = old
    e["box"] = [int(nx0), int(ny0), int(nx1), int(ny1)]
    print(hid, "completed:", int(fill.sum()), "px; box", e["box"])

json.dump(meta, open("assets/hosts/hosts.json", "w"), indent=1)
