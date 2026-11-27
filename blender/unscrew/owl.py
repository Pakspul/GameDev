"""The owl for Unscrew's realism mode: an owl on a tree stump, on a grassy mound with mushrooms and leaves.

Builds the scene from scratch, saves blender/unscrew/owl.blend and exports games/unscrew/real/owl.glb.
Headless, from the repository root:   python blender/unscrew/owl.py   (with the bpy module installed)
In Blender: open the Scripting tab, open this file and press Run (or ask Claude to run it over Blender MCP).

Once you start shaping owl.blend by hand, the .blend is the source and this script is only how it began:
export with blender/unscrew/export.py instead of running this again, or your changes are overwritten.
Rules for parts, screws and proxies: unscrew_kit.py and docs/UNSCREW-BLENDER.md.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unscrew_kit as K  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
RND = random.Random(7)
FRONT = Vector((0, -1, 0))

K.reset_scene()

# Material names are palette keys (games/unscrew/real/real.js swaps their colours per level).
M = {
    'main': K.mat('owl_main', '#b98a5e', 0.7),
    'dark': K.mat('owl_dark', '#7d5338', 0.7),
    'light': K.mat('owl_light', '#f1dfc0', 0.75),
    'face': K.mat('owl_face', '#f8ecd8', 0.75),
    'eye': K.mat('owl_eye', '#ffb21e', 0.25),
    'pupil': K.mat('pupil', '#231914', 0.2),
    'shine': K.mat('shine', '#ffffff', 0.15),
    'beak': K.mat('owl_beak', '#f0962e', 0.45),
    'bark': K.mat('bark', '#8a5a3b', 0.85),
    'barkdark': K.mat('bark_dark', '#6a432c', 0.85),
    'wood': K.mat('wood', '#e3c290', 0.7),
    'grass': K.mat('grass', '#86c97a', 0.85),
    'blade': K.mat('grass_blade', '#6cb865', 0.8),
    'cap': K.mat('mushroom', '#e8574a', 0.5),
    'stem': K.mat('mushroom_stem', '#f6ecdc', 0.7),
    'leaf1': K.mat('leaf_orange', '#ee9440', 0.7),
    'leaf2': K.mat('leaf_yellow', '#f2c64e', 0.7),
    'rock': K.mat('rock', '#b9bec7', 0.8),
    'pebble': K.mat('pebble', '#d3cbbf', 0.8),
    'ivy': K.mat('ivy', '#4fa25a', 0.6),
    'vine': K.mat('vine', '#5c7a3a', 0.8),
    'acorn': K.mat('acorn', '#cf9150', 0.55),
    'acorncap': K.mat('acorn_cap', '#7d5a3c', 0.85),
}


def place(obj, point, normal, up=K.UP):
    obj.matrix_world = Matrix.Translation(Vector(point)) @ K.frame_at(point, normal, up)
    return obj


def on_surface(obj, near, direction):
    """(point, normal) where a ray along -direction from outside hits obj."""
    d = Vector(direction).normalized()
    return K.hit(obj, Vector(near) + d * 6, -d)


def local_axes(normal, up=K.UP):
    f = K.frame_at((0, 0, 0), normal, up)
    return Vector(f.col[0][:3]), Vector(f.col[1][:3])


def cover(name, host, outline, material, at, direction, up=K.UP, thick=0.16, min_cx=0.0, screws=((0, 0),), anchor=True):
    """A plate shrink-wrapped onto host where a ray along -direction lands near at. Its screws sit at the given
    (x, y) offsets in the plate's own axes; with anchor, host gets a hidden screw under the plate's middle."""
    p, n = on_surface(host, at, direction)
    pl = K.part(K.plate(name, outline, material, p, n, target=host, thick=thick, up=up), min_cx=min_cx)
    ax, ay = local_axes(n, up)
    for sx, sy in screws:
        K.screw_on(pl, p + ax * sx + ay * sy, n)
    if anchor:
        a = K.anchor_under(pl, host, p, n)
        if a and min_cx:
            a['minCx'] = round(min_cx, 2)
    return pl, p, n


# ----- the ground: a grassy mound (static) with tufts -----
base = K.part(K.lathe('ground', [(0, 0), (3.75, 0), (3.95, 0.16), (3.8, 0.38), (3.2, 0.52), (1.6, 0.6), (0, 0.62)],
                      M['grass'], seg=48, ripple=lambda a, z: 1 + 0.025 * math.sin(5 * a) + 0.015 * math.sin(11 * a + 1)), static=True)
K.proxy(base)
for k in range(9):
    a = k / 9 * 2 * math.pi + RND.uniform(-0.2, 0.2)
    r = RND.uniform(2.3, 3.4)
    cx, cy = r * math.cos(a), r * math.sin(a)
    if cy < -1.6 and abs(cx) < 1.6:
        continue  # keep the front clear for the mushrooms
    blades = []
    for b in range(5):
        ba = RND.uniform(0, 2 * math.pi)
        lean = Vector((math.cos(ba), math.sin(ba), 0)) * RND.uniform(0.15, 0.35)
        h = RND.uniform(0.45, 0.75)
        s = Vector((cx + math.cos(ba) * 0.08, cy + math.sin(ba) * 0.08, 0.45))
        blades.append(([s, s + lean * 0.5 + Vector((0, 0, h * 0.55)), s + lean + Vector((0, 0, h))], [0.07, 0.05, 0.008]))
    K.decor(K.tubes(f'tuft{k}', blades, M['blade'], seg=6, subsurf=0), base)

# ----- the stump -----
stump = K.part(K.lathe('stump', [(1.5, 0.45), (1.32, 0.7), (1.14, 1.0), (1.06, 1.5), (1.05, 2.05), (1.08, 2.32), (0.98, 2.4)],
                       M['bark'], seg=40, ripple=lambda a, z: 1 + 0.035 * math.sin(9 * a + z * 0.8) + 0.02 * math.sin(23 * a)))
K.proxy(stump)
top = K.lathe('stump_top', [(0.95, 2.37), (0.97, 2.43), (0, 2.45)], M['wood'], seg=40, subsurf=0)
K.decor(top, stump)
for i, r in enumerate((0.3, 0.55, 0.78)):
    ring = K.lathe(f'ring{i}', [(r, 2.44), (r + 0.035, 2.465), (r + 0.07, 2.44)], M['bark'], seg=40, subsurf=0, cap=False)
    K.decor(ring, stump)
# hidden under the owl's body
for x, y in ((0, -0.25), (0, 0.3)):
    K.screw(stump, (x, y, 2.4), (0, 0, 1), force=True)
K.scatter_screws(stump, (0, 0, 1.4), n=70, spacing=0.8, keep=lambda p, n: 0.9 < p.z < 2.2 and abs(n.z) < 0.5)
# roots spreading over the mound
for k, a in enumerate((0.5, 2.3, 3.9, 5.4)):
    d = Vector((math.cos(a), math.sin(a), 0))
    pts = [d * 1.05 + Vector((0, 0, 0.95)), d * 1.6 + Vector((0, 0, 0.62)), d * 2.15 + Vector((0, 0, 0.5)), d * 2.5 + Vector((0, 0, 0.47))]
    root = K.part(K.tube(f'root{k}', pts, [0.36, 0.26, 0.17, 0.08], M['bark'], seg=12), min_cx=0.25 if k % 2 else 0)
    K.screw_on(root, d * 1.7 + Vector((0, 0, 0.9)), (0, 0, 1))
# bark plates on the stump's sides
for k, a in enumerate((-2.0, -0.4, 1.3, 2.75)):
    d = Vector((math.cos(a), math.sin(a), 0))
    cover(f'bark{k}', stump, K.disc(0.75, 1.0), M['barkdark'], d * 1.1 + Vector((0, 0, 1.55 + 0.15 * (k % 2))), d,
          thick=0.2, min_cx=0.5 + 0.15 * (k % 2), screws=((0, 0.22),))
# bracket fungi
for k, (a, z) in enumerate(((-0.95, 1.25), (2.1, 1.85))):
    d = Vector((math.cos(a), math.sin(a), 0))
    p, n = on_surface(stump, d * 1.1 + Vector((0, 0, z)), d)
    sh = K.part(K.ellipsoid(f'fungus{k}', p + d * 0.05, (0.62, 0.62, 0.26), M['wood'], seg=24, rings=10,
                            shape=lambda v: Vector((v.x, v.y, v.z * (1.0 if v.z > 0 else 0.55)))), min_cx=0.35)
    sh.rotation_euler = (0, 0, a)
    K.screw_on(sh, p + d * 0.32 + Vector((0, 0, 0.3)), (0, 0, 1))
    K.anchor_under(sh, stump, p, n)

# ivy climbing the back of the stump: a vine (decoration) and leaves, each held by a screw
for side, (a0, z0) in enumerate(((0.95, 1.12), (3.55, 1.0))):
    pts, leaves = [], []
    for i in range(5):
        a, z = a0 + 0.18 * math.sin(i * 1.7), z0 + i * 0.32
        d = Vector((math.cos(a), math.sin(a), 0))
        hp = on_surface(stump, d * 1.1 + Vector((0, 0, z)), d)
        if hp:
            pts.append(hp[0] + hp[1] * 0.03)
            if i % 2 == 0 or i == 3:
                leaves.append((hp[0], hp[1], i))
    K.decor(K.tube(f'vine{side}', pts, [0.045] * len(pts), M['vine'], seg=6), stump)
    for p, n, i in leaves:
        tilt = Vector((0, 0, 1)) + Vector((-n.y, n.x, 0)) * (0.6 if i % 2 else -0.6)
        cover(f'ivy{side}{i}', stump, K.leaf_shape(0.5, 0.62), M['ivy'], p, n, up=tilt, thick=0.16,
              min_cx=0.2 + 0.25 * i, anchor=False)

# ----- the owl -----
def egg(v):
    k = 1 + 0.12 * (-v.z)
    z = v.z if v.z > -0.72 else -0.72 - (-0.72 - v.z) * 0.45
    return Vector((v.x * k, v.y * k, z))


body = K.part(K.ellipsoid('body', (0, 0.05, 3.5), (1.42, 1.25, 1.38), M['main'], seg=36, rings=18, shape=egg, subsurf=1))
K.proxy(body)
head = K.part(K.ellipsoid('head', (0, -0.02, 5.28), (1.33, 1.14, 1.04), M['main'], seg=36, rings=18,
                          shape=lambda v: Vector((v.x * (1 + 0.06 * v.z), v.y * (0.9 if v.y < 0 else 1), v.z)), subsurf=1))
K.proxy(head)
# Screws all over the body and head. The game hides the ones under the head, wings, chest and face, and drops the
# ones it can't use; spare slots are fine.
K.scatter_screws(body, (0, 0.05, 3.6), n=90, spacing=0.72, keep=lambda p, n: p.z > 2.75)
K.scatter_screws(head, (0, 0, 5.3), n=80, spacing=0.7, keep=lambda p, n: p.z > 4.8)

# feet curling over the front of the stump (they fall with the body)
for s in (-1, 1):
    toes = []
    for t in (-0.16, 0, 0.16):
        x = s * 0.48 + t
        toes.append(([(x, -0.62, 2.52), (x + t * 0.4, -0.98, 2.47), (x + t * 0.6, -1.1, 2.3), (x + t * 0.6, -1.06, 2.15)],
                     [0.12, 0.1, 0.08, 0.04]))
    K.decor(K.tubes(f'foot{s}', toes, M['beak'], seg=10), body)

# ear tufts: three feathers fanning out of a base sunk into the head, each tuft held by one screw on its base
for s in (-1, 1):
    b = Vector((s * 0.66, -0.05, 5.92))
    strands = []
    for k, (spread, lean, ln) in enumerate(((-0.18, 0.0, 1.05), (0.12, 0.08, 1.25), (0.4, 0.14, 0.95))):
        out = Vector((s * (0.35 + spread), lean, 1)).normalized()
        strands.append(([b - out * 0.2, b + out * ln * 0.3 + Vector((0, 0, 0.05)), b + out * ln * 0.7 + Vector((s * 0.08, 0, 0)), b + out * ln + Vector((s * 0.2, 0, -0.05))],
                        [0.3, 0.19, 0.09, 0.015]))
    tuft = K.part(K.tubes(f'ear{s}', strands, M['dark'], seg=12))
    K.screw_on(tuft, b + Vector((s * 0.06, 0, 0.22)), (s * 0.1, -1, 0.25))

# feathers over the crown and the back of the head, more of them as the difficulty goes up
for k, (d, mc) in enumerate((((-0.42, 0.55, 0.72), 0.3), ((0.42, 0.55, 0.72), 0.3), ((0, 0.8, 0.6), 0.0), ((-0.62, 0.78, 0.0), 0.6),
                              ((0.62, 0.78, 0.0), 0.6), ((0, 1, 0.12), 0.9))):
    d = Vector(d).normalized()
    cover(f'crown{k}', head, K.scale_shape(0.56, -0.52, tip=0.3), M['dark'], Vector((0, -0.02, 5.28)) + d * 1.2, d,
          thick=0.16, min_cx=mc)

# facial discs with the eyes, and the beak between them
for s in (-1, 1):
    disc, p, n = cover(f'face{s}', head, K.disc(1.32, 1.3), M['face'], (s * 0.55, 0, 5.3), Vector((s * 0.35, -1, 0)),
                       thick=0.16, screws=((s * 0.47, 0.25), (s * 0.5, -0.18)))
    ax, ay = local_axes(n)
    eye_at = p + n * 0.15
    iris = place(K.ellipsoid(f'iris{s}', (0, 0, 0), (0.37, 0.37, 0.12), M['eye'], seg=20, rings=8), eye_at, n)
    pupil = place(K.ellipsoid(f'pupil{s}', (0, 0, 0), (0.2, 0.2, 0.08), M['pupil'], seg=16, rings=6), eye_at + n * 0.07, n)
    shine = place(K.ellipsoid(f'shine{s}', (0, 0, 0), (0.07, 0.07, 0.04), M['shine'], seg=12, rings=6, subsurf=0),
                  eye_at + n * 0.13 + ay * 0.09 + ax * 0.08, n)
    for o in (iris, pupil, shine):
        K.decor(o, disc)
    # a brow over each eye, from medium difficulty
    cover(f'brow{s}', disc, K.scale_shape(0.85, 0.34, tip=0.5), M['dark'], p + ay * 0.5 - ax * s * 0.05, n,
          up=K.UP, thick=0.14, min_cx=0.55, screws=((0, 0),), anchor=False)
beak = K.tube('beak', [(0, -1.04, 5.2), (0, -1.2, 5.0), (0, -1.22, 4.82), (0, -1.15, 4.72)], [0.2, 0.15, 0.08, 0.01], M['beak'], seg=12)
K.decor(beak, head)

# chest: a light patch with rows of dark feather marks on it
chest, cp, cn = cover('chest', body, K.disc(2.0, 2.15), M['light'], (0, 0, 3.35), FRONT, thick=0.16,
                      screws=((-0.8, 0.1), (0.8, 0.1), (0, 0.82)))
cax, cay = local_axes(cn)
rows = [(((-0.3, 0), (0.3, 0)), 0.4), (((-0.5, 0.3), (0, 0), (0.5, 0.3)), -0.05), (((-0.26, 0.6), (0.26, 0.6)), -0.46)]
for r, (xs, y) in enumerate(rows):
    for c, (x, mc) in enumerate(xs):
        cover(f'mark{r}{c}', chest, K.chevron(0.5, 0.34, 0.1), M['dark'], cp + cax * x + cay * y, cn,
              thick=0.16, min_cx=mc, screws=((0, 0),))

# wings, with primary feathers at the tips from higher difficulties
for s in (-1, 1):
    side = Vector((s, 0.25, -0.05))
    wing, wp, wn = cover(f'wing{s}', body, K.scale_shape(1.15, -2.3, tip=0.15), M['dark'], (s * 1.3, 0.25, 3.45), side,
                         up=Vector((0, 0.25, 1)), thick=0.2, screws=((0, 0.62), (0, 0.05), (0.21, -0.42)))
    wax, way = local_axes(wn, Vector((0, 0.25, 1)))
    for k, (x, y) in enumerate(((-0.21, -0.42), (0.21, -0.42))):
        cover(f'primary{s}{k}', wing, K.leaf_shape(0.4, 0.82), M['main'], wp + wax * x + way * y, wn,
              up=Vector((0, 0.25, 1)), thick=0.14, min_cx=0.7 + 0.2 * k, screws=((0, 0.05),), anchor=False)
    for k, (y, mc) in enumerate(((0.6, 0.4), (0.06, 0.8))):
        cover(f'covert{s}{k}', wing, K.scale_shape(0.56, -0.5, tip=0.3), M['main'], wp + way * y, wn,
              up=Vector((0, 0.25, 1)), thick=0.16, min_cx=mc, anchor=False)
    for k, (x, y) in enumerate(((-0.28, 0.32), (0.3, 0.32), (-0.3, -0.2), (0.3, -0.2))):
        dp, dn = on_surface(wing, wp + wax * x + way * y, wn)
        dot = place(K.ellipsoid(f'spot{s}{k}', (0, 0, 0), (0.11, 0.08, 0.035), M['light'], seg=12, rings=6, subsurf=0), dp, dn)
        K.decor(dot, wing, min_cx=0.3)

# tail feathers at the back, and feather scales on the back from hard on
cover('tail', body, K.scale_shape(1.0, -1.1, tip=0.3), M['dark'], (0, 1.2, 3.0), Vector((0, 1, -0.15)), thick=0.18,
      screws=((-0.22, 0.25), (0.22, 0.25)))
for k, (x, z) in enumerate(((-0.5, 4.0), (0.5, 4.0), (0, 3.45))):
    cover(f'back{k}', body, K.chevron(0.62, 0.24, 0.14), M['light'], (x, 1.2, z), Vector((x * 0.6, 1, 0.1)),
          thick=0.14, min_cx=0.9 + 0.15 * k)

# ----- on the mound: mushrooms, leaves and stones -----
for k, (x, y, s) in enumerate(((-1.9, -2.15, 1.0), (-1.25, -2.65, 0.72), (2.3, -1.6, 0.85))):
    h = 0.55 * s
    cap = K.part(K.ellipsoid(f'mushroom{k}', (x, y, 0.55 + h), (0.48 * s, 0.48 * s, 0.3 * s), M['cap'], seg=20, rings=10,
                             shape=lambda v: Vector((v.x, v.y, v.z if v.z > 0 else v.z * 0.35))), min_cx=0.2 * k)
    stem = K.lathe(f'stem{k}', [(0.2 * s, 0.4), (0.17 * s, 0.55 + h * 0.5), (0.15 * s, 0.6 + h)], M['stem'], seg=16, center=(x, y, 0))
    K.decor(stem, cap)
    for d in range(5):
        a = d / 5 * 2 * math.pi + k
        dp, dn = on_surface(cap, (x + math.cos(a) * 0.3 * s, y + math.sin(a) * 0.3 * s, 0.55 + h), (math.cos(a) * 0.9, math.sin(a) * 0.9, 1))
        K.decor(place(K.ellipsoid(f'dot{k}{d}', (0, 0, 0), (0.08 * s, 0.08 * s, 0.03), M['stem'], seg=10, rings=6, subsurf=0), dp, dn), cap)
    K.screw_on(cap, (x, y, 1.5), (0, 0, 1))
for k, (x, y, a) in enumerate(((1.4, -2.7, 0.4), (-2.9, -0.7, 1.9), (2.8, 1.3, -0.7), (-0.6, 2.9, 2.6))):
    lf, lp, ln = cover(f'leaf{k}', base, K.leaf_shape(0.62, 1.15), M['leaf1' if k % 2 else 'leaf2'], (x, y, 0.6), (0, 0, 1),
                       up=Vector((math.cos(a), math.sin(a), 0)), thick=0.13, min_cx=0.15 + 0.2 * k, screws=((0, 0),), anchor=False)
for k, (x, y, r) in enumerate(((2.75, -0.2, 0.55), (-2.35, 1.9, 0.48))):
    rock = K.part(K.ellipsoid(f'stone{k}', (x, y, 0.55), (r * 1.2, r, r * 0.75), M['rock'], seg=10, rings=6, subsurf=1,
                              shape=lambda v: v * (1 + 0.12 * math.sin(3 * v.x + 2 * v.y))))
    K.scatter_screws(rock, (x, y, 0.55), n=20, spacing=0.55, keep=lambda p, n: n.z > 0.3)

for k, (x, y, a) in enumerate(((0.9, -2.35, 0.3), (-2.75, -1.6, 1.0), (1.9, 2.4, 2.0), (-1.7, 2.9, 0.6))):
    cap = K.part(K.ellipsoid(f'acorn{k}', (x, y, 0.98), (0.3, 0.3, 0.17), M['acorncap'], seg=16, rings=8,
                             shape=lambda v: Vector((v.x, v.y, v.z if v.z > 0 else v.z * 0.4))), min_cx=0.1 + 0.25 * k)
    nut = K.ellipsoid(f'nut{k}', (x, y, 0.78), (0.24, 0.24, 0.27), M['acorn'], seg=16, rings=8,
                      shape=lambda v: Vector((v.x, v.y, v.z if v.z > 0 else v.z * 1.15)))
    stalk = K.tube(f'stalk{k}', [(x, y, 1.1), (x + 0.04, y, 1.22)], [0.05, 0.035], M['acorncap'], seg=6, subsurf=0)
    K.decor(nut, cap)
    K.decor(stalk, cap)
    K.screw_on(cap, (x + 0.12, y - 0.1, 1.1), (0.25, -0.2, 1))
for k, (x, y, r) in enumerate(((3.05, -1.25, 0.32), (-3.2, 0.6, 0.36), (0.4, 3.25, 0.3), (-0.6, -3.15, 0.3))):
    pb = K.part(K.ellipsoid(f'pebble{k}', (x, y, 0.58), (r * 1.25, r, r * 0.55), M['pebble'], seg=14, rings=8), min_cx=0.3 + 0.2 * k)
    K.screw_on(pb, (x, y, 0.7), (0, 0, 1))

bpy.context.view_layer.update()
os.makedirs(os.path.join(ROOT, 'games', 'unscrew', 'real'), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'blender', 'unscrew', 'owl.blend'), compress=True)
K.export_glb(os.path.join(ROOT, 'games', 'unscrew', 'real', 'owl.glb'))
print('owl: built', len([o for o in bpy.data.objects if o.parent is None]), 'parts')
