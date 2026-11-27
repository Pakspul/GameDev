# Unscrew: Blender + Claude for models

*As of 27 November 2026.* Blender is used in two ways for Unscrew:

- **Realism mode** (a trial, since 27 November 2026): finished models made in Blender go into the game as they are. It's a third view in the menu, next to 2D and 3D, and the [first section](#realism-mode-blender-models-in-the-game) below covers it. The first model is an owl. If it works out, realism may replace the 3D view.
- **As a sketchpad** for the code-built 3D models: see [Blender as a sketchpad](#blender-as-a-sketchpad-for-3d-models).

Claude can control Blender through MCP (Model Context Protocol) on your own computer, and it can also run Blender without a screen (the `bpy` Python module), for example in a cloud session. The owl was built that way. The MCP setup was done on the laptop, but Blender is too heavy for it, so the hand work continues on the desktop PC.

## Realism mode: Blender models in the game

### How it works

A model is a Blender scene that follows a few rules. The game loads it as a `.glb` file and turns it into a puzzle with the same code as every 3D model (`finalize()` in `game.js`):

| In Blender | In the game |
|---|---|
| A top-level object, one mesh with one material | A **part**: it falls off once its screws are out |
| An empty named `screw…` under a part, its arrow (local +Z) pointing out of the surface | A **screw slot**. Custom property `force = 1` makes it an anchor, always used when it's valid: put those under cover plates |
| A mesh named `…_proxy` under a part | The part's **collision shape**, which the screw rays test against. It must be closed. Without one, the part's own mesh is used |
| Any other mesh under a part | **Decoration**: it moves and falls with the part, but blocks nothing |
| Custom property `static = 1` on a part | The ground: it never falls and gets no screws |
| Custom property `minCx` (0 to 1.6) on a part, decoration or slot | Only from that difficulty on (the `cx` in `cfgFor()`), so harder levels show more detail |
| Material names | Palette keys: `real/real.js` can recolour them per level |

A model still changes from level to level. `finalize()` picks which slots get screws and what colour each screw is, and proves the level can be solved. Spare slots are fine: it drops the ones that are blocked, too close to something or facing down. `minCx` adds parts as the difficulty goes up. A palette is picked per level: the owl comes in tawny, snowy, grey and lavender.

Units are game units, and Blender's −Y is the front the camera starts at. Keep a model within about 10 × 10 units of ground and 8 high.

### Files

| File | What it is |
|---|---|
| `blender/unscrew/unscrew_kit.py` | Helpers for building models in Blender's Python: parts, screws, proxies, cover plates that follow a curved body, export. The rules above are in its header too. |
| `blender/unscrew/owl.py` | Builds the owl from scratch, saves `owl.blend` and exports `owl.glb`. |
| `blender/unscrew/owl.blend` | The owl as a Blender file: open it to shape it by hand. |
| `blender/unscrew/export.py` | Exports a `.blend` to `games/unscrew/real/<name>.glb`, with a few checks first. |
| `blender/unscrew/render.py` | Renders a preview from the game's starting camera angle, without opening Blender. |
| `games/unscrew/real/real.js` | The list of realism models (`REAL_MODELS`, with their palettes), loading, and the generator that turns a `.glb` into parts. |
| `games/unscrew/real/owl.glb` | The owl as the game loads it. |
| `shared/vendor/three/GLTFLoader.js` | three.js r128's glTF loader, unchanged. |

The `.glb` files load the first time someone picks realism, so 2D and 3D players never download them.

### Working on the owl by hand (desktop, with Blender MCP)

1. Open `blender/unscrew/owl.blend` in Blender and start the MCP server (see [Desktop setup](#desktop-setup)).
2. Shape it by hand, or ask Claude: *"Make the owl's wings bigger and give the stump more bark plates. Follow the rules in blender/unscrew/unscrew_kit.py."* Claude can import `unscrew_kit` over MCP and use its helpers (`plate`, `screw_on`, `anchor_under`, `scatter_screws`).
3. Save, then run `blender/unscrew/export.py` (Scripting tab, Run). From then on, `owl.blend` is the source. Running `owl.py` again would overwrite your hand work.
4. Check it: `node tests/unscrew.mjs`, then the inspector at `games/unscrew/index.html?models=real:owl` (`npm run dev`). Turn on *Unused slots* and *Dropped parts* to see which screws didn't count and which parts got no screw.

### Building with Blender's Python, without a screen

Blender also runs as a Python module, the way the owl was built in a cloud session:

```
python3 -m venv .blender-venv && .blender-venv/bin/pip install bpy==5.3.0   # needs Python 3.13, about 400 MB
.blender-venv/bin/python blender/unscrew/owl.py                             # owl.blend + games/unscrew/real/owl.glb
.blender-venv/bin/python blender/unscrew/render.py blender/unscrew/owl.blend owl.png 0
```

The last argument of `render.py` turns the camera around the model in degrees. Renders take about 5 seconds. Draco and meshopt compression aren't in the `bpy` package, so files from it are uncompressed.

### Adding a realism model

1. Build it with the helpers, as `owl.py` does, or by hand in Blender. Save it as `blender/unscrew/<name>.blend` and export it.
2. Add it at the end of `REAL_MODELS` in `games/unscrew/real/real.js`, with its category and palettes. Never reorder that list: the position decides which model each level shows.
3. Name it in `games/unscrew/strings.js` (`obj.<name>`, in every language).
4. Run `node tests/unscrew.mjs` and look at it in the inspector, at every difficulty.

### What makes a model play well

These come from the owl and from the checks in `finalize()`:

- **Cover plates hide screws only when they're thick enough.** A plate over a hidden screw must reach at least 0.125 above the surface, sit less than 0.02 below it, and stay that thick 0.15 to every side of the screw. `plate()` makes 0.16 thick plates with a full-thickness middle. Thin chevrons and the edges of rounded shapes don't count.
- **Screws facing down by more than about 17° are dropped**, and so are screws within 0.13 of another part. Put screws on the top and the sides.
- **One material per part.** Eyes, dots and stems are child objects (decoration).
- **More parts mean more screws.** A 3D model has about 120 screws on normal. The owl has about 50 on normal and 85 on expert, from 72 parts.
- **Check proxies are closed.** The screw rays count how often they cross a surface to know whether they start inside something. `tests/unscrew.mjs` checks every part's collision shape.

### Known limits and next steps

- **File size.** `owl.glb` is 1.3 MB and about 70,000 triangles. Mesh compression (meshopt or Draco, and a decoder in the game) would shrink it a lot.
- **Fewer screws than 3D models.** More feather plates and props would help, or more slots per part.
- **Look.** The game lights models with its own studio light and plain materials (`LOOK` in `game.js`), so a model looks flatter in the game than in a Blender render. Textures aren't used yet: export leaves out texture coordinates.

## Blender MCP setup

Done on the laptop on 23 November 2026:

- Blender 5.3.0 installed with winget.
- uv installed. It runs the MCP server.
- The community add-on [MCP for Blender](https://github.com/ahujasid/blender-mcp) installed and enabled in Blender.
- A `blender` MCP server added to Claude Code's user settings.
- Blender switched from Vulkan to OpenGL, because the Intel Iris Xe driver (March 2023) gave a black window.

Not tested yet: Claude actually controlling Blender. Laptop settings don't carry over, so the desktop needs the full setup below.

## Desktop setup

The quickest route is to install Blender yourself, then open Claude Code in this repo and say: *"Set up the Blender MCP connection from docs/UNSCREW-BLENDER.md."* Claude can do steps 2 to 5 for you. These are the steps if you do it yourself, in PowerShell:

1. Install Blender: `winget install --id BlenderFoundation.Blender -e`. Open it once and close it again, so it creates its settings folder.
2. Install uv: `winget install --id astral-sh.uv -e`. Then open a new terminal so `uvx` is on your PATH.
3. Install the add-on into Blender: `uvx mcp-for-blender install-addon`.
4. Register the server with Claude Code: `claude mcp add --scope user blender -- uvx mcp-for-blender`. Check it with `claude mcp get blender`.
5. In Blender, go to Edit > Preferences > Add-ons, search for *MCP*, and tick **Interface: MCP for Blender**.
6. In the 3D viewport, press **N**, open the **MCP for Blender** tab and click **Start MCP Server**. It listens on `localhost:9876`.
7. Restart VS Code, so Claude Code picks up the new server and the new PATH. In a new conversation, run `/mcp`. Blender should be listed with its tools.
8. First test: ask Claude to *"add a red cube to the Blender scene"*. If the cube appears, it works.

Save your Blender file before each session. The add-on runs any Python that Claude sends.

## Blender as a sketchpad for 3D models

Use Blender as a sketchpad, then have Claude rewrite the result as a generator in code. Unscrew loads no model files. Every model is a generator function in `games/unscrew/models/<category>.js`, built from the parts in [`kit.js`](../games/unscrew/models/kit.js) (`box`, `cyl`, `onFace`, `cladBox`, `win`, …). Each level builds a new seeded variant, with more detail as difficulty (`cx`) goes up. A mesh exported from Blender would lose its screw slots, its variation and its difficulty steps.

The workflow:

1. Pick an idea from the catalogue in [UNSCREW-MODELS.md](UNSCREW-MODELS.md) (for example the tractor, the owl or the log cabin).
2. Ask Claude to block it out in Blender from simple boxes and cylinders at Unscrew's scale: at most about 10 × 10 units of ground and 8 high. Name each object after the part it will become.
3. Shape it together: move, resize and recolour things by hand, or tell Claude what to change. Look at it from all sides.
4. Ask Claude to read the blockout over MCP (object names, sizes, positions, colours) and write `genName` with the kit's parts, following the [recipe](UNSCREW-MODELS.md#recipe-adding-a-model): the screw rules, the `cx` steps, and registering it in `order.js` and `strings.js`.
5. Check it in the game and the inspector the usual way. Blender only gives the proportions. Screws, cover plates and depth are designed in code.

A prompt to start with: *"Block out a tractor for Unscrew in Blender: big rear wheels, a cab, a trailer with hay bales, within 10 × 10 × 8. Use boxes and cylinders named after their parts."*

For a finished model instead of a sketch, see [Realism mode](#realism-mode-blender-models-in-the-game).

## Troubleshooting

| Problem | Fix |
|---|---|
| Blender's window stays black | It's usually the Vulkan backend on an old GPU driver. Start Blender with `--gpu-backend opengl`, or set Preferences > System > Backend to OpenGL. Updating the GPU driver is the better fix. |
| `uvx` not found | Open a new terminal or restart VS Code after installing uv. Or use the full path from `where uvx` in `claude mcp add`. |
| install-addon can't find the add-ons folder | Open Blender once first. Or set `BLENDERMCP_ADDONS_DIR` to `%APPDATA%\Blender Foundation\Blender\<version>\scripts\addons`. |
| `/mcp` shows Blender, but every tool call fails | Blender isn't running, or its server isn't started. Click **Start MCP Server** in the N panel (port 9876). |
| No Blender tools in Claude Code | MCP servers load when a session starts. Restart VS Code and start a new conversation. |
| `pip install bpy` finds no version | `bpy` only exists for one Python version per Blender release: 5.3 needs Python 3.13. |
| A realism model shows no screws on some parts | Open the inspector (`?models=real:<name>`) and turn on *Unused slots*. Usually the slots face down, sit too close to another part, or the cover over them is too thin. |
| You want to check scripts before they run | Add `BLENDER_MCP_SAFE_MODE=1` to the server: `claude mcp add --scope user blender -e BLENDER_MCP_SAFE_MODE=1 -- uvx mcp-for-blender` (remove the old one first with `claude mcp remove blender -s user`). |

There's also an official Blender Lab add-on, the one behind Anthropic's Blender connector. It installs from [blender.org/lab/mcp-server](https://www.blender.org/lab/mcp-server/), but there are no documented setup steps for it in Claude Code, so this doc uses the community add-on.

## Sources

- [MCP for Blender README](https://github.com/ahujasid/blender-mcp)
- [Using the Blender connector in Claude](https://academy.claude.com/tutorials/using-the-blender-connector-in-claude)
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)
