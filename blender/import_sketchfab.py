"""Turn a downloaded Sketchfab glTF (realistic, rigged, animated) into a compact .glb
for the site, in Blender, headless:

    /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/import_sketchfab.py -- \
        <scene.gltf> <out.glb> [--drop Saddle,Reins] [--tex 1024]

- keeps only the clips the site uses and renames them to its standard names
  (Idle, Idle_2, Eating, Walk, Gallop, Sit, Sleep_Start, Sleep_Loop, Sleep_End, Shake,
  Call), choosing them from the model's own clip names by pattern;
- removes props (a saddle, reins) given with --drop;
- scales textures down to --tex pixels (default 1024) and exports one binary glTF.
The licence file that comes with the download is copied next to the .glb by the caller.
"""
import re
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
drop = []
tex = 1024
if "--drop" in argv: drop = [d for d in argv[argv.index("--drop") + 1].split(",") if d]
if "--tex" in argv: tex = int(argv[argv.index("--tex") + 1])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

# ---- props off (saddle, reins …) ----
for ob in list(bpy.data.objects):
    names = [ob.name] + ([ob.data.name] if ob.type == "MESH" else []) + [m.name for m in getattr(ob.data, "materials", []) if m]
    if ob.type == "MESH" and any(d.lower() in n.lower() for d in drop for n in names):
        print("drop", ob.name)
        bpy.data.objects.remove(ob, do_unlink=True)

# ---- clips: the site's names ← patterns tried in order on the model's own clip names ----
WANT = [
    ("Idle",        [r"(^|_)idle_?0?1$", r"(^|_)idle$", r"idle.*01", r"idle"]),
    ("Idle_2",      [r"idle.*look(?!.*opp)", r"idle_?0?3", r"idle_?0?2(?!.*shake)", r"look"]),
    ("Eating",      [r"(^|_)eat", r"graz", r"drink"]),
    ("Walk",        [r"(^|_)walk$", r"(^|_)walk_?f(orward)?$", r"(^|_)walk(?!.*(back|left|right|strafe|up|down|_\d))"]),
    ("Gallop",      [r"(^|_)trot$", r"(^|_)canter$", r"(^|_)run$", r"(^|_)gallop$"]),
    ("Sit",         [r"(^|_)sit(_?loop|_?idle)?$", r"(^|_)lie(_?loop|_?idle)?$", r"(^|_)rest"]),
    ("Sleep_Start", [r"sleep.*start", r"lie.*down", r"sit.*start"]),
    ("Sleep_Loop",  [r"sleep.*loop", r"(^|_)sleep$"]),
    ("Sleep_End",   [r"sleep.*end", r"get.?up", r"stand.*up"]),
    ("Shake",       [r"head.?shake", r"shake"]),
    ("Call",        [r"neigh", r"howl", r"roar", r"call", r"bark", r"bleat", r"moo", r"bray"]),
]
acts = {a.name: a for a in bpy.data.actions}
clean = lambda n: re.sub(r"^[A-Za-z]{1,3}_", "", n.split("|")[-1]).lower().replace(" ", "_")
chosen = {}
for std, pats in WANT:
    for p in pats:
        hit = next((a for n, a in acts.items() if a not in chosen.values() and re.search(p, clean(n))), None)
        if hit: chosen[std] = hit; break
for std, a in chosen.items():
    print(f"clip {std:12s} <- {a.name}")
keep = set(chosen.values())
for a in list(bpy.data.actions):
    if a not in keep: bpy.data.actions.remove(a)
for std, a in chosen.items():
    a.name = std
    a.use_fake_user = True
# every remaining action goes into the file, assigned to the armature through NLA
for ob in bpy.data.objects:
    if ob.type == "ARMATURE":
        ad = ob.animation_data or ob.animation_data_create()
        for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
        for a in keep:
            tr = ad.nla_tracks.new(); tr.name = a.name; tr.strips.new(a.name, 0, a)
        ad.action = None

# ---- textures down to size ----
for img in bpy.data.images:
    if img.size[0] > tex or img.size[1] > tex:
        k = tex / max(img.size)
        img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))
        img.pack()

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_animations=True,
                          export_animation_mode="NLA_TRACKS", export_skins=True, export_morph=False,
                          export_image_format="AUTO", export_jpeg_quality=86, export_yup=True, use_selection=False)
print("wrote", out)
