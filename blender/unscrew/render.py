"""Render a quick preview of an Unscrew model from the game's starting camera angle (Cycles on the CPU).
   python blender/unscrew/render.py blender/unscrew/owl.blend out.png [az] [size]
az turns the camera around the model in degrees (0 = the game's starting view)."""
import math
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out = args[0], args[1]
az = math.radians(float(args[2])) if len(args) > 2 else 0.0
size = int(args[3]) if len(args) > 3 else 700
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene

for o in sc.objects:
    if o.name.endswith('_proxy'):
        o.hide_render = True

# frame everything that renders
pts = [o.matrix_world @ Vector(c) for o in sc.objects if o.type == 'MESH' and not o.hide_render for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center, radius = (lo + hi) / 2, (hi - lo).length / 2
# the game's camera: azimuth 0.75 and polar 1.02 rad in three.js, turned into Blender's Z-up axes
a, pol = 0.75 + az, 1.02
d = Vector((math.sin(pol) * math.sin(a), -math.sin(pol) * math.cos(a), math.cos(pol)))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.data.lens_unit = 'FOV'
cam.data.angle = math.radians(34)
cam.location = center + d * radius / math.sin(math.radians(17)) * 1.02
cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sc.collection.objects.link(sun)
sun.data.energy = 3.2
sun.data.angle = math.radians(8)
sun.rotation_euler = Vector((-0.55, -0.7, 1)).normalized().to_track_quat('Z', 'Y').to_euler()
w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
bg = w.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.82, 0.86, 0.92, 1)
bg.inputs['Strength'].default_value = 0.9

sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 48
sc.cycles.use_denoising = True
sc.render.resolution_x = sc.render.resolution_y = size
sc.render.film_transparent = False
sc.view_settings.view_transform = 'Standard'
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', out)
