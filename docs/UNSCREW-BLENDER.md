# Unscrew: Blender + Claude for models

*As of 27 November 2026.* Blender is used in two ways for Unscrew:

- **Realism mode** (a trial, since 27 November 2026): finished models made in Blender go into the game as they are. It's a third view in the menu, next to 2D and 3D, and the [first section](#realism-mode-blender-models-in-the-game) below covers it. The models are an owl and a [medieval house](#the-medieval-house) with hundreds of screws. If it works out, realism may replace the 3D view.
- **As a sketchpad** for the code-built 3D models: see [Blender as a sketchpad](#blender-as-a-sketchpad-for-3d-models).

Claude can control Blender through MCP (Model Context Protocol) on your own computer, and it can also run Blender without a screen (the `bpy` Python module), for example in a cloud session. The owl and the house were built that way. The MCP setup was done on the laptop, but Blender is too heavy for it, so the hand work continues on the desktop PC.

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

A model still changes from level to level. `finalize()` picks which slots get screws and what colour each screw is, and proves the level can be solved. Spare slots are fine: it drops the ones that are blocked, too close to something or facing down. `minCx` adds parts as the difficulty goes up. A palette is picked per level: the owl comes in tawny, snowy, grey and lavender, the house with white, ochre, pink or blue plaster, red tiles or slate, and an autumn tree.

Units are game units, and Blender's −Y is the front the camera starts at. Keep a model within about 10 × 10 units of ground and 8 high.

### Files

| File | What it is |
|---|---|
| `blender/unscrew/unscrew_kit.py` | Helpers for building models in Blender's Python: parts, screws, proxies, cover plates that follow a curved body, `Shape` (boxes, cylinders, prisms and blobs merged into one mesh, for hard-surface models like the house), export. The rules above are in its header too. |
| `blender/unscrew/owl.py` | Builds the owl from scratch, saves `owl.blend` and exports `owl.glb`. |
| `blender/unscrew/owl.blend` | The owl as a Blender file: open it to shape it by hand. |
| `blender/unscrew/house.py`, `house.blend` | The medieval house: the build script and its Blender file. |
| `blender/unscrew/export.py` | Exports a `.blend` to `games/unscrew/real/<name>.glb`, with a few checks first. |
| `blender/unscrew/render.py` | Renders a preview from the game's starting camera angle, without opening Blender. |
| `games/unscrew/real/real.js` | The list of realism models (`REAL_MODELS`, with their palettes), loading, and the generator that turns a `.glb` into parts. |
| `games/unscrew/real/owl.glb`, `house.glb` | The models as the game loads them. |
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
2. Add it at the end of `REAL_MODELS` in `games/unscrew/real/real.js`, with its category and palettes. Never reorder that list: the position decides which model each level shows. A big model can set `capMul`: the difficulty's cap on screws (`cap` in `cfgFor()`) is multiplied by it.
3. Name it in `games/unscrew/strings.js` (`obj.<name>`, in every language).
4. Run `node tests/unscrew.mjs` and look at it in the inspector, at every difficulty.
5. Run `npm run unscrew:models -- real:<name> --drops`: screws per level, the share of parts kept (aim for 97% or more), the slowest build, and every dropped part.

### What makes a model play well

These come from the owl and from the checks in `finalize()`:

- **Cover plates hide screws only when they're thick enough.** A plate over a hidden screw must reach at least 0.125 above the surface, sit less than 0.02 below it, and stay that thick 0.15 to every side of the screw. `plate()` makes 0.16 thick plates with a full-thickness middle. Thin chevrons and the edges of rounded shapes don't count.
- **Screws facing down by more than about 17° are dropped**, and so are screws within 0.13 of another part. Put screws on the top and the sides.
- **One material per part.** Eyes, dots and stems are child objects (decoration).
- **More parts mean more screws.** A 3D model has about 120 screws on normal. The owl has about 50 on normal and 85 on expert, from 72 parts. The house has 300 parts and 400 to 500 screws.
- **Screws need room from each other.** `finalize()` skips a screw within 0.52 of a chosen one on the same plane (0.42 when they face different ways, so two screws back to back on a thin wall clash). A part whose every slot clashes gets no screw and is dropped. Space a part's own screws 0.55 apart, and keep them 0.55 from the neighbours' screws.
- **Leave 0.15 around a screw clear of overhangs.** The check casts five rays: from the screw and from 0.15 to each side. A ray that starts inside an overhang (a floor that juts out, the eaves, a window sill) or within 0.13 of one drops the slot. On the house that meant moving the beam screws down and raising the eaves.
- **Don't let two parts wait for each other.** A screw is free when nothing is in front of it, however far away. If a garden part's screws face the house and the house's screws face it, neither comes off first and `finalize()` drops one. Point screws away from what's beside them: the tree's crown has no screws on the side facing the house.
- **Parts made of several pieces:** let the pieces overlap a little rather than touch face to face, so the screw rays count crossings right (see `Shape` in `unscrew_kit.py`).
- **Check proxies are closed.** The screw rays count how often they cross a surface to know whether they start inside something. `tests/unscrew.mjs` checks every part's collision shape.

### The medieval house

`house.py` builds a timber-framed house on a garden plot, with no hand work yet, so running it again is safe. It's the big puzzle of realism mode: about 300 parts and 570 screw slots, so 390 to 430 screws on easy and up to 500 on expert. `capMul: 10` in `real.js` lifts the usual cap of 80 to 240 screws, so the model decides. Nothing is hard about it: there are always lots of free screws, it just takes a while.

- **Outside:** a stone ground floor with the front door, two timber-framed storeys that jut out over the one below, and gables. Posts, window frames, shutters, flower boxes and the door hide the screws of the walls behind them.
- **The roof:** rows of pantiles hide the screws of the roof boards, then the ridge, the chimney and its cap.
- **Inside, from the bottom:** a kitchen (hearth with a fire, a cauldron and a hood, a table with benches and bread, a dresser with plates, a barrel, a basket of apples) and a living room (armchair with a cushion, a rug, a round table with a candle, a chest, a spinning wheel); a bedroom (double bed with blanket and pillows, nightstand, wardrobe, chest, rug) and a bathroom (a wooden tub under a bucket shower, a washstand with a basin, a privy); a children's room (two beds, a toy chest, a rocking horse, a ball) and a study (desk with a book, chair, bookshelf, lectern); a loft under the roof (crates, barrels, grain sacks, a hay bale, an old trunk, drying herbs). Steep stairs turn on every floor, under a trapdoor.
- **How it comes apart:** furniture stands on the floor boards and hides their screws, and the floor above blocks the furniture's screws, so every storey empties from the top down: tiles, roof boards, loft, attic floor, and so on. A pillow comes off before its blanket, the blanket before the bed.
- **The garden:** a picket fence with a gate, flagstones, a well with a roof and a bucket, a vegetable bed with cabbages and pumpkins, an apple tree with a swing, a woodpile with a chopping block, a hen house and two hens, a wheelbarrow, a water butt, flower pots and stones.

`minCx` keeps a few details (apples, pumpkins, a rug, the herb pole, some crown clumps) for the harder levels. The materials are palette keys, so the plaster, timber, shutters, roof and the tree can change colour per level.

### Realism screws

Realism mode has its own screw (`SGR` in `game.js`): a domed head with a deep Phillips recess, and a threaded steel shank that shows while it turns out. Head and recess are one mesh. Its vertex colours darken the recess towards the bottom and dim the reflections there too (`dimSpecular`), standing in for the shadow inside. The 2D and 3D views keep their flat, cartoon screw.

Two fingers (or the right mouse button, or shift and drag) move the view across the model, which the house needs once you zoom in. The view button brings it back to the middle.

### Known limits and next steps

- **File size.** `owl.glb` is 1.3 MB and about 70,000 triangles; `house.glb` is 3.8 MB and about 76,000 triangles, mostly because flat-shaded boxes need their own vertices per face. Mesh compression (meshopt or Draco, and a decoder in the game) would shrink both a lot. Both load the first time someone picks realism.
- **Drawing the house is heavy.** With every screw in place it's about 1,950 draw calls and 700,000 triangles a frame (shadows included), against about 400 for the owl. Untested on a slow phone. Helpers if it stutters: draw only when something changes (the game draws every frame now), drop the screws' shadows, or merge each part's decoration into fewer meshes.
- **Progress within a level isn't saved.** A house level takes a while; leaving the game halfway starts the level over.
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
