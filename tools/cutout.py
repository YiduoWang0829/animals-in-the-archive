"""Remove backgrounds from the chosen animal photographs with rembg.

Usage: python tools/cutout.py [model] [names...]
Reads assets/animals/originals/<name>.png, writes assets/animals/cutouts/<name>.png
(trimmed to the animal's bounding box, transparent background).
"""
import sys, os
import numpy as np
from PIL import Image
from scipy.ndimage import label
from rembg import remove, new_session

model = sys.argv[1] if len(sys.argv) > 1 else "isnet-general-use"
names = sys.argv[2:] or [f[:-4] for f in sorted(os.listdir("assets/animals/originals"))]
session = new_session(model)
for n in names:
    im = Image.open(f"assets/animals/originals/{n}.png").convert("RGB")
    out = remove(im, session=session, post_process_mask=True)
    a = out.getchannel("A").point(lambda v: 0 if v < 20 else v)  # drop faint haze
    # keep only blobs that are at least 3% of the largest one (removes floating specks)
    arr = np.array(a); lab, n_lab = label(arr > 40)
    if n_lab > 1:
        sizes = np.bincount(lab.ravel()); sizes[0] = 0
        keep = sizes >= sizes.max() * 0.03
        arr[~keep[lab]] = 0
    a = Image.fromarray(arr)
    out.putalpha(a)
    bbox = a.getbbox()
    if bbox:
        pad = 6
        out = out.crop((max(0, bbox[0]-pad), max(0, bbox[1]-pad),
                        min(out.width, bbox[2]+pad), min(out.height, bbox[3]+pad)))
    out.save(f"assets/animals/cutouts/{n}.png")
    print(n, model, out.size)
