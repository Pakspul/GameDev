"""Helpers for building Unscrew "realism" models in Blender (docs/UNSCREW-BLENDER.md).

A model is a .blend scene that follows a few rules, so the game can turn it into a puzzle:

  * Every top-level object is one PART: it falls off once its screws are out. A part is one mesh with one material.
  * Children of a part:
      - an empty whose name starts with "screw" is a SCREW SLOT. Its arrow (local +Z) points out of the surface.
        Custom property force=1 makes it an anchor: always used when it's valid (put these under cover plates).
      - a mesh whose name ends in "_proxy" is the part's COLLISION SHAPE for the screw rays. It must be closed
        (watertight). Without one, the part's own mesh is used, so small parts don't need one.
      - any other mesh is DECORATION that moves and falls with the part (eyes, dots, bark lines).
  * Custom properties on a part: static=1 (never falls, has no screws: the ground), minCx=0.6 (only from that
    difficulty on; 0 to 1.6, see cfgFor in game.js). minCx also works on decoration.
  * Material names are palette keys: games/unscrew/real/real.js can recolour them per level.
  * Units are game units; Blender's -Y is the front the camera starts at. Keep within about 10 x 10 x 8.

These helpers are plain bpy, so they run in Blender's own Python console, through Blender MCP, or headless
with the bpy module. Blender itself checks nothing: games/unscrew/real/real.js and the model inspector do.
"""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix

UP = Vector((0, 0, 1))


# ----- scene -----
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc


def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def evaluated(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    return obj.evaluated_get(dg)


# ----- materials -----
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


_MATS = {}


def mat(name, hex_color, rough=0.55, metal=0.0):
    """One material per palette key. Blender stores linear colour; the hex is sRGB, like the game's palettes."""
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    h = hex_color.lstrip('#')
    rgb = [srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)]
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*rgb, 1)
    _MATS[name] = m
    return m


def set_mat(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj


# ----- mesh building -----
def mesh_obj(name, bm, material=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    obj = bpy.data.objects.new(name, me)
    link(obj)
    if material:
        set_mat(obj, material)
    return obj


def ellipsoid(name, center, radii, material, seg=20, rings=10, shape=None, subsurf=1):
    """A smooth blob: a UV sphere scaled to radii, optionally reshaped per vertex by shape(v) -> v (local, unit sphere)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1)
    for v in bm.verts:
        p = v.co.copy()
        if shape:
            p = shape(p)
        v.co = Vector((p.x * radii[0], p.y * radii[1], p.z * radii[2]))
    obj = mesh_obj(name, bm, material)
    obj.location = center
    if subsurf:
        sub = obj.modifiers.new('smooth', 'SUBSURF')
        sub.levels = subsurf
        sub.render_levels = subsurf
    return obj


def lathe(name, profile, material, seg=32, center=(0, 0, 0), subsurf=1, cap=True, ripple=None):
    """Revolve profile [(r, z), ...] (bottom to top) around Z. Closed when cap is set.
    ripple(a, z) -> factor on the radius, for bark ridges and lumpy rims."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            rr = r * (ripple(a, z) if ripple else 1)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_obj(name, bm, material)
    obj.location = center
    if subsurf:
        sub = obj.modifiers.new('smooth', 'SUBSURF')
        sub.levels = subsurf
        sub.render_levels = subsurf
    return obj


def tube(name, points, radii, material, seg=12, subsurf=1):
    """A closed tube along points with a radius per point (branches, roots, toes, ear tufts)."""
    return tubes(name, [(points, radii)], material, seg, subsurf)


def tubes(name, strands, material, seg=12, subsurf=1):
    """Several closed tubes in one mesh: [(points, radii), ...]."""
    bm = bmesh.new()
    for points, radii in strands:
        _tube(bm, points, radii, seg)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_obj(name, bm, material)
    if subsurf:
        sub = obj.modifiers.new('smooth', 'SUBSURF')
        sub.levels = subsurf
        sub.render_levels = subsurf
    return obj


def _tube(bm, points, radii, seg):
    pts = [Vector(p) for p in points]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = t.orthogonal().normalized()
        b = t.cross(a).normalized()
        r = radii[i]
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * r)
                      for k in range(seg)])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((ra[k], ra[(k + 1) % seg], rb[(k + 1) % seg], rb[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


# Outlines for plates: f(u, v) maps the unit square [-1,1]^2 to the shape, in plate units (x across, y up).
def disc(w, h):
    def f(u, v):
        return u * math.sqrt(max(0, 1 - v * v / 2)) * w / 2, v * math.sqrt(max(0, 1 - u * u / 2)) * h / 2
    return f


def scale_shape(w, h, tip=0.25):
    """A feather scale: round at the bottom, narrowing to a soft point at the top (tip down if h < 0)."""
    def f(u, v):
        x, y = u * math.sqrt(max(0, 1 - v * v / 2)), v * math.sqrt(max(0, 1 - u * u / 2))
        k = 1 - (1 - tip) * max(0, y) ** 1.6
        return x * k * w / 2, y * h / 2
    return f


def chevron(w, t, depth):
    """A V-shaped band (an owl's chest mark): w across, t thick, its ends depth higher than its middle, which is at 0."""
    def f(u, v):
        x = u * w / 2
        return x, v * t / 2 + depth * abs(u) ** 1.4
    return f


def leaf_shape(w, h):
    def f(u, v):
        x, y = u * math.sqrt(max(0, 1 - v * v / 2)), v * math.sqrt(max(0, 1 - u * u / 2))
        return x * (1 - 0.94 * y * y) ** 0.6 * w / 2, y * h / 2
    return f


def frame_at(point, normal, up=UP):
    """Rotation whose +Z is normal and whose +Y leans towards up."""
    n = Vector(normal).normalized()
    y = (Vector(up) - n * n.dot(up))
    if y.length < 1e-4:
        y = n.orthogonal()
    y.normalize()
    x = y.cross(n)
    return Matrix((x, y, n)).transposed().to_4x4()


def plate(name, outline, material, point, normal, target=None, thick=0.16, sink=0.012, grid=None, up=UP):
    """A cover plate of the given outline: a soft-edged pillow lying on target (each point dropped onto its surface,
    so it follows a curved body) or flat. It reaches sink below the surface and thick above it, so a screw under its
    middle counts as hidden (the game wants a cover at least 0.125 thick over a hidden screw, and its underside
    less than 0.02 below the host's surface, or the screw under it isn't drawn as hidden). Top and bottom meet
    at the rim, so the shape is closed, as a collision shape must be."""
    n0 = Vector(normal).normalized()
    fr = frame_at(point, n0, up)
    ax, ay = Vector(fr.col[0][:3]), Vector(fr.col[1][:3])
    P = Vector(point)
    ev = evaluated(target) if target is not None else None
    tinv = target.matrix_world.inverted() if target is not None else None
    size = max(max(abs(outline(u, v)[0]), abs(outline(u, v)[1])) for u in (-1, 0, 1) for v in (-1, 0, 1))
    N = grid or (8 if size < 0.35 else 10 if size < 0.7 else 14)  # finer grids only where a plate is big enough to curve
    surf, edge = {}, {}
    for i in range(N + 1):
        for j in range(N + 1):
            u, v = 2 * i / N - 1, 2 * j / N - 1
            x, y = outline(u, v)
            q = P + ax * x + ay * y
            if ev is not None:
                ok, loc, _, _ = ev.closest_point_on_mesh(tinv @ (q + n0 * 0.02))
                if ok:
                    q = target.matrix_world @ loc
            surf[i, j] = q
            edge[i, j] = max(abs(u), abs(v))
    # normals of the dropped surface itself, so the plate's thickness follows its own curve
    def nrm(i, j):
        a = surf[min(i + 1, N), j] - surf[max(i - 1, 0), j]
        b = surf[i, min(j + 1, N)] - surf[i, max(j - 1, 0)]
        c = a.cross(b)
        if c.length < 1e-9:
            return n0
        c.normalize()
        return c if c.dot(n0) > 0 else -c
    bm = bmesh.new()
    inv = (Matrix.Translation(P) @ fr).inverted()
    rot = inv.to_3x3()
    top, bot, out = {}, {}, {}
    for (i, j), q in surf.items():
        k = (1 - edge[i, j] ** 8) ** 0.25  # full thickness almost to the rim: the game tests covers 0.15 off-centre too
        nn = nrm(i, j)
        out[i, j] = rot @ nn
        if edge[i, j] >= 1:
            top[i, j] = bot[i, j] = bm.verts.new(inv @ (q - nn * sink))
        else:
            top[i, j] = bm.verts.new(inv @ (q + nn * (-sink + (thick + sink) * k)))
            bot[i, j] = bm.verts.new(inv @ (q - nn * sink))

    # Each face is wound so its normal points away from the plate: out on top, in underneath.
    # (Blender's recalc_face_normals gets confused by the rim where top and bottom meet.)
    def face(vs, want):
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.dot(want) < 0:
            f.normal_flip()
    for i in range(N):
        for j in range(N):
            w = out[i, j] + out[i + 1, j] + out[i + 1, j + 1] + out[i, j + 1]
            face((top[i, j], top[i + 1, j], top[i + 1, j + 1], top[i, j + 1]), w)
            face((bot[i, j], bot[i + 1, j], bot[i + 1, j + 1], bot[i, j + 1]), -w)
    obj = mesh_obj(name, bm, material)
    obj.matrix_world = Matrix.Translation(P) @ fr
    return obj


# ----- the Unscrew rules -----
def part(obj, static=False, min_cx=0.0):
    if static:
        obj['static'] = 1
    if min_cx:
        obj['minCx'] = round(min_cx, 2)
    return obj


def decor(obj, parent, min_cx=0.0):
    link_parent(obj, parent)
    if min_cx:
        obj['minCx'] = round(min_cx, 2)
    return obj


def link_parent(obj, parent):
    bpy.context.view_layer.update()  # matrix_world is stale right after setting location or rotation
    mw = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    obj.matrix_world = mw
    return obj


def proxy(obj, subsurf=0):
    """A collision shape for obj: a linked copy of its mesh (so editing the shape updates both) with less smoothing."""
    pr = bpy.data.objects.new(obj.name + '_proxy', obj.data)
    link(pr)
    pr.matrix_world = obj.matrix_world.copy()
    link_parent(pr, obj)
    if subsurf:
        sub = pr.modifiers.new('smooth', 'SUBSURF')
        sub.levels = subsurf
    pr.display_type = 'WIRE'
    pr.hide_render = True
    return pr


def hit(obj, origin, direction):
    """Ray onto obj's final shape (modifiers included), in world space: (point, normal) or None."""
    ev = evaluated(obj)
    mi = obj.matrix_world.inverted()
    o = mi @ Vector(origin)
    d = (mi.to_3x3() @ Vector(direction)).normalized()
    ok, loc, nrm, _ = ev.ray_cast(o, d)
    if not ok:
        return None
    n = (obj.matrix_world.to_3x3().inverted().transposed() @ nrm).normalized()
    if n.dot(Vector(direction)) > 0:
        n = -n  # a ray from outside meets the outside: never trust a flipped face
    return obj.matrix_world @ loc, n


def screw(obj, point, normal, force=False, name='screw'):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'SINGLE_ARROW'
    e.empty_display_size = 0.35
    link(e)
    e.matrix_world = Matrix.Translation(Vector(point)) @ frame_at(point, normal)
    link_parent(e, obj)
    if force:
        e['force'] = 1
    return e


def screw_on(obj, near, direction, force=False):
    """A screw on obj's surface where a ray along -direction from near (pushed outwards) meets it."""
    d = Vector(direction).normalized()
    h = hit(obj, Vector(near) + d * 3, -d)
    if h is None:
        return None
    return screw(obj, h[0], h[1], force)


def anchor_under(cover, host, point, normal):
    """The hidden screw a cover plate hides: on host, right under the cover's point."""
    return screw_on(host, point, normal, force=True)


def scatter_screws(obj, center, n=60, spacing=0.75, keep=lambda p, nrm: True, min_nz=-0.25):
    """Screw slots spread over a round part: rays from all around towards center. The game drops the ones that are
    blocked or too close to something, and hides the ones under a cover plate."""
    c = Vector(center)
    out = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        d = Vector((math.cos(golden * i) * r, math.sin(golden * i) * r, z))
        h = hit(obj, c + d * 10, -d)
        if h is None:
            continue
        p, nrm = h
        if nrm.z < min_nz or not keep(p, nrm) or any((p - q).length < spacing for q in out):
            continue
        out.append(p)
        screw(obj, p, nrm)
    return out


# ----- export -----
def export_glb(path):
    """Export the scene for the game: modifiers applied, custom properties as extras, Y up."""
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_extras=True, export_apply=True,
                              export_yup=True, export_texcoords=False, export_normals=True,
                              export_materials='EXPORT', export_cameras=False, export_lights=False,
                              export_animations=False, export_skins=False, export_morph=False)
