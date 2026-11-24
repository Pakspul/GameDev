# Unscrew: Blender + Claude for models

*As of 23 November 2026.* Claude can control Blender through MCP (Model Context Protocol), so you can sketch Unscrew models in Blender together. Setup was done on the laptop, but Blender is too heavy for it, so this continues on the desktop PC.

## Where things stand

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

## Making models for Unscrew

Use Blender as a sketchpad, then have Claude rewrite the result as a generator in code. Unscrew loads no model files. Every model is a generator function in `games/unscrew/models/<category>.js`, built from the parts in [`kit.js`](../games/unscrew/models/kit.js) (`box`, `cyl`, `onFace`, `cladBox`, `win`, …). Each level builds a new seeded variant, with more detail as difficulty (`cx`) goes up. A mesh exported from Blender would lose its screw slots, its variation and its difficulty steps.

The workflow:

1. Pick an idea from the catalogue in [UNSCREW-MODELS.md](UNSCREW-MODELS.md) (for example the tractor, the owl or the log cabin).
2. Ask Claude to block it out in Blender from simple boxes and cylinders at Unscrew's scale: at most about 10 × 10 units of ground and 8 high. Name each object after the part it will become.
3. Shape it together: move, resize and recolour things by hand, or tell Claude what to change. Look at it from all sides.
4. Ask Claude to read the blockout over MCP (object names, sizes, positions, colours) and write `genName` with the kit's parts, following the [recipe](UNSCREW-MODELS.md#recipe-adding-a-model): the screw rules, the `cx` steps, and registering it in `order.js` and `strings.js`.
5. Check it in the game and the inspector the usual way. Blender only gives the proportions. Screws, cover plates and depth are designed in code.

A prompt to start with: *"Block out a tractor for Unscrew in Blender: big rear wheels, a cab, a trailer with hay bales, within 10 × 10 × 8. Use boxes and cylinders named after their parts."*

Open question: an importer (glTF parts with empties as screw slots) would let finished Blender models into the game directly. It would be a big change, and those models wouldn't vary per level.

## Troubleshooting

| Problem | Fix |
|---|---|
| Blender's window stays black | It's usually the Vulkan backend on an old GPU driver. Start Blender with `--gpu-backend opengl`, or set Preferences > System > Backend to OpenGL. Updating the GPU driver is the better fix. |
| `uvx` not found | Open a new terminal or restart VS Code after installing uv. Or use the full path from `where uvx` in `claude mcp add`. |
| install-addon can't find the add-ons folder | Open Blender once first. Or set `BLENDERMCP_ADDONS_DIR` to `%APPDATA%\Blender Foundation\Blender\<version>\scripts\addons`. |
| `/mcp` shows Blender, but every tool call fails | Blender isn't running, or its server isn't started. Click **Start MCP Server** in the N panel (port 9876). |
| No Blender tools in Claude Code | MCP servers load when a session starts. Restart VS Code and start a new conversation. |
| You want to check scripts before they run | Add `BLENDER_MCP_SAFE_MODE=1` to the server: `claude mcp add --scope user blender -e BLENDER_MCP_SAFE_MODE=1 -- uvx mcp-for-blender` (remove the old one first with `claude mcp remove blender -s user`). |

There's also an official Blender Lab add-on, the one behind Anthropic's Blender connector. It installs from [blender.org/lab/mcp-server](https://www.blender.org/lab/mcp-server/), but there are no documented setup steps for it in Claude Code, so this doc uses the community add-on.

## Sources

- [MCP for Blender README](https://github.com/ahujasid/blender-mcp)
- [Using the Blender connector in Claude](https://academy.claude.com/tutorials/using-the-blender-connector-in-claude)
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)
