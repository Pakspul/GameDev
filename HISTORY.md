# History

A short diary of the project, newest day on top. Per day: what was done, what was decided, and what's next.

<!--
Template: copy this to the top for a new day

## YYYY-MM-DD

**Done**
-

**Decided**
- Camper Crew is the action game to try first. The prototype uses three.js r128 like the other games, so it needs no build step for now.
-

**Next**
- Playtest Camper Crew on the phone: is it fun? Tune or cut before adding art.
-
-->

## 2026-11-04

**Done**
- Wrote a release guide ([docs/RELEASE.md](docs/RELEASE.md)): one table per platform with every step, who can do it (you, Claude, testers, the store), its state and a remark, followed by the details per step.
- Listed the issues found along the way under **Release issues** in [TODO.md](TODO.md): four games without a way back to the hub, Outbound's direct `navigator.vibrate`, progress only in `localStorage`, and an out-of-date privacy policy.

**Decided**
- **Android first.** The iPhone release is on hold: it needs a Mac and US$99 per year. Its code fixes (release issues 1–3) are free and help Android too.

**Next**
- Create the Google Play account and find 12 testers; both take time.
- Choose the app ID, then let Claude add Capacitor.

## 2026-11-03

**Done**
- Wrote a game backlog ([docs/BACKLOG.md](docs/BACKLOG.md)): ten puzzle games, and three concepts for a chaotic single-player action game.
- Built a grey-box prototype of **Camper Crew**, the chosen action concept. You're the only crew on a self-driving camper: take the wheel in bends, refuel, cook for the passenger, put out fires, patch leaks and re-stow luggage, then reach camp before sunset. Roads are generated from a seed. Touch, keyboard and gamepad all work.
- Added the first work-in-progress versions of four games, each as a single HTML file: **Jade Pavilion** (mahjong), **Nuts & Bolts** (nut sorting), **Outbound** (arrow puzzle) and **Unscrew** (3D take-apart, in Dutch).
- Restructured the repository for a mobile app:
  - every game in its own folder under `games/`, split into HTML, CSS and JS (code unchanged)
  - three.js and all fonts now ship with the games, so they work fully offline
  - `shared/` for what all games use: three.js, a small platform layer for the Android back button and vibration, the icon
- Added a hub start screen (`index.html`) linking all four games, each card in its game's own style.
- Tooling: `npm run dev` (also prints an address to play on the phone over Wi-Fi), `npm run build`, and `npm test` (automatic check of every game at phone size, including "no internet requests").
- GitHub: tests run on every push; a workflow can publish the browser version to GitHub Pages.
- Wrote the [mission](MISSION.md), [privacy policy](PRIVACY.md), [Android guide](docs/ANDROID.md), [architecture notes](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [naming notes](docs/NAMING.md), the [to-do list](TODO.md) and this history file.

- Added a fifth game, **Graphite**: four pencil-and-paper logic puzzles in one, Sudoku, Takuzu (binary puzzle), Star Battle and Calcudoku. Four tiers each, endless seeded levels, four daily puzzles with a calm streak, notes, undo, hints that explain the next logical step, rule-clash marking, light/dark theme. Every puzzle is checked to have exactly one solution; Sudoku and Takuzu puzzles never need guessing.
- `npm test` now also checks the puzzle generators (`tests/puzzles.mjs`): unique solutions, and the same levels every time.
- Every game and the hub now come in **English and Dutch**. Pick the language on the hub (or in Graphite's Settings); English is the default. Unscrew, Dutch until now, is in English too. All text lives in one `strings.js` per game, on top of a small shared `shared/js/i18n.js`. `npm test` opens every page in both languages and fails on a missing translation.

**Decided**
- One app containing all games first; separate apps per game remain possible later (`npm run build -- --game <name>`).
- Package the app with Capacitor (Android first, iOS later).
- Keep three.js at r128 for the existing four games.
- "Honest Arcade" is a working title. The real name comes later ([docs/NAMING.md](docs/NAMING.md)).
- Every game in English and Dutch, English by default, one language choice for the whole app. More languages can be added the same way ([architecture notes](docs/ARCHITECTURE.md#5-languages)).
- The logic puzzles use their generic names (Calcudoku, not KenKen; Star Battle, not Queens; Takuzu, not Tango) to stay clear of trademarks. Murdoku-style whodunit puzzles stay on the idea list as a later, more original project.

**Next**
- Merge into `main`, turn on GitHub Pages, play everything on the phone.
- See [TODO.md](TODO.md).
