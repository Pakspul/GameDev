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

## 2026-11-06

**Done**
- New [docs/ISSUES.md](docs/ISSUES.md): issues and player feedback per game, with IDs (`U-1`, `J-1`, …). First issue: **U-1**, players find Unscrew's 3D models too few and too alike.
- Unscrew got two new 3D models in two new categories: a **villa** (two floors, flat roofs, a glass balustrade, solar panels, a pool with a screwed-on rim) and a **giraffe** (the first animal: spots that hide screws, a leaning neck with a mane, an acacia tree). Eight models now.
- New [docs/UNSCREW-MODELS.md](docs/UNSCREW-MODELS.md): the models sorted into nine categories with ideas for each, the rules a model must follow to keep all its parts, and a step-by-step recipe (and a ready prompt) for adding a model, so one model can be handed to an AI agent at a time.
- New `npm run unscrew:models`: generates every model at every difficulty and reports screws per level and the share of parts kept; `--shots` saves screenshots.

**Decided**
- Adding models reshuffles which object each 3D level number shows. Saves hold no objects, so the save key stays `unscrew.v2`.
- Grow the models one category at a time; vehicles and industry first, as they are still empty.

**Next**
- Issue **U-2**: the report shows the older models silently drop 5–45% of their parts, some of them visibly (a gap in the cottage's wall). Fix model by model.
- More models from the catalogue.

## 2026-11-04 (slots)

**Done**
- Built **Crystal Reels**, a full slot game from the acceptance criteria document ([docs/SLOTS.md](docs/SLOTS.md)): two machines (Crystal Fortune: 20 lines, free spins with sticky wilds, Hold & Spin, four jackpots; Neon Tumble: 243 ways, cascades, expanding wild, free spins with a choice of three, a pick bonus), a lobby with levels, daily missions, a free coin bonus, stats and achievements, English and Dutch.
- One engine for everything: the outcome is decided before the reels move, features are planned in full when they start, and the same `Session` code drives the game, the maths simulator and session replay. All odds live in one config per machine, validated at build time.
- A maths simulator (`npm run slots:sim`) and a tuning pass: both machines land on 96.0% RTP over 10 million spins (within ±0.5 points), with a hit frequency of about 31% and free spins every 160-180 spins.
- Tests: 87 unit tests (every paytable entry, edge cases, fairness source scans, saves, replay), an end-to-end run in a phone-sized browser, and the existing smoke test now covers the new game.

**Decided**
- Plain web technology without a bundler, like the rest of the arcade. No monetization, no cloud save, no analytics, no social features.
- The refill after running out of coins has **no waiting time** (the specification allows a 10 minute default; the project mission rules out timers that stop you playing). One number in `data/game.json` changes it.
- The volatility classes are low < 4, medium < 12, high otherwise (standard deviation of a round's return in bets).

**Next**
- Play it on a real phone: frame rate, input latency, how the music and haptics feel (not measurable in a headless test).
- Art pass: the symbols are drawn in code and are meant to be restyled.

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
