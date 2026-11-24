# Notes for Claude

## Where knowledge goes

- Keep all project knowledge in this repo. Don't use Claude's local memory: the user works on more than one computer, and only the repo travels.
- Notes, guides and plans go in [docs/](docs/) as markdown, named `UPPERCASE-NAME.md` like the existing ones. Don't create Claude Docs documents or other files outside the repo.
- Overview of the games and the code: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Blender for Unscrew models

Claude can control Blender through MCP to sketch Unscrew models, which are then written as generators in `games/unscrew/models/`. The setup has to be done on each computer. Steps, workflow and troubleshooting are in [docs/UNSCREW-BLENDER.md](docs/UNSCREW-BLENDER.md).
