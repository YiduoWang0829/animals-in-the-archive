"""Cut whole painted animals ("hosts") out of the HD paintings.

1. Segment Anything (SAM, facebook/sam-vit-base) segments each animal from a box
   (+ optional positive/negative points) placed by hand on a gridded view.
2. Small gaps where something overlaps the animal (a branch, a horse's leg) are
   closed morphologically and repainted with LaMa, so the sprite is a whole animal.
3. LaMa also paints the animal *out* of the painting; only that patch is saved,
   so the page can reveal the empty ground when the animal walks away.

Usage:  python tools/segment_hosts.py [host ids...]
Writes: assets/hosts/<id>.png         sprite (RGBA, feathered edge)
        assets/hosts/<id>-patch.jpg   painting with the animal removed (bbox crop)
        assets/hosts/hosts.json       boxes in painting pixels (HD), patch rects
"""
import json, os, sys
import numpy as np
import cv2
import torch
from PIL import Image
from transformers import SamModel, SamProcessor
from simple_lama_inpainting.utils import prepare_img_and_mask, download_model
from simple_lama_inpainting.models.model import LAMA_MODEL_URL


class Lama:
    """LaMa inpainting (big-lama torchscript), loaded onto the CPU."""
    def __init__(self):
        self.model = torch.jit.load(download_model(LAMA_MODEL_URL), map_location="cpu").eval()

    def __call__(self, image, mask):
        img, m = prepare_img_and_mask(image, mask, torch.device("cpu"))
        with torch.inference_mode():
            out = self.model(img, m)[0].permute(1, 2, 0).cpu().numpy()
        return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8))

HD = {"eden": "assets/paintings/hd/garden-of-eden.jpg",
      "durer": "assets/paintings/hd/knight-death-devil.jpg",
      "marc": "assets/paintings/hd/fate-of-the-animals.jpg"}

# box = [x0, y0, x1, y1] in HD pixels; pos/neg = extra click points; close = gap-closing kernel
HOSTS = {
    "eden-lion":     {"work": "eden", "box": [1745, 895, 1945, 1105], "close": 9},
    "eden-horse":    {"work": "eden", "box": [1300, 815, 1420, 935], "close": 5,
                      "pos": [[1350, 880]], "neg": [[1405, 790], [1415, 860]],
                      "clip": [(1355, 810), (1372, 811), (1387, 822), (1400, 840), (1402, 870), (1396, 897), (1391, 922),
                               (1390, 944), (1376, 944), (1374, 916), (1367, 908), (1363, 937), (1350, 939), (1348, 916),
                               (1334, 906), (1320, 905), (1322, 880), (1326, 858), (1336, 844), (1349, 838), (1351, 824)]},
    "eden-deer":     {"work": "eden", "box": [1392, 778, 1545, 992], "close": 5,
                      "pos": [[1405, 830], [1425, 870], [1470, 900], [1445, 800]],
                      "neg": [[1485, 845], [1375, 860], [1400, 955], [1530, 820]],
                      "clip": [(1393, 826), (1408, 814), (1418, 798), (1416, 778), (1440, 776), (1470, 788), (1500, 773),
                               (1522, 784), (1497, 806), (1460, 816), (1432, 832), (1430, 852), (1442, 868), (1500, 878),
                               (1531, 894), (1542, 930), (1538, 995), (1520, 995), (1515, 948), (1490, 948), (1489, 995),
                               (1474, 995), (1469, 948), (1446, 938), (1440, 995), (1424, 995), (1418, 930), (1408, 882),
                               (1400, 852), (1388, 842)]},
    "eden-rabbit":   {"work": "eden", "box": [616, 1336, 720, 1430], "close": 5, "pos": [[660, 1395]]},
    "eden-dog":      {"work": "eden", "box": [710, 1238, 832, 1374], "close": 7,
                      "pos": [[760, 1300]], "neg": [[812, 1378], [760, 1225]]},
    "eden-peacock":  {"work": "eden", "box": [790, 1045, 1160, 1535], "close": 9},
    "durer-horse":   {"work": "durer", "box": [60, 190, 1800, 2380], "close": 15, "in_place": True,
                      "pos": [[900, 1450], [300, 900], [950, 700], [1500, 1700]],
                      "neg": [[560, 750], [150, 1550], [1450, 950], [1000, 1950], [100, 2100]]},
    "durer-dog":     {"work": "durer", "box": [820, 1730, 1600, 2200], "close": 61,
                      "pos": [[920, 1800], [1080, 1880], [1110, 1990], [975, 2100], [1450, 1980], [1350, 1920]],
                      "neg": [[910, 2010], [1200, 2000], [1150, 2150], [1330, 2180], [760, 1760]]},
    "marc-deer":     {"work": "marc", "box": [940, 690, 1460, 1720], "close": 15},
    "marc-boar":     {"work": "marc", "box": [60, 1120, 820, 1720], "close": 15},
}

dev = "mps" if torch.backends.mps.is_available() else "cpu"
proc = SamProcessor.from_pretrained("facebook/sam-vit-base")
sam = SamModel.from_pretrained("facebook/sam-vit-base").to(dev).eval()
lama = Lama()
os.makedirs("assets/hosts", exist_ok=True)
meta_path = "assets/hosts/hosts.json"
meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
cache = {}


DEPTH = {"eden": "assets/paintings/depth/garden-of-eden.png",
         "durer": "assets/paintings/depth/knight-death-devil.png",
         "marc": "assets/paintings/depth/fate-of-the-animals.png"}


def sam_masks(crop, box, pts=None, labels=None):
    """All 3 multimask outputs of SAM for one prompt, as uint8 arrays + SAM's IoU guess."""
    kw = {}
    if pts:
        kw["input_points"] = [[pts]]; kw["input_labels"] = [[labels]]
    inp = proc(crop, input_boxes=box, return_tensors="pt", **kw)
    inp = {k: (v.float() if v.dtype == torch.float64 else v).to(dev) for k, v in inp.items()}   # MPS has no float64
    with torch.no_grad():
        out = sam(**inp, multimask_output=True)
    masks = proc.image_processor.post_process_masks(out.pred_masks.cpu(), inp["original_sizes"].cpu(),
                                                    inp["reshaped_input_sizes"].cpu())[0][0]
    return [(masks[i].numpy().astype(np.uint8) * 255, float(out.iou_scores[0, 0, i])) for i in range(masks.shape[0])]


def segment(img, h):
    """Try several prompts; keep the SAM mask that best matches a depth-based silhouette."""
    x0, y0, x1, y1 = h["box"]
    m = int(max(x1 - x0, y1 - y0) * 0.15)
    cx0, cy0 = max(0, x0 - m), max(0, y0 - m)
    cx1, cy1 = min(img.width, x1 + m), min(img.height, y1 + m)
    crop = img.crop((cx0, cy0, cx1, cy1))
    box = [[[x0 - cx0, y0 - cy0, x1 - cx0, y1 - cy0]]]
    pos = [[p[0] - cx0, p[1] - cy0] for p in h.get("pos", [])]
    neg = [[p[0] - cx0, p[1] - cy0] for p in h.get("neg", [])]
    cands = sam_masks(crop, box)
    if pos: cands += sam_masks(crop, box, pos, [1] * len(pos))
    if pos and neg: cands += sam_masks(crop, box, pos + neg, [1] * len(pos) + [0] * len(neg))

    # depth prior: inside the box, the nearer pixels (Otsu split of the depth map)
    dep = np.array(Image.open(DEPTH[h["work"]]).convert("L").resize(img.size, Image.BILINEAR))[cy0:cy1, cx0:cx1]
    inbox = np.zeros_like(dep); inbox[y0 - cy0:y1 - cy0, x0 - cx0:x1 - cx0] = 1
    thr, _ = cv2.threshold(dep[inbox > 0].reshape(-1, 1), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    prior = ((dep > thr) & (inbox > 0))
    best, best_score = None, -1
    for mk, iou in cands:
        mb = mk > 0
        if mb.sum() < 50: continue
        inter = (mb & prior).sum(); union = (mb | prior).sum()
        score = inter / max(union, 1) + 0.15 * iou
        if score > best_score: best, best_score = mk, score
    full = np.zeros((img.height, img.width), np.uint8)
    full[cy0:cy1, cx0:cx1] = best
    return full


for hid in (sys.argv[1:] or HOSTS):
    h = HOSTS[hid]
    img = cache.setdefault(h["work"], Image.open(HD[h["work"]]).convert("RGB"))
    arr = np.array(img)
    mask = segment(img, h)
    if "clip" in h:                     # hand-traced outline limits the mask
        poly = np.zeros_like(mask); cv2.fillPoly(poly, [np.array(h["clip"], np.int32)], 255)
        mask = mask & cv2.dilate(poly, np.ones((5, 5), np.uint8))
    # keep the largest blob; close small gaps (occluders) into the body
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask, 8)
    if n > 1:
        big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); mask = np.where(lab == big, 255, 0).astype(np.uint8)
    k = h["close"]
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    closed = cv2.morphologyEx(closed, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # fill interior holes (e.g. where a leg crossed the body), LaMa repaints them below
    ff = closed.copy(); hh, ww = ff.shape
    cv2.floodFill(ff, np.zeros((hh + 2, ww + 2), np.uint8), (0, 0), 255)
    closed = closed | cv2.bitwise_not(ff)
    ys, xs = np.where(closed > 0)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    pad = 40
    rx0, ry0 = max(0, bx0 - pad), max(0, by0 - pad)
    rx1, ry1 = min(img.width, bx1 + pad), min(img.height, by1 + pad)
    region = arr[ry0:ry1, rx0:rx1]

    # complete the animal: repaint gap pixels (in closed but not in the SAM mask)
    gap = ((closed > 0) & (mask == 0)).astype(np.uint8)[ry0:ry1, rx0:rx1] * 255
    body = region
    if gap.sum() > 0:
        body = np.array(lama(Image.fromarray(region), Image.fromarray(cv2.dilate(gap, np.ones((5, 5), np.uint8)))))
        body = body[:region.shape[0], :region.shape[1]]

    # sprite with soft edge
    a = cv2.GaussianBlur(closed[ry0:ry1, rx0:rx1].astype(np.float32), (0, 0), 1.6)
    sprite = np.dstack([body, a.clip(0, 255).astype(np.uint8)])
    Image.fromarray(sprite).save(f"assets/hosts/{hid}.png")

    # painting with the animal removed (only needed when it walks away)
    entry = {"work": h["work"], "box": [int(rx0), int(ry0), int(rx1), int(ry1)], "size": [img.width, img.height],
             "in_place": bool(h.get("in_place"))}
    if not h.get("in_place"):
        hole = cv2.dilate(closed, np.ones((15, 15), np.uint8))[ry0:ry1, rx0:rx1]
        m2 = 80
        qx0, qy0 = max(0, rx0 - m2), max(0, ry0 - m2)
        qx1, qy1 = min(img.width, rx1 + m2), min(img.height, ry1 + m2)
        ctx = arr[qy0:qy1, qx0:qx1]
        hole_full = np.zeros(ctx.shape[:2], np.uint8)
        hole_full[ry0 - qy0:ry1 - qy0, rx0 - qx0:rx1 - qx0] = hole
        filled = np.array(lama(Image.fromarray(ctx), Image.fromarray(hole_full)))[:ctx.shape[0], :ctx.shape[1]]
        patch = filled[ry0 - qy0:ry1 - qy0, rx0 - qx0:rx1 - qx0]
        Image.fromarray(patch).save(f"assets/hosts/{hid}-patch.jpg", quality=88)
    meta[hid] = entry
    print(hid, entry["box"], "gap px:", int(gap.sum() / 255))

json.dump(meta, open(meta_path, "w"), indent=1)
