"""Export an Unscrew realism model from its .blend to the game, after you've shaped it by hand.

In Blender: open the model's .blend, open this file in the Scripting tab and press Run. It writes
games/unscrew/real/<name>.glb, where <name> is the .blend's file name (owl.blend -> owl.glb).
Headless:  python blender/unscrew/export.py blender/unscrew/owl.blend   (with the bpy module installed)

Then run `node tests/unscrew.mjs`, which checks the rules (unscrew_kit.py has them), and look at the model in
the inspector: games/unscrew/index.html?models=real:owl with `npm run dev`.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unscrew_kit as K  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [a for a in sys.argv[1:] if a.endswith('.blend')]
if args:
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args[0]))
src = bpy.data.filepath
if not src:
    raise SystemExit('Save the .blend first: the model is named after its file.')
name = os.path.splitext(os.path.basename(src))[0]

# The checks Blender can do itself; tests/unscrew.mjs checks the exported file as well.
problems = []
for o in bpy.context.scene.objects:
    if o.parent is not None:
        continue
    if o.type != 'MESH':
        problems.append(f'"{o.name}" is at the top level but isn\'t a mesh, so it can\'t be a part')
        continue
    if len(o.data.materials) > 1:
        problems.append(f'part "{o.name}" has {len(o.data.materials)} materials: a part has one (make the rest child objects)')
    if not o.get('static') and not any(c.name.startswith('screw') for c in o.children):
        problems.append(f'part "{o.name}" has no screw empties, so the game would drop it')
for p in problems:
    print('!', p)

out = os.path.join(ROOT, 'games', 'unscrew', 'real', name + '.glb')
K.export_glb(out)
print(f'{name}: exported to {out}' + (f' with {len(problems)} problem(s)' if problems else ''))
