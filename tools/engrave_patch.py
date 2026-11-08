"""Re-engrave inpainted areas of the Dürer engraving.

LaMa fills hidden or emptied areas with soft, blurry tone, which looks wrong in an
engraving where every tone is made of cut lines. This finds the pixels that differ
from the original print (the repainted parts) and redraws their tone as fine hatching
in Dürer's manner: parallel lines that follow a gentle curve, cross-hatching in the
darks, and a little paper showing through.

Usage: python tools/engrave_patch.py
Updates assets/hosts/durer-*-patch.jpg and assets/hosts/durer-dog.(png|webp) in place.
"""
import json
import numpy as np
import cv2
from PIL import Image

HD = np.array(Image.open("assets/paintings/hd/knight-death-devil.jpg").convert("RGB")).astype(np.float32)
meta = json.load(open("assets/hosts/hosts.json"))
PAPER = np.array([229, 219, 196], np.float32)
INK = np.array([34, 29, 24], np.float32)


def hatch(lum, x0, y0):
    """Engraved rendering of a luminance map (0..1), in painting coordinates."""
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    X, Y = xx + x0, yy + y0
    t = np.clip(lum, 0, 1) ** 0.9
    wave = np.sin(X / 90.0) * 6                      # lines curve gently, like a burin following form
    a = np.abs(((X + Y + wave) / 4.2) % 1 - 0.5) * 2
    b = np.abs(((X - Y - wave + 5000) / 4.8) % 1 - 0.5) * 2
    c = np.abs(((Y + wave * 0.5) / 5.5) % 1 - 0.5) * 2
    ink = (a > 0.32 + t * 0.62).astype(np.float32)
    ink = np.maximum(ink, ((t < 0.5) & (b > 0.42 + t * 1.0)).astype(np.float32))
    ink = np.maximum(ink, ((t < 0.25) & (c > 0.5 + t * 1.6)).astype(np.float32))
    ink = cv2.GaussianBlur(ink, (0, 0), 0.6)
    return PAPER[None, None, :] * (1 - ink[..., None]) + INK[None, None, :] * ink[..., None]


def reengrave(img, orig, x0, y0, extra_mask=None):
    """Redraw only the pixels that were invented by inpainting."""
    diff = np.abs(img.astype(np.float32) - orig).mean(-1)
    m = (diff > 16).astype(np.uint8) * 255
    if extra_mask is not None: m = m & extra_mask
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    soft = cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), 2.5)[..., None]
    lum = cv2.GaussianBlur(img.astype(np.float32).mean(-1) / 255, (0, 0), 2.0)
    lum = (lum - 0.1) / 0.8                          # stretch: the soft fill is low in contrast
    out = img.astype(np.float32) * (1 - soft) + hatch(lum, x0, y0) * soft
    return np.clip(out, 0, 255).astype(np.uint8), int((m > 0).sum())


for hid, e in meta.items():
    if e["work"] != "durer": continue
    x0, y0, x1, y1 = e["box"]
    orig = HD[y0:y1, x0:x1]
    try:
        patch = np.array(Image.open(f"assets/hosts/{hid}-patch.jpg").convert("RGB"))
        out, n = reengrave(patch, orig, x0, y0)
        Image.fromarray(out).save(f"assets/hosts/{hid}-patch.jpg", quality=90)
        print(hid, "patch re-engraved px:", n)
    except FileNotFoundError:
        pass
    # the sprite: re-engrave the parts of the body LaMa completed (inside the alpha)
    spr = np.array(Image.open(f"assets/hosts/{hid}.png").convert("RGBA"))
    a = (spr[..., 3] > 128).astype(np.uint8) * 255
    out, n = reengrave(spr[..., :3], orig[:spr.shape[0], :spr.shape[1]], x0, y0, a)
    spr[..., :3] = out
    Image.fromarray(spr).save(f"assets/hosts/{hid}.png")
    Image.fromarray(spr).save(f"assets/hosts/{hid}.webp", "WEBP", quality=88, method=6)
    print(hid, "sprite re-engraved px:", n)
