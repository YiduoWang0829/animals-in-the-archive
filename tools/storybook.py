"""Turn a transparent cut-out into a storybook ink-and-watercolour illustration
(loose ink line, pale flat washes, pigment pooling at the edges, paper showing
through). An original treatment, not a copy of any book's drawings.

Usage: python tools/storybook.py [names...]
Reads  assets/animals/cutouts/<name>.png
Writes assets/animals/storybook/<name>.png
"""
import os, sys
import numpy as np
import cv2
from PIL import Image

SRC, DST = "assets/animals/cutouts", "assets/animals/storybook"
os.makedirs(DST, exist_ok=True)
rng = np.random.default_rng(7)

PAPER = np.array([244, 238, 224], np.float32)      # warm paper white
INK = np.array([58, 44, 34], np.float32)           # sepia-black ink
LONG = 640                                          # output size, long side


def noise(h, w, scale, seed):
    """Smooth value noise in [0,1] (blurred random field)."""
    r = np.random.default_rng(seed).random((h // scale + 2, w // scale + 2)).astype(np.float32)
    return cv2.resize(r, (w, h), interpolation=cv2.INTER_CUBIC).clip(0, 1)


def wobble_line(mask, width, seed):
    """Ink outline of a binary mask, with slightly varying width and a hand tremor."""
    h, w = mask.shape
    # displace the mask a little before tracing → shaky line
    dx = (noise(h, w, 24, seed) - 0.5) * 3.0
    dy = (noise(h, w, 24, seed + 1) - 0.5) * 3.0
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    m = cv2.remap(mask, gx + dx, gy + dy, cv2.INTER_LINEAR)
    edge = cv2.morphologyEx(m, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(np.float32) / 255
    thick = 0.6 + 0.8 * noise(h, w, 40, seed + 2)          # pressure variation
    k = max(1, int(round(width)))
    edge = cv2.dilate(edge, np.ones((k, k), np.uint8))
    edge = cv2.GaussianBlur(edge, (3, 3), 0.7)
    return np.clip(edge * thick * 1.3, 0, 1)


def storybook(rgba):
    a0 = rgba[..., 3]
    h, w = a0.shape
    s = LONG / max(h, w)
    rgba = cv2.resize(rgba, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    pad = 24
    rgba = cv2.copyMakeBorder(rgba, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0))
    h, w = rgba.shape[:2]
    rgb = rgba[..., :3].astype(np.uint8)
    mask = (rgba[..., 3] > 110).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    # 1. smooth local colour (no hard patches): masked, normalised blur of the photo
    m01 = (mask > 0).astype(np.float32)
    flat = cv2.pyrMeanShiftFiltering(rgb, 18, 36)
    sig = max(h, w) * 0.035
    num = cv2.GaussianBlur(flat.astype(np.float32) * m01[..., None], (0, 0), sig)
    den = cv2.GaussianBlur(m01, (0, 0), sig)[..., None]
    colour = num / np.maximum(den, 1e-4)
    g = colour.mean(-1, keepdims=True)
    colour = np.clip(g + (colour - g) * 1.4, 0, 255)               # a touch more colour than the photo
    base = colour * 0.62 + PAPER * 0.38                            # pale first wash

    # 2. glazes: shading from blurred luminance, stacked as 3 soft layers;
    #    pigment pools slightly along each layer's edge
    gray = cv2.cvtColor(flat, cv2.COLOR_RGB2GRAY).astype(np.float32)
    sl = max(h, w) * 0.012                                        # masked blur: no dark halo at the border
    L = cv2.GaussianBlur(gray * m01, (0, 0), sl) / np.maximum(cv2.GaussianBlur(m01, (0, 0), sl), 1e-4)
    vals = L[mask > 0]
    out = base.copy()
    for i, q in enumerate((55, 30, 12)):                          # lighter → darker glazes
        t = np.percentile(vals, q)
        soft = np.clip((t - L) / 10.0 + 0.5, 0, 1)                 # soft-edged layer
        soft = soft * (0.9 + 0.2 * noise(h, w, 50, 20 + i))       # uneven water
        edge = np.clip(cv2.Laplacian(cv2.GaussianBlur(soft, (0, 0), 1.2), cv2.CV_32F) * -6, 0, 1)
        dark = 0.13 + 0.035 * i
        out = out * (1 - (soft * dark + edge * 0.12)[..., None])
    out = np.where(m01[..., None] > 0, out, PAPER)

    # 3. wash is slightly mis-registered against the line, like a quick hand
    M = np.float32([[1, 0, 1.5], [0, 1, -1.0]])
    out = cv2.warpAffine(out, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    wash_mask = cv2.warpAffine(mask, M, (w, h))
    wash_mask = cv2.erode(wash_mask, np.ones((3, 3), np.uint8))

    # 4. ink: outer outline + a few strong inner lines
    line = wobble_line(mask, 1.8, 3)
    gray = gray.astype(np.uint8)
    inner = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 1.2), 60, 140)
    inner[cv2.erode(mask, np.ones((9, 9), np.uint8)) == 0] = 0
    # keep only longer strokes so it stays sparse
    n, cc, stats, _ = cv2.connectedComponentsWithStats(inner, 8)
    keep = np.zeros_like(inner)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 55: keep[cc == i] = 255
    inner = cv2.GaussianBlur(keep.astype(np.float32) / 255, (3, 3), 0.6) * 0.55
    # eyes and noses: small, very dark spots become solid ink dots
    lum = gray.astype(np.float32)
    thr = np.percentile(lum[mask > 0], 6)
    dark = ((lum < thr) & (cv2.erode(mask, np.ones((7, 7), np.uint8)) > 0)).astype(np.uint8)
    n2, cc2, st2, _ = cv2.connectedComponentsWithStats(dark, 8)
    dots = np.zeros((h, w), np.float32)
    area = (mask > 0).sum()
    for i in range(1, n2):
        if 6 < st2[i, cv2.CC_STAT_AREA] < area * 0.004: dots[cc2 == i] = 1
    dots = cv2.GaussianBlur(cv2.dilate(dots, np.ones((2, 2), np.uint8)), (3, 3), 0.6)
    ink = np.clip(np.maximum.reduce([line, inner, dots]), 0, 1)

    # 5. paper grain
    grain = (rng.random((h, w)).astype(np.float32) - 0.5) * 10
    col = out + grain[..., None]
    col = col * (1 - ink[..., None]) + INK * ink[..., None]

    alpha = np.maximum(wash_mask.astype(np.float32) / 255, cv2.dilate(line, np.ones((2, 2), np.uint8)))
    alpha = np.clip(alpha, 0, 1)
    res = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
    ys, xs = np.where(alpha > 0.02)
    return res[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]


names = sys.argv[1:] or [f[:-4] for f in sorted(os.listdir(SRC)) if f.endswith(".png")]
for n in names:
    rgba = np.array(Image.open(f"{SRC}/{n}.png").convert("RGBA"))
    Image.fromarray(storybook(rgba)).save(f"{DST}/{n}.png")
    print("storybook", n)
