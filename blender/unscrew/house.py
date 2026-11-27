"""The medieval house for Unscrew's realism mode: a timber-framed house of three storeys and an attic, furnished
room by room, in a garden with a tree, a well, a vegetable bed and a fence. Everything comes apart, down to the
pillows and the cabbages: the big puzzle of realism mode, with hundreds of screws.

Builds the scene from scratch, saves blender/unscrew/house.blend and exports games/unscrew/real/house.glb.
Headless, from the repository root:   .blender-venv/bin/python blender/unscrew/house.py   (docs/UNSCREW-BLENDER.md)
In Blender: open the Scripting tab, open this file and press Run.

Once you shape house.blend by hand, the .blend is the source: export it with blender/unscrew/export.py instead of
running this again, or your changes are overwritten. Rules for parts, screws and proxies: unscrew_kit.py.

How it comes apart: the roof tiles hide the screws of the roof boards, which cover the attic. Every floor's
furniture stands on the floor boards and hides their screws, and the floor above blocks the furniture's screws,
so the house empties from the top down. On the outside, the timber posts, windows and doors hide the screws of
the walls. The garden can go at any time, except where the tree's crown or the house is in the way.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unscrew_kit as K  # noqa: E402
from unscrew_kit import Shape  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
RND = random.Random(1347)
UP = Vector((0, 0, 1))


def V(x, y, z):
    return Vector((x, y, z))


K.reset_scene()

# Material names are palette keys (games/unscrew/real/real.js recolours them per level).
M = {k: K.mat(k, *v) for k, v in {
    'grass': ('#8cc66f', 0.9), 'stone': ('#c8c0b0', 0.85), 'stone_dark': ('#a79d8c', 0.85), 'flagstone': ('#b9ad9a', 0.8),
    'plaster': ('#f2e9d6', 0.85), 'timber': ('#5e3d27', 0.7), 'roof': ('#bd5a3f', 0.65), 'roof_dark': ('#8f3f2c', 0.65),
    'brick': ('#a95c45', 0.8), 'frame': ('#efe6d3', 0.5), 'glass': ('#8fc0d6', 0.08, 0.1), 'shutter': ('#3f7d5c', 0.55),
    'door': ('#7b4b2a', 0.65), 'iron': ('#3c3f45', 0.45, 0.6), 'floor': ('#c39466', 0.7), 'wood': ('#a8744a', 0.6),
    'wood_light': ('#d4a978', 0.6), 'wood_dark': ('#6f4529', 0.65), 'cloth_red': ('#c04a3f', 0.85), 'cloth_blue': ('#4a72aa', 0.85),
    'cloth_green': ('#5f9150', 0.85), 'linen': ('#f6efe2', 0.9), 'wool': ('#dcc9a4', 0.95), 'straw': ('#e6c766', 0.9),
    'copper': ('#c47c46', 0.35, 0.6), 'pottery': ('#c97a4c', 0.7), 'fire': ('#ffa63a', 0.5, 0.0, 3.0),
    'candle': ('#f7efd9', 0.6), 'flame': ('#ffd35a', 0.5, 0.0, 4.0), 'water': ('#6fb3da', 0.1), 'soil': ('#6e4b33', 0.95),
    'bark': ('#7a5236', 0.9), 'leaves': ('#5aa54d', 0.8), 'leaves_light': ('#7fc35c', 0.8), 'apple': ('#d8402f', 0.35),
    'cabbage': ('#94c96a', 0.7), 'pumpkin': ('#e98b2e', 0.55), 'flower_a': ('#ef7fa8', 0.6), 'flower_b': ('#f5cd3d', 0.6),
    'flower_c': ('#a98be0', 0.6), 'hen': ('#f4eee4', 0.85), 'comb': ('#d9382e', 0.6), 'beak': ('#f0a22e', 0.5),
    'book_a': ('#8c3b3b', 0.7), 'book_b': ('#2f5d7c', 0.7), 'book_c': ('#4e7a3c', 0.7), 'paper': ('#f4ecd8', 0.9),
    'food': ('#d69a4e', 0.7), 'soup': ('#c4892f', 0.3), 'rope': ('#c9ad7c', 0.9), 'rock': ('#b7bcc4', 0.85),
}.items()}

# ----- the plan -----
GZ = 0.3                         # top of the garden
F = [0.62, 2.16, 3.70, 5.24]     # floor tops: ground floor, first, second, attic
ST = 0.14                        # floor thickness
WT = 0.14                        # wall thickness
HX = 2.4                         # outer faces of the side walls at x = -HX and HX
YB = 2.4                         # outer face of the back wall
YF = [-1.2, -1.45, -1.7, -1.7]   # outer face of the front wall, per storey: each one juts out over the one below
XP = -0.25                       # the partition between the left and the right room
PITCH = math.radians(48)
TAN = math.tan(PITCH)
ZK = F[3] + 0.3                  # underside of the roof boards at the front and back walls (over a knee wall)
YR = (YF[3] + YB) / 2            # the ridge
ZR = ZK + (YR - YF[3]) * TAN
LR = (YR - YF[3]) / math.cos(PITCH)  # length of a roof slope from the wall line to the ridge
INNER_Y = [y + WT for y in YF]
HOLE = {1: (1.45, 2.25), 2: (-0.17, 0.63), 3: (1.45, 2.25)}  # the stairwell in floors 1 to 3: x range, y from 1.6 to the back wall
STAIRS = {0: (0.95, 1), 1: (1.1, -1), 2: (0.95, 1)}        # each floor's stairs: x of the bottom step, direction

NAMES = {}


def uname(base):
    NAMES[base] = NAMES.get(base, 0) + 1
    return base if NAMES[base] == 1 else f'{base}{NAMES[base]}'


def part(name, mat, shape, min_cx=0.0, static=False):
    o = shape.finish(uname(name), M[mat])
    return K.part(o, static=static, min_cx=min_cx)


def deco(host, mat, shape, min_cx=0.0):
    o = shape.finish(uname(f'{host.name}-{mat}'), M[mat])
    return K.decor(o, host, min_cx)


def scr(obj, p, n=UP, force=False, min_cx=0.0):
    e = K.screw(obj, Vector(p), Vector(n).normalized(), force)
    if min_cx:
        e['minCx'] = round(min_cx, 2)
    return e


def scr_on(obj, near, n, force=False, min_cx=0.0):
    """A screw where a ray along -n from just outside near meets obj (for round shapes)."""
    e = K.screw_on(obj, Vector(near), Vector(n), force)
    if e is None:
        print('! no surface for a screw on', obj.name, 'near', tuple(round(c, 2) for c in near))
    elif min_cx:
        e['minCx'] = round(min_cx, 2)
    return e


def anchor(host, p, n=UP, min_cx=0.0):
    return scr(host, p, n, True, min_cx)


def frame(origin, ex, ey, ez):
    m = Matrix((ex, ey, ez)).transposed().to_4x4()
    m.translation = Vector(origin)
    return m


# ===================================================================== the garden =====================================================================
def plot():
    sh = Shape()
    # a slab with rounded corners: a rounded rectangle pushed up
    pts, r = [], 0.6
    for cx, cy, a0 in ((4.4, -3.8, -90), (4.4, 3.8, 0), (-4.4, 3.8, 90), (-4.4, -3.8, 180)):
        for i in range(7):
            a = math.radians(a0 + i * 15)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a), 0))
    sh.prism(pts, (0, 0, GZ), bev=0.06)
    base = part('ground', 'grass', sh, static=True)
    # grass tufts, a dirt patch by the well and a path of flagstones to the gate
    tufts = Shape()
    for _ in range(34):
        x, y = RND.uniform(-4.7, 4.7), RND.uniform(-4.1, 4.1)
        if -2.7 < x < 2.7 and -1.5 < y < 2.7:
            continue
        for b in range(4):
            a = RND.uniform(0, 2 * math.pi)
            lean = Vector((math.cos(a), math.sin(a), 0)) * RND.uniform(0.05, 0.12)
            h = RND.uniform(0.14, 0.24)
            s = V(x + math.cos(a) * 0.04, y + math.sin(a) * 0.04, GZ - 0.01)
            tufts.tube([s, s + lean * 0.5 + V(0, 0, h * 0.6), s + lean + V(0, 0, h)], [0.03, 0.022, 0.004], seg=5)
    deco(base, 'leaves_light', tufts)
    return base


def fence_segment(x0, y0, x1, y1, out, name='fence'):
    """A picket fence from (x0, y0) to (x1, y1) with a post at each end; out is the side away from the garden."""
    d = Vector((x1 - x0, y1 - y0, 0))
    L = d.length
    u = d.normalized()
    o = Vector(out).normalized()
    fr = frame(V(x0, y0, GZ), u, o, UP)
    sh = Shape()
    for a in (0.0, L):
        sh.box((a - 0.07, -0.07, -0.012), (a + 0.07, 0.07, 0.78), 0.02, fr)
        sh.blob(fr @ V(a, 0, 0.8), (0.08, 0.08, 0.06), seg=10, rings=5)
    for z in (0.18, 0.52):
        sh.box((0.05, 0.075, z), (L - 0.05, 0.135, z + 0.11), 0.01, fr)
    n = max(2, int((L - 0.2) / 0.19))
    for i in range(n):
        a = 0.17 + i * (L - 0.34) / (n - 1)
        sh.box((a - 0.04, 0.125, 0.04), (a + 0.04, 0.17, 0.6), 0.008, fr)
        sh.prism([fr @ V(a - 0.04, 0.125, 0.599), fr @ V(a + 0.04, 0.125, 0.599), fr @ V(a, 0.125, 0.68)], fr.to_3x3() @ V(0, 0.045, 0))
    p = part(name, 'wood_light', sh)
    for a in ((L * 0.28, L * 0.72) if L > 1.6 else (L * 0.5,)):
        scr(p, fr @ V(a, 0.17, 0.58), o)
    return p


def fence():
    E, Wd, Bk, Fr = 4.82, -4.82, 4.22, -4.22
    for x0, x1 in ((-4.82, -2.4), (-2.4, 0.35), (1.35, 3.1), (3.1, 4.82)):
        fence_segment(x0, Fr, x1, Fr, (0, -1, 0))
    for x0, x1 in ((-4.82, -1.6), (-1.6, 1.6), (1.6, 4.82)):
        fence_segment(x0, Bk, x1, Bk, (0, 1, 0))
    for y0, y1 in ((-4.22, -1.4), (-1.4, 1.4), (1.4, 4.22)):
        fence_segment(Wd, y0, Wd, y1, (-1, 0, 0))
        fence_segment(E, y0, E, y1, (1, 0, 0))
    # the gate, a little open
    fr = frame(V(0.37, Fr, GZ), V(math.cos(-0.35), math.sin(-0.35), 0), V(-math.sin(-0.35), math.cos(-0.35), 0) * -1, UP)
    sh = Shape()
    for z in (0.16, 0.5):
        sh.box((0.04, -0.03, z), (0.92, 0.03, z + 0.12), 0.01, fr)
    for i in range(6):
        a = 0.1 + i * 0.152
        sh.box((a - 0.045, -0.075, 0.08), (a + 0.045, -0.025, 0.66), 0.008, fr)
    sh.box((0.08, -0.02, 0.27), (0.86, 0.03, 0.35), 0.01, Matrix.Translation(fr @ V(0.47, 0, 0.31)) @ fr.to_3x3().to_4x4()
           @ Matrix.Rotation(0.42, 4, 'Y') @ Matrix.Translation(V(-0.47, 0, -0.31)))
    gate = part('gate', 'wood_light', sh)
    scr(gate, fr @ V(0.3, 0.03, 0.56), fr.to_3x3() @ V(0, 1, 0))
    scr(gate, fr @ V(0.7, 0.03, 0.22), fr.to_3x3() @ V(0, 1, 0))


def flagstones():
    for k, (x, y, r) in enumerate(((0.8, -3.85, 0.3), (0.95, -3.25, 0.27), (0.75, -2.65, 0.29))):
        sh = Shape().blob(V(x, y, GZ + 0.02), (r, r * 0.85, 0.07), seg=12, rings=5,
                          shape=lambda v: Vector((v.x, v.y, v.z if v.z > 0 else v.z * 0.4)) * (1 + 0.08 * math.sin(4 * v.x + 3 * v.y)))
        st = part('flagstone', 'flagstone', sh)
        scr(st, V(x, y, GZ + 0.09))


def well():
    cx, cy = 3.45, -2.55
    ring = Shape().cyl(V(cx, cy, GZ + 0.27), 0.52, 0.58, seg=28)
    w = part('well', 'stone', ring)
    water = Shape().cyl(V(cx, cy, GZ + 0.56), 0.36, 0.02, seg=24)
    deco(w, 'water', water)
    stones = Shape()
    for row in range(3):
        for i in range(11):
            a = (i + 0.5 * (row % 2)) / 11 * 2 * math.pi
            c = V(cx + math.cos(a) * 0.52, cy + math.sin(a) * 0.52, GZ + 0.1 + row * 0.17)
            stones.box((-0.13, -0.03, -0.065), (0.13, 0.03, 0.065), 0.02,
                       frame(c, V(-math.sin(a), math.cos(a), 0), V(math.cos(a), math.sin(a), 0), UP))
    deco(w, 'stone_dark', stones)
    for a in (0.4, 2.3, 4.3):
        scr(w, V(cx + math.cos(a) * 0.4, cy + math.sin(a) * 0.4, GZ + 0.56))
    # the frame: two posts, a crossbar with a crank
    fr = Shape()
    for s in (-1, 1):
        fr.box((cx + s * 0.62 - 0.07, cy - 0.07, GZ - 0.012), (cx + s * 0.62 + 0.07, cy + 0.07, GZ + 1.62), 0.02)
    fr.cyl(V(cx, cy, GZ + 1.45), 0.07, 1.36, axis=(1, 0, 0), seg=12)
    post = part('well_frame', 'wood', fr)
    crank = Shape().box((cx + 0.69, cy - 0.02, GZ + 1.3), (cx + 0.73, cy + 0.02, GZ + 1.47), 0.005) \
        .box((cx + 0.69, cy - 0.02, GZ + 1.28), (cx + 0.86, cy + 0.02, GZ + 1.32), 0.005)
    deco(post, 'iron', crank)
    for s in (-1, 1):
        scr(post, V(cx + s * 0.69, cy, GZ + 1.0), V(s, 0, 0))
    # its little roof
    rf = Shape()
    for s in (-1, 1):
        rf.box((-0.85, -0.06, 0), (0.85, 0.48, 0.06), 0.015,
               frame(V(cx, cy, GZ + 1.98), V(1, 0, 0), V(0, s * math.cos(0.6), -math.sin(0.6)), V(0, s * math.sin(0.6), math.cos(0.6))))
    roof = part('well_roof', 'roof_dark', rf)
    for s, xs in ((-1, (-0.5, 0.5)), (1, (0.0,))):
        for x in xs:
            scr(roof, V(cx + x, cy + s * 0.17, GZ + 1.98 - 0.06 + 0.06 / math.cos(0.6)), V(0, s * math.sin(0.6), math.cos(0.6)))
    # a bucket on a rope
    bk = Shape().lathe([(0.13, -0.18), (0.155, 0.0)], center=V(cx, cy, GZ + 1.05), seg=14)
    bucket = part('well_bucket', 'wood_light', bk)
    rope = Shape().cyl(V(cx, cy, GZ + 1.22), 0.012, 0.42, seg=6)
    deco(bucket, 'rope', rope)
    hoops = Shape().cyl(V(cx, cy, GZ + 0.92), 0.148, 0.025, seg=14).cyl(V(cx, cy, GZ + 1.02), 0.155, 0.025, seg=14)
    deco(bucket, 'iron', hoops)
    scr(bucket, V(cx + 0.05, cy - 0.03, GZ + 1.05))


def vegetable_bed():
    x0, x1, y0, y1 = -4.25, -1.95, -3.85, -2.45
    sh = Shape()
    sh.box((x0, y0, GZ - 0.012), (x1, y0 + 0.09, GZ + 0.34), 0.015).box((x0, y1 - 0.09, GZ - 0.012), (x1, y1, GZ + 0.34), 0.015)
    sh.box((x0, y0 + 0.08, GZ - 0.012), (x0 + 0.09, y1 - 0.08, GZ + 0.34), 0.015).box((x1 - 0.09, y0 + 0.08, GZ - 0.012), (x1, y1 - 0.08, GZ + 0.34), 0.015)
    bed = part('vegetable_bed', 'wood', sh)
    deco(bed, 'soil', Shape().box((x0 + 0.06, y0 + 0.06, GZ), (x1 - 0.06, y1 - 0.06, GZ + 0.25), 0.03))
    for x in (x0 + 0.5, (x0 + x1) / 2, x1 - 0.5):
        scr(bed, V(x, y0, GZ + 0.18), (0, -1, 0))
    for x in (x0 + 0.8, x1 - 0.8):
        scr(bed, V(x, y1, GZ + 0.18), (0, 1, 0))
    tops = Shape()
    for i in range(9):
        x = x0 + 0.3 + i * 0.22
        for k in range(3):
            a = k * 2.1 + i
            tops.tube([V(x, y1 - 0.35, GZ + 0.25), V(x + 0.05 * math.cos(a), y1 - 0.35 + 0.05 * math.sin(a), GZ + 0.45)], [0.025, 0.006], seg=4)
    deco(bed, 'cabbage', tops, min_cx=0.4)
    for k, x in enumerate((x0 + 0.45, x0 + 1.15, x0 + 1.85)):
        y = y0 + 0.4
        c = Shape().blob(V(x, y, GZ + 0.42), (0.23, 0.23, 0.18), seg=14, rings=8,
                         shape=lambda v: v * (1 + 0.06 * math.sin(7 * math.atan2(v.y, v.x))))
        cab = part('cabbage', 'cabbage', c, min_cx=0.3 * (k % 2))
        leaf = Shape()
        for j in range(5):
            a = j / 5 * 2 * math.pi + k
            leaf.blob(V(x + 0.2 * math.cos(a), y + 0.2 * math.sin(a), GZ + 0.33), (0.13, 0.13, 0.035), seg=10, rings=5)
        deco(cab, 'leaves', leaf)
        scr(cab, V(x, y, GZ + 0.6))
    for k, x in enumerate((x0 + 0.5, x1 - 0.55)):
        y = y1 - 0.36
        pk = Shape().blob(V(x, y, GZ + 0.4), (0.24, 0.24, 0.17), seg=16, rings=8,
                          shape=lambda v: v * (1 + 0.07 * abs(math.cos(4 * math.atan2(v.y, v.x)))))
        p = part('pumpkin', 'pumpkin', pk, min_cx=0.2 + 0.4 * k)
        deco(p, 'cabbage', Shape().cyl(V(x, y, GZ + 0.6), 0.03, 0.1, seg=6))
        scr(p, V(x + 0.07, y - 0.06, GZ + 0.56))


def tree():
    cx, cy = 3.95, 3.2
    tr = Shape().lathe([(0.42, GZ - 0.012), (0.34, GZ + 0.25), (0.28, GZ + 1.2), (0.24, GZ + 2.4), (0.2, GZ + 3.1), (0.0, GZ + 3.2)],
                       center=V(cx, cy, 0), seg=14)
    tr.tube([V(cx, cy, GZ + 2.2), V(cx + 0.6, cy - 0.1, GZ + 2.45), V(cx + 1.15, cy - 0.15, GZ + 2.55)], [0.14, 0.1, 0.06], seg=8)
    tr.tube([V(cx, cy, GZ + 2.6), V(cx - 0.5, cy + 0.3, GZ + 3.0), V(cx - 0.8, cy + 0.4, GZ + 3.3)], [0.12, 0.09, 0.05], seg=8)
    trunk = part('trunk', 'bark', tr)
    roots = Shape()
    for a in (0.3, 1.9, 3.4, 5.0):
        d = V(math.cos(a), math.sin(a), 0)
        roots.tube([V(cx, cy, GZ + 0.2) + d * 0.25, V(cx, cy, GZ + 0.05) + d * 0.6, V(cx, cy, GZ) + d * 0.8], [0.13, 0.07, 0.02], seg=7)
    deco(trunk, 'bark', roots)
    for a in (-0.8, 0.8, 2.4, 3.9):
        d = V(math.cos(a), math.sin(a), 0)
        scr(trunk, V(cx, cy, GZ + 0.85) + d * 0.3, d)
    for a in (0.0, 1.6, 3.2, 4.7):
        d = V(math.cos(a), math.sin(a), 0)
        scr(trunk, V(cx, cy, GZ + 1.75) + d * 0.255, d)
    anchor(trunk, V(cx, cy, GZ + 3.2))
    # the crown: overlapping clumps of leaves, each one a part, with apples on them
    clumps = [((cx, cy, GZ + 4.15), (1.15, 1.15, 1.05), 0), ((cx - 0.95, cy + 0.35, GZ + 3.6), (0.75, 0.75, 0.7), 0),
              ((cx + 0.75, cy - 0.45, GZ + 3.55), (0.75, 0.7, 0.65), 0), ((cx - 0.15, cy - 0.85, GZ + 3.75), (0.7, 0.65, 0.6), 0.3),
              ((cx + 0.15, cy + 0.55, GZ + 4.9), (0.72, 0.68, 0.58), 0.55)]
    away = lambda p, n: n.x > -0.35 and n.y > -0.35  # the house is towards -x and -y: screws there would wait for it
    crown = []
    for k, (c, r, mc) in enumerate(clumps):
        c = Vector(c)
        sh = Shape().blob(c, r, seg=18, rings=10, shape=lambda v, k=k: v * (1 + 0.07 * math.sin(5 * v.x + 3 * v.y + k) + 0.05 * math.sin(7 * v.z + 2 * k)))
        p = part('crown', 'leaves' if k % 2 == 0 else 'leaves_light', sh, min_cx=mc)
        crown.append(p)
        n = 26 if k == 0 else 12
        K.scatter_screws(p, c, n=n, spacing=0.62, min_nz=-0.1, keep=away)
    apples = [(0, (0.6, -0.3, 0.3)), (0, (0.2, 1, 0.2)), (0, (1, 0.4, 0.05)), (1, (-0.3, 1, 0.0)), (2, (1, -0.2, 0.15)),
              (3, (0.6, -0.4, 0.2)), (2, (0.8, 0.5, 0.4)), (0, (-0.2, 0.6, 0.9)), (4, (0.6, 0.6, 0.5))]
    for k, (ci, d) in enumerate(apples):
        host = crown[ci]
        hit = K.hit(host, Vector(clumps[ci][0]) + Vector(d).normalized() * 5, -Vector(d).normalized())
        if not hit:
            continue
        p, n = hit
        a = part('apple', 'apple', Shape().blob(p + n * 0.06, (0.16, 0.16, 0.15), seg=12, rings=7), min_cx=0.15 * k)
        deco(a, 'bark', Shape().cyl(p + n * 0.06 + V(0, 0, 0.17), 0.015, 0.08, seg=5))
        scr(a, p + n * 0.22, n)
    # a swing on the long branch
    sx, sy = cx + 1.0, cy - 0.14
    sw = Shape().box((sx - 0.32, sy - 0.15, GZ + 0.62), (sx + 0.32, sy + 0.15, GZ + 0.7), 0.015)
    for x in (-0.26, 0.26):
        sw.cyl(V(sx + x, sy, GZ + 1.6), 0.018, 1.86, seg=6)
    swing = part('swing', 'wood_light', sw, min_cx=0.2)
    scr(swing, V(sx, sy, GZ + 0.7))


def bench(x, y, rot=0.0, name='bench'):
    fr = frame(V(x, y, GZ), V(math.cos(rot), math.sin(rot), 0), V(-math.sin(rot), math.cos(rot), 0), UP)
    sh = Shape()
    sh.box((-0.55, -0.16, 0.26), (0.55, 0.16, 0.32), 0.015, fr)
    for a in (-0.45, 0.45):
        sh.box((a - 0.05, -0.13, -0.012), (a + 0.05, 0.13, 0.27), 0.012, fr)
        sh.box((a - 0.04, 0.12, 0.3), (a + 0.04, 0.17, 0.72), 0.01, fr)
    sh.box((-0.55, 0.13, 0.5), (0.55, 0.18, 0.66), 0.012, fr)
    b = part(name, 'wood', sh)
    for a in (-0.3, 0.3):
        scr(b, fr @ V(a, -0.04, 0.32))
    return b


def barrel(x, y, z, r=0.26, h=0.5, name='barrel', host=None, mat='wood', min_cx=0.0):
    sh = Shape().lathe([(r * 0.84, z - 0.012), (r, z + h * 0.5), (r * 0.84, z + h)], center=V(x, y, 0), seg=18)
    b = part(name, mat, sh, min_cx=min_cx)
    deco(b, 'iron', Shape().cyl(V(x, y, z + h * 0.2), r * 0.94, 0.035, seg=18).cyl(V(x, y, z + h * 0.8), r * 0.94, 0.035, seg=18))
    deco(b, 'wood_dark', Shape().cyl(V(x, y, z + h - 0.005), r * 0.76, 0.02, seg=18))
    scr(b, V(x, y, z + h))
    if host is not None:
        anchor(host, V(x, y, z))
    return b


def coop():
    x0, x1, y0, y1 = -4.4, -3.3, 2.75, 3.75
    sh = Shape().box((x0, y0, GZ + 0.3), (x1, y1, GZ + 0.95), 0.02)
    for x, y in ((x0 + 0.1, y0 + 0.1), (x1 - 0.1, y0 + 0.1), (x0 + 0.1, y1 - 0.1), (x1 - 0.1, y1 - 0.1)):
        sh.box((x - 0.06, y - 0.06, GZ - 0.012), (x + 0.06, y + 0.06, GZ + 0.32), 0.015)
    body = part('coop', 'wood_dark', sh)
    d = Shape().box(((x0 + x1) / 2 - 0.15, y0 - 0.02, GZ + 0.34), ((x0 + x1) / 2 + 0.15, y0 + 0.01, GZ + 0.68), 0.01)
    deco(body, 'iron', d)
    ramp = Shape().box((-0.17, 0, -0.025), (0.17, 0.55, 0.025), 0.01,
                       frame(V((x0 + x1) / 2, y0, GZ + 0.33), V(1, 0, 0), V(0, -math.cos(0.55), -math.sin(0.55)), V(0, -math.sin(0.55), math.cos(0.55))))
    deco(body, 'wood_light', ramp)
    for y in (y0 + 0.25, y1 - 0.25):
        scr(body, V(x0, y, GZ + 0.62), (-1, 0, 0))
    roof = Shape()
    for s in (-1, 1):
        roof.box((x0 - 0.12, -0.04, 0), (x1 + 0.12, 0.68, 0.08), 0.015,
                 frame(V(0, (y0 + y1) / 2, GZ + 1.25), V(1, 0, 0), V(0, s * math.cos(0.55), -math.sin(0.55)), V(0, s * math.sin(0.55), math.cos(0.55))))
    r = part('coop_roof', 'roof_dark', roof)
    for s in (-1, 1):
        for x in (x0 + 0.25, x1 - 0.25):
            scr(r, V(x, (y0 + y1) / 2 + s * 0.3, GZ + 1.25 - 0.3 * TAN * 0 - math.tan(0.55) * 0.3 + 0.08 / math.cos(0.55)),
                (0, s * math.sin(0.55), math.cos(0.55)))
    anchor(body, V(x0 + 0.35, (y0 + y1) / 2 - 0.1, GZ + 0.95))


def hen(x, y, a, min_cx=0.0):
    d = V(math.cos(a), math.sin(a), 0)
    sh = Shape().blob(V(x, y, GZ + 0.25), (0.22, 0.16, 0.17), seg=14, rings=8)
    sh.blob(V(x, y, GZ + 0.25) + d * 0.17 + V(0, 0, 0.14), (0.09, 0.09, 0.1), seg=10, rings=6)
    sh.blob(V(x, y, GZ + 0.25) - d * 0.17 + V(0, 0, 0.1), (0.08, 0.06, 0.12), seg=8, rings=5)
    h = part('hen', 'hen', sh, min_cx=min_cx)
    deco(h, 'comb', Shape().blob(V(x, y, GZ + 0.25) + d * 0.17 + V(0, 0, 0.25), (0.035, 0.05, 0.04), seg=8, rings=4))
    deco(h, 'beak', Shape().cyl(V(x, y, GZ + 0.25) + d * 0.28 + V(0, 0, 0.13), 0.03, 0.07, axis=d, r2=0.0, seg=6))
    deco(h, 'iron', Shape().blob(V(x, y, GZ + 0.25) + d * 0.22 + V(0, 0, 0.17) + d.cross(UP) * 0.06, (0.018, 0.018, 0.018), seg=6, rings=4)
         .blob(V(x, y, GZ + 0.25) + d * 0.22 + V(0, 0, 0.17) - d.cross(UP) * 0.06, (0.018, 0.018, 0.018), seg=6, rings=4))
    deco(h, 'beak', Shape().cyl(V(x, y, GZ + 0.05) + d.cross(UP) * 0.06, 0.02, 0.12, seg=5).cyl(V(x, y, GZ + 0.05) - d.cross(UP) * 0.06, 0.02, 0.12, seg=5))
    scr(h, V(x, y, GZ + 0.42) - d * 0.03)


def woodpile():
    x0, y0, y1 = 2.95, 0.1, 1.7
    sh = Shape()
    ends = Shape()
    for row, n in enumerate((4, 3, 2)):
        for i in range(n):
            x = x0 + 0.12 + (i + row * 0.5) * 0.22
            z = GZ + 0.1 + row * 0.19
            sh.cyl(V(x, (y0 + y1) / 2, z), 0.105, y1 - y0 - 0.02 * i, axis=(0, 1, 0), seg=10)
            for s in (-1, 1):
                ends.cyl(V(x, (y0 + y1) / 2 + s * ((y1 - y0 - 0.02 * i) / 2 + 0.002), z), 0.085, 0.01, axis=(0, 1, 0), seg=10)
    p = part('woodpile', 'wood_dark', sh)
    deco(p, 'wood_light', ends)
    for y in (y0 + 0.4, y1 - 0.4):
        scr(p, V(x0 + 0.34, y, GZ + 0.1 + 2 * 0.19 + 0.105))
    blk = Shape().cyl(V(3.75, -0.7, GZ + 0.2), 0.26, 0.42, seg=16)
    b = part('chopping_block', 'wood', blk)
    deco(b, 'wood_light', Shape().cyl(V(3.75, -0.7, GZ + 0.41), 0.22, 0.01, seg=16))
    axe = Shape().box((3.74, -0.78, GZ + 0.38), (3.76, -0.62, GZ + 0.47), 0.003)
    deco(b, 'iron', axe)
    deco(b, 'wood_light', Shape().cyl(V(3.75, -0.5, GZ + 0.62), 0.025, 0.5, axis=(0, 0.3, 1), seg=6))
    scr(b, V(3.75, -0.86, GZ + 0.41))


def wheelbarrow():
    x, y = -3.65, 0.55
    fr = frame(V(x, y, GZ), V(0, 1, 0), V(-1, 0, 0), UP)
    sh = Shape()
    sh.prism([fr @ V(-0.45, -0.3, 0.28), fr @ V(0.35, -0.3, 0.28), fr @ V(0.45, -0.3, 0.62), fr @ V(-0.5, -0.3, 0.62)], fr.to_3x3() @ V(0, 0.6, 0))
    sh.box((-1.05, -0.24, 0.42), (0.4, -0.18, 0.48), 0.01, fr).box((-1.05, 0.18, 0.42), (0.4, 0.24, 0.48), 0.01, fr)
    sh.box((-0.4, -0.2, -0.012), (-0.34, -0.14, 0.3), 0.01, fr).box((-0.4, 0.14, -0.012), (-0.34, 0.2, 0.3), 0.01, fr)
    p = part('wheelbarrow', 'wood', sh)
    deco(p, 'wood_dark', Shape().cyl(fr @ V(0.5, 0, 0.2), 0.2, 0.06, axis=fr.to_3x3() @ V(0, 1, 0), seg=16))
    deco(p, 'soil', Shape().blob(fr @ V(0, 0, 0.6), (0.42, 0.26, 0.07), seg=12, rings=6))
    scr(p, fr @ V(-0.25, 0, 0.66))
    scr(p, fr @ V(0.3, 0, 0.66))


def flower_pot(x, y, colors, min_cx=0.0):
    sh = Shape().lathe([(0.15, GZ - 0.012), (0.2, GZ + 0.28), (0.22, GZ + 0.3), (0.22, GZ + 0.34)], center=V(x, y, 0), seg=16)
    p = part('flower_pot', 'pottery', sh, min_cx=min_cx)
    deco(p, 'soil', Shape().cyl(V(x, y, GZ + 0.34), 0.19, 0.02, seg=14))
    stems = Shape()
    blossoms = {c: Shape() for c in colors}
    for k in range(6):
        a = k / 6 * 2 * math.pi
        b = V(x + math.cos(a) * 0.16, y + math.sin(a) * 0.16, GZ + 0.34)
        t = b + V(math.cos(a) * 0.08, math.sin(a) * 0.08, 0.28 + 0.06 * (k % 2))
        stems.tube([b, t], [0.015, 0.01], seg=4)
        blossoms[colors[k % len(colors)]].blob(t, (0.06, 0.06, 0.045), seg=8, rings=5)
    deco(p, 'leaves', stems)
    for c, s in blossoms.items():
        deco(p, c, s)
    scr(p, V(x, y, GZ + 0.35))


def rock(x, y, r, min_cx=0.0):
    sh = Shape().blob(V(x, y, GZ + r * 0.35), (r * 1.2, r, r * 0.7), seg=12, rings=6,
                      shape=lambda v: v * (1 + 0.13 * math.sin(3 * v.x + 2 * v.y + x)))
    p = part('rock', 'rock', sh, min_cx=min_cx)
    scr(p, V(x, y, GZ + r * 1.0))


def garden():
    plot()
    fence()
    flagstones()
    well()
    vegetable_bed()
    tree()
    bench(-1.0, -3.6, 0.0, 'garden_bench')
    barrel(-3.25, -1.1, GZ, 0.3, 0.62, 'water_butt')
    coop()
    hen(-3.55, 1.95, 0.7)
    hen(-2.95, 3.25, 2.6, min_cx=0.35)
    woodpile()
    wheelbarrow()
    flower_pot(-0.35, -2.25, ('flower_a', 'flower_b'))
    flower_pot(2.05, -2.25, ('flower_c', 'flower_b'), min_cx=0.25)
    flower_pot(4.2, -3.75, ('flower_a', 'flower_c'), min_cx=0.6)
    rock(-4.3, -0.8, 0.3)
    rock(1.4, 3.75, 0.26, min_cx=0.45)


# ===================================================================== the house =====================================================================
class Face:
    """A wall's outer face. a runs along it from left to right as seen from outside, z is the height, d points out."""
    N = {'front': V(0, -1, 0), 'back': V(0, 1, 0), 'left': V(-1, 0, 0), 'right': V(1, 0, 0)}
    U = {'front': V(1, 0, 0), 'back': V(-1, 0, 0), 'left': V(0, -1, 0), 'right': V(0, 1, 0)}

    def __init__(self, side, k):
        self.side, self.k = side, k
        self.n, self.u = Face.N[side], Face.U[side]
        yf = YF[k]
        self.o, self.len = {'front': (V(-HX, yf, 0), 2 * HX), 'back': (V(HX, YB, 0), 2 * HX),
                            'left': (V(-HX, YB, 0), YB - yf), 'right': (V(HX, yf, 0), YB - yf)}[side]
        self.ends = 0.0 if side in ('front', 'back') else WT  # side walls fit between the front and back walls

    def p(self, a, z, d=0.0):
        return self.o + self.u * a + UP * z + self.n * d

    def box(self, sh, a0, a1, z0, z1, d0, d1, bev=0.015):
        c1, c2 = self.p(a0, z0, d0), self.p(a1, z1, d1)
        sh.box(V(min(c1.x, c2.x), min(c1.y, c2.y), min(c1.z, c2.z)), V(max(c1.x, c2.x), max(c1.y, c2.y), max(c1.z, c2.z)), bev)
        return sh


def window(f, a, zc, host, flowers=False, shutters=True, min_cx=0.0):
    w, h = 0.62, 0.7
    sh = Shape()
    f.box(sh, a - w / 2, a + w / 2, zc - h / 2, zc + h / 2, -0.012, 0.135, 0.01)
    for a0, a1, z0, z1 in ((a - w / 2, a - w / 2 + 0.07, zc - h / 2, zc + h / 2), (a + w / 2 - 0.07, a + w / 2, zc - h / 2, zc + h / 2),
                           (a - w / 2 + 0.06, a + w / 2 - 0.06, zc + h / 2 - 0.07, zc + h / 2), (a - w / 2 + 0.06, a + w / 2 - 0.06, zc - h / 2, zc - h / 2 + 0.07)):
        f.box(sh, a0, a1, z0, z1, 0.12, 0.19, 0.012)
    f.box(sh, a - 0.025, a + 0.025, zc - h / 2 + 0.05, zc + h / 2 - 0.05, 0.12, 0.17, 0.006)
    f.box(sh, a - w / 2 + 0.05, a + w / 2 - 0.05, zc - 0.025, zc + 0.025, 0.125, 0.172, 0.006)
    f.box(sh, a - w / 2 - 0.05, a + w / 2 + 0.05, zc - h / 2 - 0.08, zc - h / 2 + 0.02, -0.012, 0.24, 0.015)
    win = part(f'window{f.k}_{f.side}', 'frame', sh, min_cx=min_cx)
    glass = Shape()
    f.box(glass, a - w / 2 + 0.06, a + w / 2 - 0.06, zc - h / 2 + 0.06, zc + h / 2 - 0.06, 0.13, 0.142, 0.0)
    deco(win, 'glass', glass)
    scr(win, f.p(a, zc, 0.172), f.n)
    anchor(host, f.p(a, zc, 0), f.n, min_cx)
    if shutters:
        for s in (-1, 1):
            a0, a1 = (a - w / 2 - 0.44, a - w / 2 - 0.02) if s < 0 else (a + w / 2 + 0.02, a + w / 2 + 0.44)
            ss = Shape()
            f.box(ss, a0, a1, zc - h / 2 + 0.01, zc + h / 2 + 0.01, -0.012, 0.05, 0.01)
            sp = part(f'shutter{f.k}_{f.side}', 'shutter', ss, min_cx=min_cx)
            bat = Shape()
            for z in (zc - h / 2 + 0.12, zc + h / 2 - 0.1):
                f.box(bat, a0 + 0.03, a1 - 0.03, z - 0.035, z + 0.035, 0.04, 0.075, 0.008)
            for g in (1, 2):
                ag = a0 + (a1 - a0) * g / 3
                f.box(bat, ag - 0.006, ag + 0.006, zc - h / 2 + 0.03, zc + h / 2 - 0.01, 0.045, 0.054, 0.0)
            deco(sp, 'timber', bat)
            scr(sp, f.p((a0 + a1) / 2, zc - 0.15, 0.05), f.n)
    if flowers:
        z0 = F[f.k] + 0.03
        fb = Shape()
        f.box(fb, a - 0.4, a + 0.4, z0, z0 + 0.17, 0.15, 0.36, 0.015)
        box = part(f'flower_box{f.k}_{f.side}', 'wood_dark', fb, min_cx=0.15)
        green = Shape()
        bl = {'flower_a': Shape(), 'flower_b': Shape(), 'flower_c': Shape()}
        for i in range(7):
            aa = a - 0.33 + i * 0.11
            base = f.p(aa, z0 + 0.16, 0.25 + 0.04 * (i % 2))
            top = base + UP * (0.13 + 0.04 * (i % 3)) + f.n * 0.03
            green.tube([base, top], [0.014, 0.008], seg=4)
            bl[('flower_a', 'flower_b', 'flower_c')[i % 3]].blob(top, (0.05, 0.05, 0.04), seg=8, rings=4)
            green.blob(base + UP * 0.03, (0.05, 0.05, 0.03), seg=6, rings=4)
        deco(box, 'leaves', green)
        for c, s in bl.items():
            deco(box, c, s)
        for aa in (a - 0.27, a + 0.27):
            scr(box, f.p(aa, z0 + 0.085, 0.36), f.n)
    return win


def stone_face(k, side, windows, door=None, slots=()):
    """A stone wall of the ground floor, with windows, maybe the front door, and screws in the open stone."""
    f = Face(side, k)
    z0, z1 = F[k], F[k + 1] - ST - 0.004
    sh = Shape()
    f.box(sh, f.ends, f.len - f.ends, z0, z1, -WT, 0, 0.01)
    wall = part(f'wall{k}_{side}', 'stone', sh)
    stones = Shape()
    for a0, a1 in ((0, 0.0), (f.len, f.len)):
        z, i = z0, 0
        while z < z1 - 0.05:
            ln = 0.34 if i % 2 == 0 else 0.22
            zz = min(z1, z + 0.22)
            lo, hi = (0.0, ln) if a0 == 0 else (f.len - ln, f.len)
            f.box(stones, lo + 0.005, hi - 0.005, z + 0.008, zz - 0.008, -0.01, 0.025, 0.012)
            z, i = zz, i + 1
    holes = [(a - 0.8, a + 0.8) for a in windows] + ([(door - 0.62, door + 0.62)] if door is not None else [])
    for _ in range(28):
        a, z = RND.uniform(0.5, f.len - 0.5), RND.uniform(z0 + 0.15, z1 - 0.15)
        if any(lo < a < hi for lo, hi in holes) or any(abs(a - sa) < 0.32 and abs(z - sz) < 0.32 for sa, sz in slots):
            continue
        w, h = RND.uniform(0.16, 0.3), RND.uniform(0.1, 0.16)
        f.box(stones, a - w / 2, a + w / 2, z - h / 2, z + h / 2, -0.01, 0.018, 0.01)
    deco(wall, 'stone_dark', stones)
    for a, z in slots:
        scr(wall, f.p(a, z, 0), f.n)
    for a in windows:
        window(f, a, F[k] + 0.78, wall)
    if door is not None:
        d = Shape()
        f.box(d, door - 0.42, door + 0.42, z0 - 0.012, z0 + 1.17, -0.012, 0.13, 0.015)
        dp = part('front_door', 'door', d)
        planks = Shape()
        for i in range(1, 5):
            aa = door - 0.42 + i * 0.168
            f.box(planks, aa - 0.008, aa + 0.008, z0 + 0.02, z0 + 1.18, 0.125, 0.14, 0.0)
        deco(dp, 'wood_dark', planks)
        iron = Shape()
        for z in (z0 + 0.25, z0 + 0.95):
            f.box(iron, door - 0.4, door + 0.05, z - 0.04, z + 0.04, 0.12, 0.16, 0.01)
        iron.cyl(f.p(door + 0.28, z0 + 0.6, 0.16), 0.06, 0.02, axis=f.n, seg=12)
        deco(dp, 'iron', iron)
        for z in (z0 + 0.22, z0 + 0.75):
            scr(dp, f.p(door + 0.2, z, 0.13), f.n)
        for z in (z0 + 0.3, z0 + 0.88):
            anchor(wall, f.p(door - 0.05, z, 0), f.n)
        lin = Shape()
        f.box(lin, door - 0.6, door + 0.6, z0 + 1.15, z0 + 1.36, -0.012, 0.16, 0.02)
        lt = part('door_lintel', 'stone_dark', lin)
        scr(lt, f.p(door - 0.45, z0 + 1.235, 0.16), f.n)
        scr(lt, f.p(door + 0.45, z0 + 1.235, 0.16), f.n)
        lamp = Shape()
        f.box(lamp, door + 0.68, door + 0.86, z0 + 0.92, z0 + 1.12, 0.08, 0.26, 0.01)
        f.box(lamp, door + 0.6, door + 0.8, z0 + 1.1, z0 + 1.14, -0.01, 0.2, 0.005)
        deco(lt, 'iron', lamp)
        deco(lt, 'flame', f.box(Shape(), door + 0.71, door + 0.83, z0 + 0.95, z0 + 1.09, 0.11, 0.23, 0.01))
    return wall


def timber_face(k, side, windows, mid_posts=(), flowers=False):
    """A plastered wall of an upper floor in a timber frame: posts, sill and head beams, windows with shutters."""
    f = Face(side, k)
    z0, z1 = F[k], F[k + 1] - ST - 0.004
    sh = Shape()
    f.box(sh, f.ends, f.len - f.ends, z0, z1, -WT, 0, 0.01)
    wall = part(f'wall{k}_{side}', 'plaster', sh)
    posts = [0.2] + list(mid_posts) + [f.len - 0.2]
    for i, c in enumerate(posts):
        ps = Shape()
        f.box(ps, c - 0.2, c + 0.2, z0, z1, -0.012, 0.14, 0.02)
        p = part(f'post{k}_{side}', 'timber', ps)
        scr(p, f.p(c, z0 + 0.42, 0.14), f.n)
        scr(p, f.p(c, z1 - 0.38, 0.14), f.n)
        anchor(wall, f.p(min(max(c, f.ends + 0.18), f.len - f.ends - 0.18), (z0 + z1) / 2, 0), f.n)
    braces = Shape()
    sills = Shape()
    for b0, b1 in zip([p + 0.2 for p in posts], [p - 0.2 for p in posts[1:]]):
        win = [a for a in windows if b0 < a < b1]
        # the head beam spans the bay, with a screw at each end
        bs = Shape()
        f.box(bs, b0 + 0.006, b1 - 0.006, z1 - 0.26, z1, -0.012, 0.12, 0.015)
        bp = part(f'head{k}_{side}', 'timber', bs)
        for a in (b0 + 0.35, b1 - 0.35):
            scr(bp, f.p(a, z1 - 0.2, 0.12), f.n)
        # the sill beam: a part beside a window (under it, it's part of the wall: the flower box and shutters crowd it)
        pieces = [(b0, b1)] if not win else [(b0, win[0] - 0.76), (win[0] + 0.76, b1)] if b1 - b0 > 2.6 else []
        for s0, s1 in pieces:
            bs = Shape()
            f.box(bs, s0 + 0.006, s1 - 0.006, z0, z0 + 0.26, -0.012, 0.12, 0.015)
            bp = part(f'sill{k}_{side}', 'timber', bs)
            scr(bp, f.p((s0 + s1) / 2, z0 + 0.17, 0.12), f.n)
        if win and not pieces:
            f.box(sills, b0 + 0.006, b1 - 0.006, z0, z0 + 0.26, -0.012, 0.12, 0.015)
        if win:
            a = win[0]
            window(f, a, z0 + 0.7, wall, flowers=flowers)
            spans = [(b0, a - 0.79), (a + 0.79, b1)]
        else:
            spans = [(b0, b1)]
        for s0, s1 in spans:
            if s1 - s0 < 0.55:
                continue
            mid = (s0 + s1) / 2
            scr(wall, f.p(mid, (z0 + z1) / 2, 0), f.n)
            # knee braces from the posts to the head beam, as decoration on the plaster
            for side_, at in ((1, s0), (-1, s1)):
                if abs(at - b0) < 0.01 or abs(at - b1) < 0.01:
                    p0, p1 = f.p(at, z1 - 0.62, 0.0), f.p(at + side_ * 0.36, z1 - 0.26, 0.0)
                    L = (p1 - p0).length
                    ex = (p1 - p0).normalized()
                    ey = f.n.cross(ex)
                    fr = frame(p0, ex, ey, f.n)
                    braces.box((-0.03, -0.055, -0.01), (L + 0.03, 0.055, 0.06), 0.01, fr)
    for sh_ in (braces, sills):
        if sh_.bm.verts:
            deco(wall, 'timber', sh_)
        else:
            sh_.bm.free()
    return wall


def joists(k):
    """Beam ends under the overhang of floor k, on the front."""
    sh = Shape()
    for i in range(9):
        x = -HX + 0.3 + i * (2 * HX - 0.6) / 8
        sh.box((x - 0.07, YF[k] - 0.01, F[k] - ST - 0.16), (x + 0.07, YF[k - 1] + 0.02, F[k] - ST + 0.005), 0.015)
    return sh


def floor(k):
    """Floor k (1 to 3): two halves of boards with the stairwell in the right one, and its trapdoor."""
    z0, z1 = F[k] - ST, F[k]
    yf = YF[k]
    hx, hx1 = HOLE[k]
    hy, hy1 = 1.6, 2.25
    left = Shape().box((-HX, yf, z0), (XP - 0.002, YB, z1), 0.01)
    right = Shape().box((XP + 0.002, yf, z0), (HX, hy + 0.005, z1), 0.01).box((hx - 0.005, hy1 - 0.005, z0), (hx1 + 0.005, YB, z1), 0.01)
    right.box((XP + 0.002, hy - 0.005, z0), (hx + 0.005, YB, z1), 0.01)
    right.box((hx1 - 0.005, hy - 0.005, z0), (HX, YB, z1), 0.01)
    halves = (part(f'floor{k}_left', 'floor', left), part(f'floor{k}_right', 'floor', right))
    for h, (x0, x1) in zip(halves, ((-HX, XP), (XP, HX))):
        g = Shape()
        y = yf + 0.29
        while y < YB - 0.1:
            g.box((x0 + 0.02, y - 0.006, z1 - 0.004), (x1 - 0.02, y + 0.006, z1 + 0.003), 0.0)
            y += 0.3
        deco(h, 'wood_dark', g)
    if k < 3:
        deco(halves[0], 'timber', joists(k))
    trap = Shape().box((hx + 0.006, hy + 0.006, z0 + 0.004), (hx1 - 0.006, hy1 - 0.006, z1), 0.012)
    td = part(f'trapdoor{k}', 'wood_dark', trap)
    xm, ym = (hx + hx1) / 2, (hy + hy1) / 2
    deco(td, 'iron', Shape().cyl(V(xm - 0.22, ym, z1 + 0.01), 0.07, 0.02, seg=12).box((xm + 0.2, hy + 0.06, z1 - 0.005), (xm + 0.27, hy1 - 0.06, z1 + 0.012), 0.004))
    scr(td, V(xm + 0.02, ym, z1))
    if k == 3:  # a knee wall under the roof boards at the front and the back
        for h, (x0, x1) in zip(halves, ((-HX, XP), (XP, HX))):
            kw = Shape().box((x0 + 0.004, yf, z1 - 0.01), (x1 - 0.004, yf + WT, ZK + 0.01), 0.01).box((x0 + 0.004, YB - WT, z1 - 0.01), (x1 - 0.004, YB, ZK + 0.01), 0.01)
            deco(h, 'timber', kw)
    return halves


def plinth():
    z0, z1 = GZ - 0.012, F[0]
    halves = (part('plinth_left', 'flagstone', Shape().box((-HX - 0.1, YF[0] - 0.1, z0), (XP - 0.002, YB + 0.1, z1), 0.02)),
              part('plinth_right', 'flagstone', Shape().box((XP + 0.002, YF[0] - 0.1, z0), (HX + 0.1, YB + 0.1, z1), 0.02)))
    for h, (x0, x1) in zip(halves, ((-HX - 0.1, XP), (XP, HX + 0.1))):
        g = Shape()
        y = YF[0] + 0.45
        while y < YB - 0.1:
            g.box((x0 + 0.12, y - 0.008, z1 - 0.004), (x1 - 0.12, y + 0.008, z1 + 0.003), 0.0)
            y += 0.55
        x = x0 + 0.5
        while x < x1 - 0.2:
            g.box((x - 0.008, YF[0] + 0.05, z1 - 0.004), (x + 0.008, YB - 0.05, z1 + 0.003), 0.0)
            x += 0.6
        deco(h, 'stone_dark', g)
    return halves


def partition(k):
    z0, z1 = F[k], F[k + 1] - ST - 0.004
    for nm, (y0, y1) in (('front', (INNER_Y[k] + 0.002, 0.15)), ('back', (0.95, YB - WT - 0.002))):
        sh = Shape().box((XP - 0.06, y0, z0), (XP + 0.06, y1, z1), 0.01)
        p = part(f'partition{k}_{nm}', 'plaster', sh)
        trim = Shape()
        for y in (y0 + 0.04, y1 - 0.04):
            trim.box((XP - 0.075, y - 0.05, z0), (XP + 0.075, y + 0.05, z1), 0.01)
        deco(p, 'timber', trim)
        for s, y in ((-1, y0 + 0.3), (1, y1 - 0.3)):
            scr(p, V(XP + s * 0.06, y, (z0 + z1) / 2 + 0.1), V(s, 0, 0))


def stairs(k, host):
    """Four steep steps along the back wall, up to the stairwell in the floor above."""
    z0 = F[k]
    rise = (F[k + 1] - F[k]) / 5
    x0, s = STAIRS[k]
    sh = Shape()
    treads = Shape()
    for i in range(4):
        a, b = sorted((x0 + s * 0.31 * i, x0 + s * 0.31 * (i + 1)))
        sh.box((a - 0.005, 1.66, z0 - 0.012), (b + 0.005, 2.24, z0 + (i + 1) * rise), 0.012)
        treads.box((a - 0.015, 1.64, z0 + (i + 1) * rise - 0.035), (b + 0.015, 2.24, z0 + (i + 1) * rise + 0.01), 0.008)
    st = part(f'stairs{k}', 'wood', sh)
    deco(st, 'wood_light', treads)
    for i in range(3):
        scr(st, V(x0 + s * 0.31 * (i + 0.5), 1.95, z0 + (i + 1) * rise + 0.01))
    for i in (0, 2):
        anchor(host, V(x0 + s * 0.31 * (i + 0.5), 1.95, z0))
    return st


def gable(side):
    k = 3
    f = Face(side, k)
    th = 0.004
    pts = [(f.ends, F[3]), (f.len - f.ends, F[3]), (f.len - f.ends, ZK + 0.001 + f.ends * TAN), (f.len / 2, ZR - th), (f.ends, ZK + 0.001 + f.ends * TAN)]
    sh = Shape().prism([f.p(a, z, -WT) for a, z in pts], f.n * WT)
    wall = part(f'gable_{side}', 'plaster', sh)
    # rafters along the roof line and a collar, as decoration
    dec = Shape()
    for s in (-1, 1):
        a0 = 0.0 if s < 0 else f.len
        p0, p1 = f.p(a0, ZK - 0.02, 0.0), f.p(f.len / 2, ZR - 0.02, 0.0)
        ex = (p1 - p0).normalized()
        ey = f.n.cross(ex)
        if ey.z > 0:
            ey = -ey
        dec.box((0, 0.0, -0.01), ((p1 - p0).length, 0.13, 0.05), 0.01, frame(p0, ex, ey, f.n))
    deco(wall, 'timber', dec)
    kp = Shape()
    f.box(kp, f.len / 2 - 0.18, f.len / 2 + 0.18, F[3], ZR - 0.28, -0.012, 0.14, 0.02)
    king = part(f'king_post_{side}', 'timber', kp)
    scr(king, f.p(f.len / 2, F[3] + 0.5, 0.14), f.n)
    scr(king, f.p(f.len / 2, F[3] + 1.95, 0.14), f.n)
    anchor(wall, f.p(f.len / 2, F[3] + 1.05, 0), f.n)
    for s in (-1, 1):
        cs = Shape()
        a0, a1 = (f.len / 2 - 0.69, f.len / 2 - 0.19) if s < 0 else (f.len / 2 + 0.19, f.len / 2 + 0.69)
        f.box(cs, a0, a1, F[3] + 1.28, F[3] + 1.52, -0.012, 0.12, 0.015)
        c = part(f'collar_{side}', 'timber', cs, min_cx=0.3)
        scr(c, f.p((a0 + a1) / 2, F[3] + 1.4, 0.12), f.n)
        window(f, f.len / 2 + s * 0.8, F[3] + 0.68, wall, shutters=False)
    return wall


def roof():
    c, s = math.cos(PITCH), math.sin(PITCH)
    slopes = {'front': frame(V(0, YF[3], ZK), V(1, 0, 0), V(0, c, s), V(0, -s, c)),
              'back': frame(V(0, YB, ZK), V(-1, 0, 0), V(0, -c, s), V(0, s, c))}
    v0, v1 = -0.36, LR + 0.08
    rows = 5
    rh = (LR - 0.24 - v0) / rows
    for nm, fr in slopes.items():
        n = fr.to_3x3() @ V(0, 0, 1)
        for half, (u0, u1) in (('a', (-2.78, -0.002)), ('b', (0.002, 2.78))):
            deck = part(f'roof_boards_{nm}{half}', 'wood_dark', Shape().box((u0, v0, 0), (u1, v1, 0.12), 0.015, fr))
            barge = Shape()
            ue = u0 if u0 < -1 else u1
            barge.box((ue - 0.05, v0, -0.12), (ue + 0.05, v1, 0.16), 0.01, fr)
            barge.box((u0, v0 - 0.05, -0.05), (u1, v0 + 0.03, 0.14), 0.01, fr)
            deco(deck, 'timber', barge)
            for r in range(rows):
                for q in range(2):
                    a0 = u0 + (u1 - u0) * q / 2 + 0.004
                    a1 = u0 + (u1 - u0) * (q + 1) / 2 - 0.004
                    b0 = v0 + r * rh + 0.012
                    b1 = b0 + rh - 0.024
                    tile = Shape()
                    period = 0.27
                    nw = max(2, round((a1 - a0) / period * 3))
                    top = []
                    for i in range(nw + 1):
                        uu = a0 + (a1 - a0) * i / nw
                        ph = (uu - a0) / period * 2 * math.pi
                        top.append(V(uu, b0, 0.108 + 0.16 + 0.045 * (0.5 + 0.5 * math.cos(ph))))
                    outline = [V(a0, b0, 0.108), V(a1, b0, 0.108)] + list(reversed(top))
                    tile.prism([fr @ p for p in outline], fr.to_3x3() @ V(0, b1 - b0, 0))
                    t = part(f'tiles_{nm}{half}{r}{q}', 'roof', tile, min_cx=0.0)
                    um = (a0 + a1) / 2
                    vm = (b0 + b1) / 2
                    for du in (-0.32, 0.32):
                        crest = a0 + period * round(((um + du) - a0) / period)
                        scr_on(t, fr @ V(crest, vm, 0.32), n)
                    anchor(deck, fr @ V(um, vm, 0.12), n)
    # the ridge
    sh = Shape()
    for nm, fr in slopes.items():
        sh.box((-2.8, LR - 0.2, 0.285), (2.8, LR + 0.16, 0.36), 0.015, fr)
    ridge_l = part('ridge', 'roof_dark', sh)
    for x in (-2.1, -0.7, 0.7, 2.1):
        for nm, fr in slopes.items():
            u = x if nm == 'front' else -x
            scr(ridge_l, fr @ V(u, LR - 0.06, 0.36), fr.to_3x3() @ V(0, 0, 1))
    # the chimney, on the back slope near the left gable
    cx0, cx1, cy0, cy1 = -1.85, -1.25, 0.95, 1.5
    ztop = 8.6
    zb = ZK + (YB - cy1) * TAN + 0.1
    ch = Shape().box((cx0, cy0, zb), (cx1, cy1, ztop), 0.02)
    chim = part('chimney', 'brick', ch)
    bricks = Shape()
    z = zb + 0.6
    i = 0
    while z < ztop - 0.15:
        off = 0.0 if i % 2 else 0.15
        for x in (cx0 + 0.15 + off, cx0 + 0.45 + off):
            if x < cx1 - 0.05:
                bricks.box((x - 0.006, cy0 - 0.004, z - 0.11), (x + 0.006, cy0 + 0.004, z + 0.0), 0.0)
        bricks.box((cx0 - 0.004, cy0 - 0.004, z - 0.006), (cx1 + 0.004, cy1 + 0.004, z + 0.006), 0.0)
        z += 0.13
        i += 1
    deco(chim, 'stone_dark', bricks)
    ym = (cy0 + cy1) / 2
    scr(chim, V(cx0, ym, ztop - 0.5), (-1, 0, 0))
    scr(chim, V(cx1, ym, ztop - 0.5), (1, 0, 0))
    scr(chim, V((cx0 + cx1) / 2, cy1, ztop - 0.45), (0, 1, 0))
    scr(chim, V((cx0 + cx1) / 2, cy0, ztop - 0.35), (0, -1, 0))
    cap = Shape().box((cx0 - 0.08, cy0 - 0.08, ztop - 0.02), (cx1 + 0.08, cy1 + 0.08, ztop + 0.13), 0.02)
    capp = part('chimney_cap', 'stone_dark', cap)
    deco(capp, 'pottery', Shape().cyl(V((cx0 + cx1) / 2 + 0.1, ym + 0.08, ztop + 0.27), 0.1, 0.3, seg=12, r2=0.08))
    scr(capp, V(cx0 + 0.15, ym - 0.06, ztop + 0.13))
    anchor(chim, V((cx0 + cx1) / 2 + 0.02, ym, ztop))


# ===================================================================== the rooms =====================================================================
def host_at(floors, x):
    return floors[0] if x < XP else floors[1]


def top_screws(obj, pts, z, min_cx=0.0):
    for x, y in pts:
        scr(obj, V(x, y, z), UP, min_cx=min_cx)


def kitchen(z, fl):
    # the hearth against the left wall, with a fire, a cauldron on a tripod and a hood over it
    h = part('hearth', 'stone_dark', Shape().box((-2.25, 0.45, z - 0.012), (-1.65, 1.75, z + 0.25), 0.02))
    top_screws(h, ((-1.85, 0.62), (-1.85, 1.62)), z + 0.25)
    anchor(fl[0], V(-1.95, 1.15, z))
    logs = Shape()
    for i, (y, a) in enumerate(((0.92, 0.0), (1.15, 0.0), (1.38, 0.0))):
        logs.cyl(V(-1.97, y, z + 0.32), 0.07, 0.5, axis=(1, 0.15 * (i - 1), 0), seg=8)
    lg = part('fire_logs', 'wood_dark', logs)
    fire = Shape()
    for i in range(5):
        fire.cyl(V(-1.97 + 0.08 * math.sin(i * 2.1), 1.0 + i * 0.075, z + 0.46), 0.06, 0.2, seg=6, r2=0.0)
    deco(lg, 'fire', fire)
    scr(lg, V(-1.97, 0.92, z + 0.39), UP)
    tri = Shape()
    for a in (0.3, 2.4, 4.5):
        tri.tube([V(-1.97 + 0.26 * math.cos(a), 1.15 + 0.26 * math.sin(a), z + 0.25), V(-1.97, 1.15, z + 0.92)], [0.015, 0.012], seg=5)
    cal = part('cauldron', 'iron', Shape().lathe([(0.12, z + 0.56), (0.2, z + 0.62), (0.21, z + 0.72), (0.17, z + 0.82), (0.18, z + 0.84)],
                                                 center=V(-1.97, 1.15, 0), seg=18))
    deco(cal, 'iron', tri)
    deco(cal, 'soup', Shape().cyl(V(-1.97, 1.15, z + 0.835), 0.16, 0.01, seg=16))
    scr(cal, V(-1.97, 1.15, z + 0.84))
    hood = part('hood', 'plaster', Shape().box((-2.255, 0.5, z + 1.0), (-1.72, 1.8, z + 1.392), 0.015))
    deco(hood, 'timber', Shape().box((-1.75, 0.47, z + 0.97), (-1.66, 1.83, z + 1.05), 0.01))
    scr(hood, V(-1.99, 0.5, z + 1.2), (0, -1, 0))
    scr(hood, V(-1.99, 1.8, z + 1.2), (0, 1, 0))
    # the table with benches, and bread on it
    t = Shape().box((-1.42, -0.75, z + 0.42), (-0.77, 0.35, z + 0.48), 0.012)
    for x in (-1.36, -0.83):
        for y in (-0.69, 0.29):
            t.box((x - 0.035, y - 0.035, z - 0.012), (x + 0.035, y + 0.035, z + 0.43), 0.008)
    tb = part('kitchen_table', 'wood_light', t)
    top_screws(tb, ((-1.1, 0.15),), z + 0.48)
    bread = Shape().box((-1.25, -0.7, z + 0.47), (-0.95, -0.38, z + 0.51), 0.008)
    br = part('bread_board', 'wood', bread, min_cx=0.25)
    deco(br, 'food', Shape().blob(V(-1.1, -0.47, z + 0.55), (0.11, 0.07, 0.05), seg=10, rings=5))
    deco(tb, 'pottery', Shape().lathe([(0.04, z + 0.48), (0.06, z + 0.55), (0.03, z + 0.63), (0.045, z + 0.67)], center=V(-0.88, -0.2, 0), seg=10))
    scr(br, V(-1.1, -0.6, z + 0.51))
    for x in (-1.78, -0.48):
        b = Shape().box((x - 0.13, -0.62, z + 0.22), (x + 0.13, 0.25, z + 0.27), 0.01)
        for y in (-0.55, 0.18):
            b.box((x - 0.1, y - 0.03, z - 0.012), (x + 0.1, y + 0.03, z + 0.23), 0.008)
        bp = part('kitchen_bench', 'wood', b)
        top_screws(bp, ((x, -0.18),), z + 0.27)
    # a dresser with plates, a barrel and a basket of apples
    d = part('dresser', 'wood', Shape().box((-1.55, 1.9, z - 0.012), (-0.6, 2.25, z + 0.55), 0.015)
             .box((-1.55, 2.12, z + 0.54), (-0.6, 2.25, z + 1.12), 0.015).box((-1.57, 1.97, z + 1.1), (-0.58, 2.25, z + 1.16), 0.012)
             .box((-1.55, 2.02, z + 0.8), (-0.6, 2.2, z + 0.83), 0.006))
    plates = Shape()
    for i in range(4):
        plates.cyl(V(-1.42 + i * 0.25, 2.07, z + 0.97), 0.1, 0.018, axis=(0, 1, 0.35), seg=14)
    deco(d, 'linen', plates)
    deco(d, 'pottery', Shape().lathe([(0.05, z + 0.83), (0.08, z + 0.9), (0.05, z + 0.99)], center=V(-1.3, 2.1, 0), seg=10)
         .lathe([(0.05, z + 0.83), (0.08, z + 0.9), (0.05, z + 0.99)], center=V(-0.85, 2.1, 0), seg=10))
    deco(d, 'wood_dark', Shape().box((-1.5, 1.88, z + 0.08), (-1.1, 1.9, z + 0.48), 0.005).box((-1.05, 1.88, z + 0.08), (-0.65, 1.9, z + 0.48), 0.005))
    top_screws(d, ((-1.35, 2.06), (-0.8, 2.06)), z + 1.16)
    anchor(fl[0], V(-1.07, 2.07, z))
    barrel(-1.95, 2.0, z, 0.22, 0.46, 'kitchen_barrel', host=fl[0])
    bk = part('basket', 'straw', Shape().lathe([(0.13, z - 0.012), (0.19, z + 0.2), (0.2, z + 0.22)], center=V(-1.95, -0.82, 0), seg=14), min_cx=0.4)
    ap = Shape()
    for i in range(5):
        a = i * 1.3
        ap.blob(V(-1.95 + 0.09 * math.cos(a), -0.82 + 0.09 * math.sin(a), z + 0.24), (0.07, 0.07, 0.065), seg=8, rings=5)
    deco(bk, 'apple', ap)
    scr(bk, V(-1.95, -0.82, z + 0.28))


def living_room(z, fl):
    # an armchair with a cushion, a rug, a round table with a candle, a chest and a spinning wheel
    ch = Shape().box((1.48, -0.1, z - 0.012), (2.08, 0.5, z + 0.24), 0.02)
    ch.box((1.94, -0.1, z + 0.2), (2.08, 0.5, z + 0.78), 0.02)
    for y in (-0.1, 0.36):
        ch.box((1.48, y, z + 0.2), (2.0, y + 0.14, z + 0.46), 0.02)
    arm = part('armchair', 'wood_dark', ch)
    scr(arm, V(2.01, 0.2, z + 0.78))
    cu = part('cushion', 'cloth_red', Shape().box((1.5, 0.04, z + 0.228), (1.93, 0.36, z + 0.38), 0.05))
    scr(cu, V(1.7, 0.2, z + 0.38))
    anchor(arm, V(1.72, 0.2, z + 0.24))
    anchor(fl[1], V(1.78, 0.2, z))
    rug = part('rug', 'cloth_blue', Shape().box((0.0, -0.75, z - 0.004), (1.3, 0.8, z + 0.03), 0.01))
    deco(rug, 'wool', Shape().box((0.06, -0.69, z + 0.028), (1.24, -0.62, z + 0.034), 0.0).box((0.06, 0.67, z + 0.028), (1.24, 0.74, z + 0.034), 0.0))
    top_screws(rug, ((0.3, 0.45), (1.0, -0.4)), z + 0.03)
    tb = Shape().cyl(V(1.1, 1.05, z + 0.4), 0.27, 0.05, seg=20).cyl(V(1.1, 1.05, z + 0.2), 0.05, 0.4, seg=10).cyl(V(1.1, 1.05, z + 0.02), 0.18, 0.05, seg=14)
    t = part('round_table', 'wood', tb)
    deco(t, 'candle', Shape().cyl(V(1.2, 1.1, z + 0.5), 0.035, 0.16, seg=8))
    deco(t, 'flame', Shape().blob(V(1.2, 1.1, z + 0.62), (0.025, 0.025, 0.045), seg=6, rings=4))
    scr(t, V(1.0, 1.0, z + 0.425))
    chest(1.55, -0.87, z, fl[1], 'living_chest', along_x=True)
    sw = Shape()
    sw.box((-0.05, -0.85, z + 0.2), (0.6, -0.65, z + 0.28), 0.015)
    for x, y in ((0.0, -0.8), (0.55, -0.8), (0.3, -0.7)):
        sw.box((x - 0.025, y - 0.025, z - 0.012), (x + 0.025, y + 0.025, z + 0.21), 0.006)
    sw.box((0.08, -0.79, z + 0.27), (0.12, -0.75, z + 0.75), 0.006)
    sw.cyl(V(0.1, -0.68, z + 0.72), 0.3, 0.035, axis=(0, 1, 0), seg=24)
    sw.cyl(V(0.5, -0.75, z + 0.4), 0.03, 0.25, seg=8)
    wheel = part('spinning_wheel', 'wood_light', sw, min_cx=0.2)
    deco(wheel, 'wool', Shape().blob(V(0.5, -0.75, z + 0.56), (0.07, 0.07, 0.09), seg=8, rings=5))
    scr(wheel, V(0.36, -0.75, z + 0.28))


def chest(x, y, z, host, name='chest', along_x=True, w=0.62, d=0.36, h=0.3, min_cx=0.0):
    hw, hd = (w / 2, d / 2) if along_x else (d / 2, w / 2)
    body = part(name, 'wood', Shape().box((x - hw, y - hd, z - 0.012), (x + hw, y + hd, z + h), 0.015), min_cx=min_cx)
    deco(body, 'iron', Shape().box((x - hw - 0.008, y - hd - 0.008, z + 0.04), (x + hw + 0.008, y + hd + 0.008, z + 0.08), 0.004))
    lid = part(name + '_lid', 'wood_dark', Shape().box((x - hw - 0.02, y - hd - 0.02, z + h - 0.012), (x + hw + 0.02, y + hd + 0.02, z + h + 0.14), 0.03),
               min_cx=min_cx)
    bands = Shape()
    for s in (-0.6, 0.6):
        if along_x:
            bands.box((x + s * hw - 0.03, y - hd - 0.03, z + h - 0.01), (x + s * hw + 0.03, y + hd + 0.03, z + h + 0.15), 0.006)
        else:
            bands.box((x - hw - 0.03, y + s * hd - 0.03, z + h - 0.01), (x + hw + 0.03, y + s * hd + 0.03, z + h + 0.15), 0.006)
    deco(lid, 'iron', bands)
    scr(lid, V(x, y, z + h + 0.14))
    anchor(body, V(x, y, z + h))
    anchor(host, V(x, y, z))
    return body


def bed(x0, x1, y0, y1, z, host, cloth, name='bed', min_cx=0.0):
    """A bed with its head at x0 (against a wall): frame, mattress with a blanket, pillows."""
    s = 1 if x1 > x0 else -1
    lo, hi = min(x0, x1), max(x0, x1)
    fr = Shape().box((lo, y0, z - 0.012), (hi, y1, z + 0.24), 0.02)
    fr.box((x0 - s * 0.0, y0 - 0.02, z - 0.012), (x0 + s * 0.1, y1 + 0.02, z + 0.78), 0.02)
    fr.box((x1 - s * 0.08, y0 - 0.02, z - 0.012), (x1, y1 + 0.02, z + 0.46), 0.02)
    b = part(name, 'wood_dark', fr, min_cx=min_cx)
    deco(b, 'wood', Shape().box((x0 + s * 0.098, y0 + 0.08, z + 0.5), (x0 + s * 0.11, y1 - 0.08, z + 0.7), 0.0)
         if s > 0 else Shape().box((x0 - 0.11, y0 + 0.08, z + 0.5), (x0 - 0.098, y1 - 0.08, z + 0.7), 0.0))
    m0, m1 = x0 + s * 0.12, x1 - s * 0.1
    mattress = part(name + '_blanket', cloth, Shape().box((min(m0, m1), y0 + 0.04, z + 0.228), (max(m0, m1), y1 - 0.04, z + 0.4), 0.05), min_cx=min_cx)
    fold = x0 + s * 0.45
    deco(mattress, 'linen', Shape().box((min(fold, fold + s * 0.14), y0 + 0.035, z + 0.33), (max(fold, fold + s * 0.14), y1 - 0.035, z + 0.41), 0.02))
    L = abs(m1 - m0)
    scr(mattress, V(x0 + s * (0.12 + L * 0.62), (y0 + y1) / 2, z + 0.4))
    if L > 0.9:
        scr(mattress, V(x0 + s * (0.12 + L * 0.9), (y0 + y1) / 2 + 0.15, z + 0.4), min_cx=0.5)
    anchor(b, V(x0 + s * (0.12 + L * 0.4), (y0 + y1) / 2, z + 0.24))
    anchor(host, V((x0 + x1) / 2, (y0 + y1) / 2, z))
    pw = y1 - y0 - 0.14
    np = 2 if pw > 0.6 else 1
    pl = Shape()
    for i in range(np):
        yc = y0 + 0.07 + pw * (i + 0.5) / np
        pl.blob(V(x0 + s * 0.27, yc, z + 0.46), (0.13, pw / np / 2 - 0.02, 0.07), seg=12, rings=6)
    pil = part(name + '_pillows', 'linen', pl, min_cx=min_cx)
    scr(pil, V(x0 + s * 0.27, y0 + 0.07 + pw / np / 2, z + 0.53))


def bedroom(z, fl):
    bed(-2.25, -0.98, 0.15, 1.08, z, fl[0], 'cloth_blue', 'double_bed')
    ns = part('nightstand', 'wood', Shape().box((-2.25, 1.18, z - 0.012), (-1.9, 1.52, z + 0.42), 0.015))
    deco(ns, 'candle', Shape().cyl(V(-2.15, 1.42, z + 0.49), 0.035, 0.14, seg=8))
    deco(ns, 'flame', Shape().blob(V(-2.15, 1.42, z + 0.6), (0.025, 0.025, 0.045), seg=6, rings=4))
    deco(ns, 'wood_dark', Shape().box((-1.9, 1.24, z + 0.22), (-1.89, 1.46, z + 0.36), 0.0))
    scr(ns, V(-2.03, 1.3, z + 0.42))
    wardrobe(-1.62, -0.68, z, fl[0])
    chest(-0.62, 0.62, z, fl[0], 'bedroom_chest', along_x=False)
    rug = part('bedroom_rug', 'cloth_red', Shape().box((-1.95, -0.95, z - 0.004), (-1.0, 0.05, z + 0.03), 0.01))
    deco(rug, 'wool', Shape().box((-1.89, -0.89, z + 0.028), (-1.06, -0.01, z + 0.033), 0.0))
    top_screws(rug, ((-1.7, -0.7), (-1.25, -0.2)), z + 0.03)


def wardrobe(x0, x1, z, host, y1=2.25, name='wardrobe', min_cx=0.0):
    y0 = y1 - 0.4
    w = part(name, 'wood', Shape().box((x0, y0, z - 0.012), (x1, y1, z + 1.08), 0.015).box((x0 - 0.03, y0 - 0.03, z + 1.06), (x1 + 0.03, y1, z + 1.14), 0.015),
             min_cx=min_cx)
    xm = (x0 + x1) / 2
    deco(w, 'wood_dark', Shape().box((x0 + 0.05, y0 - 0.01, z + 0.08), (xm - 0.015, y0 + 0.005, z + 0.98), 0.0)
         .box((xm + 0.015, y0 - 0.01, z + 0.08), (x1 - 0.05, y0 + 0.005, z + 0.98), 0.0))
    deco(w, 'iron', Shape().blob(V(xm - 0.05, y0 - 0.02, z + 0.55), (0.02, 0.02, 0.02), seg=6, rings=4).blob(V(xm + 0.05, y0 - 0.02, z + 0.55), (0.02, 0.02, 0.02), seg=6, rings=4))
    top_screws(w, ((x0 + 0.19, (y0 + y1) / 2), (x1 - 0.19, (y0 + y1) / 2)), z + 1.14)
    anchor(host, V(xm, (y0 + y1) / 2, z))


def bathroom(z, fl):
    # a wooden tub under a bucket shower, a washstand with a basin, and a privy
    tx, ty = 1.62, -0.6
    tub = part('tub', 'wood_light', Shape().lathe([(0.36, z - 0.012), (0.43, z + 0.38), (0.45, z + 0.4)], center=V(tx, ty, 0), seg=24))
    deco(tub, 'water', Shape().cyl(V(tx, ty, z + 0.4), 0.38, 0.012, seg=24))
    deco(tub, 'iron', Shape().cyl(V(tx, ty, z + 0.1), 0.385, 0.035, seg=24).cyl(V(tx, ty, z + 0.3), 0.425, 0.035, seg=24))
    for a in (0.6, 3.2):
        scr(tub, V(tx + 0.3 * math.cos(a), ty + 0.3 * math.sin(a), z + 0.4))
    anchor(fl[1], V(tx, ty, z))
    sf = Shape()
    for y in (ty - 0.42, ty + 0.42):
        sf.box((2.0, y - 0.05, z - 0.012), (2.1, y + 0.05, z + 1.16), 0.012)
    sf.box((1.98, ty - 0.5, z + 1.08), (2.12, ty + 0.5, z + 1.17), 0.012)
    sf.box((1.55, ty - 0.04, z + 1.08), (2.04, ty + 0.04, z + 1.15), 0.01)
    frm = part('shower_frame', 'wood', sf)
    scr(frm, V(2.05, ty - 0.3, z + 1.17))
    scr(frm, V(2.05, ty + 0.3, z + 1.17))
    bk = part('shower_bucket', 'wood_light', Shape().lathe([(0.1, z + 0.72), (0.15, z + 0.92)], center=V(tx, ty, 0), seg=14))
    deco(bk, 'rope', Shape().cyl(V(tx, ty, z + 1.0), 0.012, 0.18, seg=5).cyl(V(tx + 0.13, ty, z + 0.62), 0.01, 0.2, seg=5))
    deco(bk, 'iron', Shape().cyl(V(tx, ty, z + 0.78), 0.115, 0.02, seg=14).cyl(V(tx, ty, z + 0.88), 0.14, 0.02, seg=14))
    deco(bk, 'wood_dark', Shape().blob(V(tx + 0.13, ty, z + 0.5), (0.03, 0.03, 0.04), seg=6, rings=4))
    scr(bk, V(tx - 0.04, ty + 0.04, z + 0.92))
    ws = Shape().box((0.1, -1.3, z + 0.44), (0.88, -0.96, z + 0.5), 0.012)
    for x in (0.15, 0.83):
        for y in (-1.25, -1.01):
            ws.box((x - 0.03, y - 0.03, z - 0.012), (x + 0.03, y + 0.03, z + 0.45), 0.006)
    ws.box((0.13, -1.28, z + 0.12), (0.85, -0.98, z + 0.15), 0.006)
    stand = part('washstand', 'wood', ws)
    deco(stand, 'linen', Shape().box((0.86, -1.28, z + 0.2), (0.89, -0.98, z + 0.48), 0.01))
    scr(stand, V(0.8, -1.13, z + 0.5))
    basin = part('basin', 'copper', Shape().lathe([(0.08, z + 0.488), (0.17, z + 0.56), (0.18, z + 0.58)], center=V(0.3, -1.13, 0), seg=18))
    deco(basin, 'water', Shape().cyl(V(0.3, -1.13, z + 0.555), 0.14, 0.01, seg=16))
    scr(basin, V(0.26, -1.13, z + 0.58))
    pr = Shape().box((-0.16, 0.45, z - 0.012), (0.42, 0.95, z + 0.36), 0.015)
    priv = part('privy', 'wood', pr)
    deco(priv, 'wood_dark', Shape().cyl(V(0.12, 0.72, z + 0.36), 0.14, 0.012, seg=16))
    deco(priv, 'wood_light', Shape().cyl(V(0.12, 0.72, z + 0.375), 0.11, 0.02, seg=16))
    scr(priv, V(0.12, 0.7, z + 0.39))
    anchor(fl[1], V(0.12, 0.72, z))


def kids_room(z, fl):
    bed(-2.25, -1.25, -1.45, -0.82, z, fl[0], 'cloth_red', 'small_bed')
    bed(-2.25, -1.25, 0.3, 0.93, z, fl[0], 'cloth_green', 'small_bed', min_cx=0.15)
    chest(-0.78, 2.03, z, fl[0], 'toy_chest', along_x=True, w=0.6, d=0.36, h=0.28)
    toys = Shape().box((-0.92, 1.82, z), (-0.8, 1.94, z + 0.12), 0.01)
    # a rocking horse
    hx, hy = -0.85, -0.35
    rh = Shape().blob(V(hx, hy, z + 0.42), (0.26, 0.1, 0.11), seg=14, rings=7)
    rh.blob(V(hx - 0.26, hy, z + 0.6), (0.08, 0.07, 0.15), seg=10, rings=6)
    rh.blob(V(hx - 0.34, hy, z + 0.68), (0.12, 0.06, 0.06), seg=10, rings=5)
    for x in (-0.16, 0.16):
        for y in (-0.08, 0.08):
            rh.tube([V(hx + x, hy + y, z + 0.38), V(hx + x * 1.3, hy + y * 1.4, z + 0.08)], [0.03, 0.025], seg=6)
    horse = part('rocking_horse', 'wood_light', rh)
    rk = Shape()
    for y in (-0.12, 0.12):
        pts = [V(hx + 0.4 * math.sin(t), hy + y, z + 0.06 + 0.08 * (1 - math.cos(t))) for t in (-0.9, -0.45, 0, 0.45, 0.9)]
        rk.tube(pts, [0.03] * 5, seg=6)
    deco(horse, 'cloth_red', rk)
    deco(horse, 'wood_dark', Shape().box((hx - 0.24, hy - 0.025, z + 0.66), (hx - 0.12, hy + 0.025, z + 0.78), 0.01))
    deco(horse, 'cloth_blue', Shape().box((hx - 0.07, hy - 0.11, z + 0.5), (hx + 0.11, hy + 0.11, z + 0.54), 0.01))
    scr(horse, V(hx + 0.02, hy, z + 0.53))
    ball = part('ball', 'cloth_red', Shape().blob(V(-1.65, 1.6, z + 0.17), (0.17, 0.17, 0.17), seg=14, rings=8), min_cx=0.3)
    deco(ball, 'linen', Shape().blob(V(-1.65, 1.6, z + 0.17), (0.172, 0.172, 0.05), seg=14, rings=4))
    scr(ball, V(-1.65, 1.6, z + 0.34))
    deco(horse, 'cloth_green', toys)
    rug = part('kids_rug', 'cloth_green', Shape().box((-1.2, -1.45, z - 0.004), (-0.42, -0.85, z + 0.03), 0.01), min_cx=0.5)
    top_screws(rug, ((-0.81, -1.15),), z + 0.03)


def study(z, fl):
    dk = Shape().box((0.85, -1.55, z + 0.44), (1.95, -1.05, z + 0.5), 0.012)
    dk.box((1.5, -1.53, z - 0.012), (1.93, -1.07, z + 0.45), 0.015)
    for y in (-1.5, -1.1):
        dk.box((0.88, y - 0.03, z - 0.012), (0.94, y + 0.03, z + 0.45), 0.006)
    desk = part('desk', 'wood_dark', dk)
    deco(desk, 'wood', Shape().box((1.55, -1.06, z + 0.06), (1.88, -1.04, z + 0.2), 0.0).box((1.55, -1.06, z + 0.25), (1.88, -1.04, z + 0.39), 0.0))
    deco(desk, 'candle', Shape().cyl(V(1.83, -1.42, z + 0.57), 0.035, 0.14, seg=8))
    deco(desk, 'flame', Shape().blob(V(1.83, -1.42, z + 0.68), (0.025, 0.025, 0.045), seg=6, rings=4))
    deco(desk, 'iron', Shape().cyl(V(1.0, -1.42, z + 0.53), 0.04, 0.06, seg=8))
    scr(desk, V(1.78, -1.15, z + 0.5))
    anchor(fl[1], V(1.71, -1.3, z))
    book = Shape().box((1.08, -1.4, z + 0.49), (1.48, -1.12, z + 0.53), 0.01)
    bp = part('book', 'book_a', book, min_cx=0.2)
    deco(bp, 'paper', Shape().box((1.1, -1.385, z + 0.53), (1.46, -1.135, z + 0.55), 0.008))
    deco(bp, 'book_a', Shape().box((1.27, -1.38, z + 0.549), (1.29, -1.15, z + 0.553), 0.0))
    scr(bp, V(1.16, -1.26, z + 0.55))
    chs = Shape().box((1.1, -0.95, z + 0.24), (1.45, -0.6, z + 0.29), 0.012)
    for x in (1.13, 1.42):
        for y in (-0.92, -0.63):
            chs.box((x - 0.025, y - 0.025, z - 0.012), (x + 0.025, y + 0.025, z + 0.25), 0.005)
    chs.box((1.1, -0.65, z + 0.28), (1.45, -0.6, z + 0.7), 0.01)
    chair = part('chair', 'wood', chs, min_cx=0.3)
    scr(chair, V(1.27, -0.8, z + 0.29))
    shelf = part('bookshelf', 'wood_dark', Shape().box((1.88, -0.25, z - 0.012), (2.25, 1.1, z + 0.08), 0.012)
                 .box((2.18, -0.25, z), (2.25, 1.1, z + 1.12), 0.012).box((1.88, -0.25, z), (2.25, -0.18, z + 1.12), 0.012)
                 .box((1.88, 1.03, z), (2.25, 1.1, z + 1.12), 0.012).box((1.88, -0.25, z + 1.06), (2.25, 1.1, z + 1.14), 0.012)
                 .box((1.88, -0.2, z + 0.42), (2.2, 1.05, z + 0.46), 0.006).box((1.88, -0.2, z + 0.78), (2.2, 1.05, z + 0.82), 0.006))
    books = {m: Shape() for m in ('book_a', 'book_b', 'book_c', 'paper')}
    for zz in (z + 0.08, z + 0.46, z + 0.82):
        y = -0.16
        i = 0
        while y < 0.98:
            t = RND.uniform(0.04, 0.08)
            hgt = RND.uniform(0.22, 0.31)
            books[('book_a', 'book_b', 'book_c', 'paper')[(i * 7 + int(zz * 10)) % 4]].box((1.93, y, zz), (2.18, y + t - 0.005, zz + hgt), 0.004)
            y += t
            i += 1
    for m, s in books.items():
        deco(shelf, m, s)
    top_screws(shelf, ((2.06, 0.1), (2.06, 0.75)), z + 1.14)
    anchor(fl[1], V(2.06, 0.43, z))
    lc = Shape().cyl(V(0.3, -0.55, z + 0.4), 0.05, 0.82, seg=8).cyl(V(0.3, -0.55, z + 0.02), 0.2, 0.05, seg=12)
    lc.box((-0.25, -0.18, -0.03), (0.25, 0.18, 0.03), 0.01, frame(V(0.3, -0.55, z + 0.84), V(1, 0, 0), V(0, math.cos(0.4), math.sin(0.4)), V(0, -math.sin(0.4), math.cos(0.4))))
    lect = part('lectern', 'wood', lc)
    big = Shape().box((-0.21, -0.15, 0.02), (0.21, 0.15, 0.07), 0.01, frame(V(0.3, -0.55, z + 0.84), V(1, 0, 0), V(0, math.cos(0.4), math.sin(0.4)), V(0, -math.sin(0.4), math.cos(0.4))))
    deco(lect, 'paper', big)
    scr(lect, V(0.3, -0.55, z + 0.84) + V(0, -math.sin(0.4), math.cos(0.4)) * 0.07, V(0, -math.sin(0.4), math.cos(0.4)))
    rug = part('study_rug', 'cloth_red', Shape().box((0.3, -0.1, z - 0.004), (1.5, 1.15, z + 0.03), 0.01), min_cx=0.6)
    deco(rug, 'wool', Shape().box((0.36, -0.04, z + 0.028), (1.44, 1.09, z + 0.033), 0.0))
    top_screws(rug, ((0.6, 0.2), (1.2, 0.85)), z + 0.03)


def attic(z, fl):
    barrel(-1.75, 0.95, z, 0.24, 0.5, 'attic_barrel', host=fl[0])
    barrel(-1.25, 1.45, z, 0.22, 0.46, 'attic_barrel', host=fl[0], min_cx=0.35)
    c1 = part('crate', 'wood_light', Shape().box((-2.05, -0.65, z - 0.012), (-1.45, -0.05, z + 0.5), 0.02))
    deco(c1, 'wood', Shape().box((-2.06, -0.66, z + 0.2), (-1.44, -0.04, z + 0.3), 0.01))
    anchor(fl[0], V(-1.75, -0.35, z))
    c2 = part('crate', 'wood_light', Shape().box((-1.95, -0.55, z + 0.488), (-1.55, -0.15, z + 0.85), 0.02))
    anchor(c1, V(-1.75, -0.35, z + 0.5))
    scr(c2, V(-1.75, -0.35, z + 0.85))
    for side in (-1, 1):
        scr(c1, V(-1.45, -0.35 + side * 0.27, z + 0.25), (1, 0, 0))
    c3 = part('crate', 'wood_light', Shape().box((-1.25, -0.7, z - 0.012), (-0.75, -0.2, z + 0.42), 0.02), min_cx=0.25)
    deco(c3, 'wood', Shape().box((-1.26, -0.71, z + 0.16), (-0.74, -0.19, z + 0.26), 0.01))
    scr(c3, V(-1.0, -0.45, z + 0.42))
    anchor(fl[0], V(-1.0, -0.45, z), min_cx=0.25)
    for k, (x, y) in enumerate(((-0.1, -0.4), (0.5, -0.45), (0.2, 0.15))):
        sk = Shape().blob(V(x, y, z + 0.22), (0.24, 0.2, 0.26), seg=14, rings=8,
                          shape=lambda v: Vector((v.x * (1 + 0.15 * max(0, -v.z)), v.y * (1 + 0.15 * max(0, -v.z)), v.z if v.z > -0.7 else -0.7 - (-0.7 - v.z) * 0.3)))
        sack = part('grain_sack', 'wool', sk, min_cx=0.2 * k)
        deco(sack, 'rope', Shape().cyl(V(x, y, z + 0.45), 0.08, 0.04, seg=10))
        scr(sack, V(x + 0.05, y, z + 0.47))
    hb = part('hay_bale', 'straw', Shape().box((0.85, 0.15, z - 0.012), (1.5, 0.95, z + 0.38), 0.04))
    deco(hb, 'rope', Shape().box((0.84, 0.35, z - 0.005), (1.51, 0.39, z + 0.39), 0.0).box((0.84, 0.71, z - 0.005), (1.51, 0.75, z + 0.39), 0.0))
    top_screws(hb, ((1.0, 0.55), (1.35, 0.55)), z + 0.38)
    anchor(fl[1], V(1.17, 0.55, z))
    chest(-0.35, 1.05, z, fl[0], 'old_trunk', along_x=True, w=0.66, d=0.4, h=0.3)
    herbs = Shape()
    hang = Shape()
    for i in range(5):
        x = -0.9 + i * 0.4
        hang.cyl(V(x, 0.35, ZR - 0.75), 0.008, 0.5, seg=4)
        herbs.blob(V(x, 0.35, ZR - 1.05), (0.06, 0.06, 0.12), seg=8, rings=5)
    hp = part('herb_pole', 'wood_dark', Shape().cyl(V(0, 0.35, ZR - 0.5), 0.04, 2.6, axis=(1, 0, 0), seg=8), min_cx=0.4)
    deco(hp, 'rope', hang)
    deco(hp, 'leaves', herbs)
    scr(hp, V(-1.1, 0.35, ZR - 0.5 + 0.04), UP, min_cx=0.4)


def house():
    pl = plinth()
    fl1, fl2, fl3 = floor(1), floor(2), floor(3)
    floors = [pl, fl1, fl2, fl3]
    # ground floor: stone, with the front door
    stone_face(0, 'front', windows=(1.0,), door=3.25, slots=((2.25, F[0] + 1.0), (4.35, F[0] + 0.55)))
    stone_face(0, 'back', windows=(1.25, 3.55), slots=((2.4, F[0] + 0.95), (2.4, F[0] + 0.38)))
    stone_face(0, 'left', windows=(1.25,), slots=((2.55, F[0] + 0.9), (3.2, F[0] + 0.5)))
    stone_face(0, 'right', windows=(2.35,), slots=((0.9, F[0] + 0.9),))
    # first and second floor: timber framed
    for k in (1, 2):
        timber_face(k, 'front', windows=(1.29, 3.51), mid_posts=(2.4,), flowers=True)
        timber_face(k, 'back', windows=(1.29, 3.51), mid_posts=(2.4,))
        timber_face(k, 'left', windows=(Face('left', k).len / 2,))
        timber_face(k, 'right', windows=(Face('right', k).len / 2,))
    gable('left')
    gable('right')
    roof()
    for k in (0, 1, 2):
        partition(k)
        stairs(k, floors[k][1])
    kitchen(F[0], pl)
    living_room(F[0], pl)
    bedroom(F[1], fl1)
    bathroom(F[1], fl1)
    kids_room(F[2], fl2)
    study(F[2], fl2)
    attic(F[3], fl3)


garden()
house()

bpy.context.view_layer.update()
os.makedirs(os.path.join(ROOT, 'games', 'unscrew', 'real'), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'blender', 'unscrew', 'house.blend'), compress=True)
K.export_glb(os.path.join(ROOT, 'games', 'unscrew', 'real', 'house.glb'))
parts = [o for o in bpy.data.objects if o.parent is None]
slots = [o for o in bpy.data.objects if o.name.startswith('screw')]
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print(f'house: built {len(parts)} parts, {len(slots)} screw slots, {tris} triangles')
