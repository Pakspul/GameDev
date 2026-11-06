# Honest Arcade

> *Working title: the final name is still open, see [docs/NAMING.md](docs/NAMING.md).*

**Puzzle games that are actually free to play. No ads, no tracking, no pay-to-win. Ever.**

Most "free" mobile games make you watch an ad after every level, until you spend more time on ads than on playing. These games are made the other way round: free because they are free. Read the full [mission](MISSION.md).

| Game | What it is |
|---|---|
| **Jade Pavilion** | Mahjong solitaire on a lantern-lit 3D table |
| **Nuts & Bolts** | Screw nuts from bolt to bolt until every colour is sorted |
| **Outbound** | Every arrow leaves the way it points; find the order that clears the board (2D and 3D shapes) |
| **Unscrew** | Take 3D objects apart screw by screw |
| **Graphite** | Pencil-and-paper logic puzzles: Sudoku, Takuzu, Star Battle and Calcudoku, endlessly generated, each with exactly one solution |
| **Crystal Reels** | Two slot machines with play money only: free spins, Hold & Spin, a pick bonus, jackpots, the same odds for everyone. See [docs/SLOTS.md](docs/SLOTS.md) |
| **Camper Crew** *(prototype, dev only)* | Action: you're the only crew on a self-driving camper. Steer through bends, refuel, cook and patch leaks to reach camp before sunset |

Jade Pavilion, Nuts & Bolts, Outbound, Unscrew and Camper Crew are built with [three.js](https://threejs.org); Graphite is plain 2D canvas, and Crystal Reels is plain DOM and SVG with synthesised sound (no libraries, no assets). They all run in any modern browser, work fully offline, and are being packaged as one Android app (iPhone later).

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm run dev        # play at http://localhost:8080 — and on your phone via the printed Wi-Fi address
npm install        # once, for the tests
npx playwright install chromium   # once
npm test           # puzzle generators, slot maths and rules, build, open every game in a headless phone browser, play the slots end to end
npm run build      # assemble dist/ (what goes into the app)
```

No build step is needed while developing: edit a file and refresh.

Experimental games (listed in `EXPERIMENTAL` in [scripts/build.mjs](scripts/build.mjs), currently Camper Crew) are playable in `npm run dev` but left out of `dist/`, so they don't reach the website or the app. `npm run build -- --experimental` includes them; `npm test` does that so they stay tested.

## Repository layout

```
index.html          the hub (start screen) linking every game
games/<name>/       one folder per game, with its own style, fonts and code
shared/             what all games share: three.js, the platform layer, icons
scripts/            dev server, build, font downloader, slot simulator and validator
tests/              smoke test + puzzle generator test
docs/               guides
```

## Documentation

- [MISSION.md](MISSION.md): the promise, and how to check every change against it
- [docs/RELEASE.md](docs/RELEASE.md): how to release, as step tables (who does what, and the state): Android first, iPhone on hold
- [docs/ANDROID.md](docs/ANDROID.md): from browser to Google Play in detail, including how to test on your phone
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code is organised and how to improve it safely
- [docs/SLOTS.md](docs/SLOTS.md): Crystal Reels: how it is built, the maths simulator, fairness rules, requirement map
- [docs/ECONOMY.md](docs/ECONOMY.md): how coins, washers and points work in every game: prices in levels of effort, stars for playing without help
- [TODO.md](TODO.md): what to do next, as a checklist
- [HISTORY.md](HISTORY.md): what was done, per day
- [docs/ROADMAP.md](docs/ROADMAP.md): tips and ideas for new games
- [docs/BACKLOG.md](docs/BACKLOG.md): the next games: ten puzzle games and one chaotic action game
- [docs/ISSUES.md](docs/ISSUES.md): issues and player feedback, per game
- [docs/UNSCREW-MODELS.md](docs/UNSCREW-MODELS.md): Unscrew's 3D models by category, ideas for new ones, and a recipe for adding one
- [docs/NAMING.md](docs/NAMING.md): notes for choosing the final name ("Honest Arcade" is a working title)
- [PRIVACY.md](PRIVACY.md): privacy policy (short version: we collect nothing)

## Credits

three.js (MIT), fonts from Google Fonts under the SIL Open Font License; the licence files sit next to the files in `shared/vendor/` and `games/*/fonts/`.
