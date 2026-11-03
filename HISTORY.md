# History

A short diary of the project, newest day on top. Per day: what was done, what was decided, and what's next.

<!--
Template: copy this to the top for a new day

## YYYY-MM-DD

**Done**
-

**Decided**
-

**Next**
-
-->

## 2026-11-03

**Done**
- Added the first work-in-progress versions of four games, each as a single HTML file: **Jade Pavilion** (mahjong), **Nuts & Bolts** (nut sorting), **Outbound** (arrow puzzle) and **Unscrew** (3D take-apart, in Dutch).
- Restructured the repository for a mobile app:
  - every game in its own folder under `games/`, split into HTML, CSS and JS (code unchanged)
  - three.js and all fonts now ship with the games, so they work fully offline
  - `shared/` for what all games use: three.js, a small platform layer for the Android back button and vibration, the icon
- Added a hub start screen (`index.html`) linking all four games, each card in its game's own style.
- Tooling: `npm run dev` (also prints an address to play on the phone over Wi-Fi), `npm run build`, and `npm test` (automatic check of every game at phone size, including "no internet requests").
- GitHub: tests run on every push; a workflow can publish the browser version to GitHub Pages.
- Wrote the [mission](MISSION.md), [privacy policy](PRIVACY.md), [Android guide](docs/ANDROID.md), [architecture notes](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [naming notes](docs/NAMING.md), the [to-do list](TODO.md) and this history file.

**Decided**
- One app containing all games first; separate apps per game remain possible later (`npm run build -- --game <name>`).
- Package the app with Capacitor (Android first, iOS later).
- Keep three.js at r128 for the existing four games.
- "Honest Arcade" is a working title. The real name comes later ([docs/NAMING.md](docs/NAMING.md)).

**Next**
- Merge into `main`, turn on GitHub Pages, play everything on the phone.
- See [TODO.md](TODO.md).
