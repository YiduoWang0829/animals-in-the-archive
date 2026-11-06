"""Render a quick three-quarter preview of a relief .glb (for checking models).

    blender --background --python blender/preview_render.py -- <in.glb> <out.png>
"""
import sys, math
import bpy

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE"
scene.render.resolution_x, scene.render.resolution_y = 800, 500
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("w")

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
cam.location = (1.9, -3.2, 0.9)          # looking at the front (-Y) from the right
cam.rotation_euler = (math.radians(78), 0, math.radians(31))
scene.camera = cam
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
