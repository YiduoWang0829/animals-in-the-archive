"""Bring one downloaded Sketchfab model into the site.

    python tools/import_model.py <downloaded folder> <id> [--drop Saddle,Reins]

1. Blender (blender/import_sketchfab.py): keep and rename the clips the site uses, drop
   props, reduce textures, export assets/animals/3d/real/<id>.glb
2. copy the licence file that came with the download next to it (<id>.license.txt)
3. render the studio thumbnail (blender/render_thumb.py), trim it, face it left
4. print the credit, read from the licence file, for the `real` field in js/data.js
"""
import os, re, subprocess, sys, shutil
from PIL import Image, ImageOps

BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
src, mid = sys.argv[1], sys.argv[2]
drop = sys.argv[sys.argv.index("--drop") + 1] if "--drop" in sys.argv else ""
gltf = next(os.path.join(src, f) for f in os.listdir(src) if f.endswith((".gltf", ".glb")))
out_dir = "assets/animals/3d/real"; os.makedirs(f"{out_dir}/thumbs", exist_ok=True)
glb = f"{out_dir}/{mid}.glb"

args = [BLENDER, "-b", "-P", "blender/import_sketchfab.py", "--", gltf, glb] + (["--drop", drop] if drop else [])
log = subprocess.run(args, capture_output=True, text=True).stdout
print("\n".join(l for l in log.splitlines() if l.startswith(("drop", "clip", "wrote"))))

lic = open(os.path.join(src, "license.txt")).read()
shutil.copy(os.path.join(src, "license.txt"), f"{out_dir}/{mid}.license.txt")
field = lambda k: (re.search(rf"\* {k}:\s*(.+)", lic) or [None, ""])[1].strip()
title, url = field("title"), field("source")
author = re.sub(r"\s*\(https?://.*\)$", "", field("author"))
ltype = field("license type")
licence = {"CC-BY-4.0": "CC BY 4.0", "CC-BY-NC-4.0": "CC BY-NC 4.0", "CC0": "CC0"}.get(ltype.split()[0], ltype)

tmp = f"/tmp/{mid}_thumb.png"
subprocess.run([BLENDER, "-b", "-P", "blender/render_thumb.py", "--", glb, tmp], capture_output=True)
im = Image.open(tmp).convert("RGBA"); im = im.crop(im.getbbox())
# render_thumb shows the animal facing left already (as the studio and collage expect)
pad = Image.new("RGBA", (im.width + 16, im.height + 16), (0, 0, 0, 0)); pad.paste(im, (8, 8))
pad.save(f"{out_dir}/thumbs/{mid}.webp", "WEBP", quality=88)

print(f"{glb}: {os.path.getsize(glb) / 1e6:.1f} MB, licence {licence}")
print(f"    real: {{ title: '{title}', author: '{author}', licence: '{licence}',\n            url: '{url}' }},")
