"""Render a transparent 3/4-view thumbnail of an animated .glb (used for the
character studio shelf).

    blender --background --python blender/render_thumb.py -- <in.glb> <out.png>
Then trim/convert:  see README (Regenerate the assets).
"""
import bpy, sys, math, os, mathutils
args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
# pose: only the standing idle clip (every other track muted), a few frames in
idle = next((a for a in bpy.data.actions if a.name.split('|')[-1] in ('Idle', 'Idle_A')), None)
for o in sc.objects:
    if o.type == 'ARMATURE' and o.animation_data:
        for t in o.animation_data.nla_tracks: t.mute = True
        if idle: o.animation_data.action = idle
sc.frame_set(8)
bpy.context.view_layer.update()
# stand it up and face it along -Y (Blender's forward for this camera): the same rule the
# site uses, from the bones (head, hips, feet), for models authored nose-up or sideways
import re
arm = next((o for o in sc.objects if o.type == 'ARMATURE'), None)
if arm:
    bw = lambda pb: arm.matrix_world @ pb.head
    pbs = arm.pose.bones
    head = next((b for b in pbs if re.search('head', b.name, re.I) and not re.search('nub|end|correct|be_head|ponytail|ik|dyn', b.name, re.I)), None)
    back = next((b for b in pbs if re.search('pelvis|hips', b.name, re.I)), None)
    feet = [b for b in pbs if re.search('ankle|foot|toe|hoof|hand|digit|metatars|paw', b.name, re.I) and not re.search('nub|end|twist|correct|ik|dyn', b.name, re.I)]
    if head and back:
        f = (bw(head) - bw(back)).normalized()
        up = mathutils.Vector((0, 0, 1))
        if len(feet) >= 2:
            fa = sum((bw(b) for b in feet), mathutils.Vector()) / len(feet)
            up = bw(back) - fa
        up = (up - f * up.dot(f)).normalized()
        r = f.cross(up)
        cur = mathutils.Matrix((r, f, up)).transposed()          # columns: right, forward, up
        want = mathutils.Matrix(((-1, 0, 0), (0, -1, 0), (0, 0, 1)))  # facing -y (towards the camera side), z up
        R = (want @ cur.inverted()).to_4x4()
        for o in sc.objects:
            if o.parent is None: o.matrix_world = R @ o.matrix_world
        bpy.context.view_layer.update()
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 520, 400
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.48, 0.45, 1); sc.render.film_transparent = True
meshes = [o for o in sc.objects if o.type == 'MESH']
mn = mathutils.Vector((1e9,)*3); mx = mathutils.Vector((-1e9,)*3)
dg = bpy.context.evaluated_depsgraph_get()
for o in meshes:
    for c in o.evaluated_get(dg).bound_box:
        v = o.matrix_world @ mathutils.Vector(c); mn = mathutils.Vector(map(min, mn, v)); mx = mathutils.Vector(map(max, mx, v))
ctr = (mn + mx) / 2; size = max(mx - mn)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
cam.location = ctr + mathutils.Vector((size * 1.3, -size * 1.6, size * 0.5))
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
