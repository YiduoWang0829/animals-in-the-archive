"""Cut every recognisable animal out of the three paintings for the collage
("Make your new painting"). Segment Anything picks the outline from a hand-placed
box; the result is a soft-edged WebP sprite.

Usage:  python tools/segment_collage.py
Writes: assets/collage/<id>.webp and assets/collage/collage.json
Boxes are [x0, y0, x1, y1] in the HD paintings (assets/paintings/hd).
"""
import json, os
import numpy as np, cv2, torch
from PIL import Image
from transformers import SamModel, SamProcessor

HD = {"eden": "assets/paintings/hd/garden-of-eden.jpg",
      "durer": "assets/paintings/hd/knight-death-devil.jpg",
      "marc": "assets/paintings/hd/fate-of-the-animals.jpg"}
CUTS = {
    # Garden of Eden (swan, goat, pheasant, coot, moorhen and the Dürer lizard were tried
    # and dropped: SAM could not separate them cleanly from the foliage)
    "eden-macaws":   ("eden", [90, 90, 230, 270], "macaws"),
    "eden-parrot":   ("eden", [1275, 370, 1355, 530], "blue-and-yellow macaw"),
    "eden-ostrich":  ("eden", [2105, 595, 2265, 860], "ostrich"),
    "eden-ox":       ("eden", [2060, 880, 2400, 1110], "ox"),
    "eden-leopard":  ("eden", [1960, 970, 2390, 1260], "leopard"),
    "eden-tiger":    ("eden", [1700, 1100, 2100, 1320], "tiger"),
    "eden-heron":    ("eden", [1700, 1080, 1810, 1460], "heron"),
    "eden-dogs":     ("eden", [1330, 1030, 1520, 1180], "dogs"),
    "eden-turkey":   ("eden", [0, 1150, 110, 1410], "turkey"),
    "eden-fish":     ("eden", [1440, 1390, 1570, 1440], "fish"),
    "eden-cat":      ("eden", [870, 1220, 960, 1300], "cat"),
    "eden-horse2":   ("eden", [30, 580, 290, 1050], "bay horse"),
    "eden-lion":     ("eden", [1745, 895, 1945, 1105], "lion"),
    "eden-horse":    ("eden", [1300, 815, 1420, 935], "white horse"),
    "eden-deer":     ("eden", [1392, 778, 1545, 992], "stag"),
    "eden-rabbit":   ("eden", [616, 1336, 720, 1430], "white rabbit"),
    "eden-dog":      ("eden", [710, 1238, 832, 1374], "little dog"),
    "eden-peacock":  ("eden", [762, 1026, 1186, 1550], "peacock"),
    # Dürer
    "durer-dog":     ("durer", [820, 1730, 1600, 2200], "hound"),
    "durer-horse":   ("durer", [60, 190, 1800, 2380], "knight’s horse"),
    # Marc
    "marc-deer":     ("marc", [940, 690, 1460, 1720], "blue deer"),
    "marc-boar":     ("marc", [60, 1120, 820, 1720], "red boars"),
}
dev = "mps" if torch.backends.mps.is_available() else "cpu"
proc = SamProcessor.from_pretrained("facebook/sam-vit-base")
sam = SamModel.from_pretrained("facebook/sam-vit-base").to(dev).eval()
os.makedirs("assets/collage", exist_ok=True)
imgs, meta = {}, {}
for cid, (work, box, name) in CUTS.items():
    img = imgs.setdefault(work, Image.open(HD[work]).convert("RGB"))
    # the big animals were already cut carefully (and repainted) by segment_hosts.py
    if os.path.exists(f"assets/hosts/{cid}.png"):
        sp = Image.open(f"assets/hosts/{cid}.png").convert("RGBA")
    else:
        x0, y0, x1, y1 = box; m = int(max(x1 - x0, y1 - y0) * 0.15)
        cx0, cy0, cx1, cy1 = max(0, x0 - m), max(0, y0 - m), min(img.width, x1 + m), min(img.height, y1 + m)
        crop = img.crop((cx0, cy0, cx1, cy1))
        inp = proc(crop, input_boxes=[[[x0 - cx0, y0 - cy0, x1 - cx0, y1 - cy0]]], return_tensors="pt")
        inp = {k: (v.float() if v.dtype == torch.float64 else v).to(dev) for k, v in inp.items()}
        with torch.no_grad(): out = sam(**inp, multimask_output=True)
        masks = proc.image_processor.post_process_masks(out.pred_masks.cpu(), inp["original_sizes"].cpu(), inp["reshaped_input_sizes"].cpu())[0][0]
        mk = masks[int(out.iou_scores[0, 0].argmax())].numpy().astype(np.uint8) * 255
        n, lab, st, _ = cv2.connectedComponentsWithStats(mk, 8)
        if n > 2:   # keep blobs ≥ 15% of the largest (pairs like the macaws stay together)
            big = st[1:, cv2.CC_STAT_AREA].max()
            mk = np.where(np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= big * 0.15]), 255, 0).astype(np.uint8)
        a = cv2.GaussianBlur(mk.astype(np.float32), (0, 0), 1.3)
        ys, xs = np.where(mk > 0)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        rgba = np.dstack([np.array(crop), a.clip(0, 255).astype(np.uint8)])[by0:by1, bx0:bx1]
        sp = Image.fromarray(rgba)
    sp.thumbnail((900, 900))
    sp.save(f"assets/collage/{cid}.webp", "WEBP", quality=88, method=6)
    meta[cid] = {"work": work, "name": name, "w": sp.width, "h": sp.height}
    print(cid, sp.size)
json.dump(meta, open("assets/collage/collage.json", "w"), indent=1)
