"""Estimate a depth map for each painting with Depth Anything V2 (Small).
Usage: python tools/depth_maps.py
Writes assets/paintings/depth/<name>.png (8-bit, white = near)."""
import os
import numpy as np
from PIL import Image, ImageFilter
from transformers import pipeline
import torch

dev = "mps" if torch.backends.mps.is_available() else "cpu"
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device=dev)
os.makedirs("assets/paintings/depth", exist_ok=True)
for n in ["garden-of-eden", "knight-death-devil", "fate-of-the-animals"]:
    im = Image.open(f"assets/paintings/hd/{n}.jpg").convert("RGB")
    small = im.copy(); small.thumbnail((1024, 1024))
    d = np.array(pipe(small)["predicted_depth"].squeeze().cpu(), dtype=np.float32)
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)          # relative inverse depth: 1 = near
    out = Image.fromarray((d * 255).astype(np.uint8)).resize(small.size, Image.BICUBIC)
    out = out.filter(ImageFilter.GaussianBlur(1.2)).filter(ImageFilter.GaussianBlur(3.5))   # soft steps = less tearing in 3D
    out.save(f"assets/paintings/depth/{n}.png")
    print(n, out.size)
