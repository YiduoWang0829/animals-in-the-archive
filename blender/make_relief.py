"""Turn a transparent PNG cut-out into a soft 3D relief and export it as .glb.

Run headless:
    blender --background --python blender/make_relief.py -- <cutout.png> <out.glb> [resolution]

How it works
  1. Read the PNG's alpha channel and resample it onto a grid (default 140 cells on
     the long side).
  2. Blur the alpha several times. The blurred value is high in the middle of the
     body and falls off towards the outline, so sqrt(blur) gives a rounded "pillow"
     height. A little of the photo's brightness is added for surface detail.
  3. Build a closed mesh: a displaced front sheet, a flatter back sheet and side
     walls along the outline (only grid cells inside the alpha mask are kept).
  4. Fill the transparent pixels' colour from their neighbours (so edges do not
     show a halo), use the photo as the base-colour texture, export GLB.
"""
import sys
import bpy
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit("usage: blender --background --python make_relief.py -- in.png out.glb [res]")
SRC, OUT = argv[0], argv[1]
RES = int(argv[2]) if len(argv) > 2 else 140

DEPTH = 0.22        # height of the front relief (model is 2 units on its long side)
BACK = 0.35         # back sheet depth as a fraction of the front
MIN_T = 0.015       # minimum half-thickness at the outline
DETAIL = 0.025      # brightness contribution to the surface
ALPHA_CUT = 0.5     # a cell is "inside" when its alpha is above this


def box_blur(a, r):
    """Separable box blur with edge padding (numpy only, no scipy in Blender)."""
    k = 2 * r + 1
    p = np.pad(a, r, mode="edge")
    c = np.cumsum(np.pad(p, ((1, 0), (0, 0))), axis=0)
    a = (c[k:, :] - c[:-k, :]) / k
    c = np.cumsum(np.pad(a, ((0, 0), (1, 0))), axis=1)
    return (c[:, k:] - c[:, :-k]) / k


def resample(img, gw, gh):
    """Nearest-neighbour + box-average resample of an HxWxC array to gh x gw."""
    h, w = img.shape[:2]
    ys = (np.arange(gh) + 0.5) * h / gh
    xs = (np.arange(gw) + 0.5) * w / gw
    return img[ys.astype(int).clip(0, h - 1)][:, xs.astype(int).clip(0, w - 1)]


# --- 1. load image ---------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
img = bpy.data.images.load(SRC)
W, H = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)   # row 0 = bottom
alpha = px[..., 3]

# --- 2. height field -------------------------------------------------------
aspect = W / H
gw, gh = (RES, max(8, round(RES / aspect))) if W >= H else (max(8, round(RES * aspect)), RES)
small = resample(px, gw, gh)
mask = small[..., 3] > ALPHA_CUT
soft = mask.astype(np.float32)
for r in (1, 2, 3, 5):               # repeated blurs approximate a distance field
    soft = box_blur(soft, max(1, round(r * RES / 140)))
# blur is ~0.5 on the outline: remap so the height reaches ~0 there
soft = np.clip((soft - 0.45) * 2.2, 0, 1) * mask
lum = small[..., :3] @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
lum = lum - box_blur(lum, 3)         # high-pass: fur, stripes, brush strokes
front = MIN_T + DEPTH * np.sqrt(soft) + DETAIL * lum * soft
back = -(MIN_T + DEPTH * BACK * np.sqrt(soft))

# --- 3. mesh ---------------------------------------------------------------
scale = 2.0 / max(gw, gh)
verts, uvs, faces = [], [], []
fid = -np.ones((gh + 1, gw + 1), dtype=np.int64)
bid = -np.ones((gh + 1, gw + 1), dtype=np.int64)

# a grid corner is used if any neighbouring cell is inside the mask
cell = mask
corner = np.zeros((gh + 1, gw + 1), bool)
corner[:-1, :-1] |= cell; corner[1:, :-1] |= cell; corner[:-1, 1:] |= cell; corner[1:, 1:] |= cell


def corner_val(f, j, i):
    """Average a cell field at grid corner (j, i) over in-mask neighbour cells."""
    vals = [f[y, x] for y in (j - 1, j) for x in (i - 1, i)
            if 0 <= y < gh and 0 <= x < gw and cell[y, x]]
    return sum(vals) / len(vals) if vals else 0.0


for j in range(gh + 1):
    for i in range(gw + 1):
        if not corner[j, i]:
            continue
        x = (i - gw / 2) * scale
        y = (j - gh / 2) * scale
        fid[j, i] = len(verts); verts.append((x, -corner_val(front, j, i), y)); uvs.append((i / gw, j / gh))
        bid[j, i] = len(verts); verts.append((x, -corner_val(back, j, i), y)); uvs.append((i / gw, j / gh))

edge_count = {}
for j in range(gh):
    for i in range(gw):
        if not cell[j, i]:
            continue
        a, b, c, d = (j, i), (j, i + 1), (j + 1, i + 1), (j + 1, i)
        faces.append([fid[p] for p in (a, b, c, d)])            # front, CCW seen from +z
        faces.append([bid[p] for p in (d, c, b, a)])            # back, reversed
        for e in ((a, b), (b, c), (c, d), (d, a)):
            key = tuple(sorted(e))
            edge_count[key] = edge_count.get(key, 0) + 1
            edge_count[(key, "dir")] = e
# side walls on outline edges (edges used by exactly one inside cell)
for key, n in list(edge_count.items()):
    if isinstance(key[1], str) or n != 1:
        continue
    p, q = edge_count[(key, "dir")]
    faces.append([fid[q], fid[p], bid[p], bid[q]])

# vertices are (x, -height, y): the relief stands upright in Blender's front view
# (-Y), which becomes a +Z-facing, Y-up model after glTF export.
mesh = bpy.data.meshes.new("relief")
mesh.from_pydata([tuple(map(float, v)) for v in verts], [], [list(map(int, f)) for f in faces])
uv_layer = mesh.uv_layers.new(name="UVMap")
for loop in mesh.loops:
    uv_layer.data[loop.index].uv = uvs[loop.vertex_index]
mesh.validate()
for poly in mesh.polygons:
    poly.use_smooth = True
obj = bpy.data.objects.new(bpy.path.display_name_from_filepath(OUT), mesh)
bpy.context.scene.collection.objects.link(obj)
# light smoothing softens the grid staircase along the outline (applied on export)
sm = obj.modifiers.new("soften", "SMOOTH")
sm.factor, sm.iterations = 0.5, 3

# --- 4. texture with bled edges ---------------------------------------------
rgb = px[..., :3].copy()
known = (alpha > 0.1).astype(np.float32)
filled = rgb * known[..., None]
wsum = known.copy()
for r in (2, 4, 8, 16, 32):          # spread colour outward into transparent pixels
    num = np.stack([box_blur(filled[..., c], r) for c in range(3)], -1)
    den = box_blur(wsum, r)[..., None]
    est = num / np.maximum(den, 1e-6)
    hole = (wsum[..., None] < 0.5) & (den > 1e-3)
    filled = np.where(hole, est, filled)
    wsum = np.maximum(wsum, (den[..., 0] > 1e-3).astype(np.float32))
tex = bpy.data.images.new("relief_tex", W, H, alpha=False)
tex.pixels[:] = np.concatenate([filled, np.ones((H, W, 1), np.float32)], -1).ravel()
tex.file_format = "JPEG"
tex.pack()

mat = bpy.data.materials.new("relief_mat")
if mat.node_tree is None:          # Blender < 5 creates materials without nodes
    mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes.get("Principled BSDF")
bsdf.inputs["Roughness"].default_value = 0.85
tnode = nt.nodes.new("ShaderNodeTexImage")
tnode.image = tex
nt.links.new(tnode.outputs["Color"], bsdf.inputs["Base Color"])
obj.data.materials.append(mat)

# --- 5. export -------------------------------------------------------------
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
                          export_image_format="JPEG", export_yup=True, export_apply=True)
print(f"[make_relief] {SRC} -> {OUT}: {len(verts)} verts, {len(faces)} faces, grid {gw}x{gh}")
