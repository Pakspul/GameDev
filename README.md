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
| **Camper Crew** *(prototype)* | Action: you're the only crew on a self-driving camper. Steer through bends, refuel, cook and patch leaks to reach camp before sunset |

Jade Pavilion, Nuts & Bolts, Outbound, Unscrew and Camper Crew are built with [three.js](https://threejs.org); Graphite is plain 2D canvas. They all run in any modern browser, work fully offline, and are being packaged as one Android app (iPhone later).

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm run dev        # play at http://localhost:8080 — and on your phone via the printed Wi-Fi address
npm install        # once, for the tests
npx playwright install chromium   # once
npm test           # check the puzzle generators, build, open every game in a headless phone browser
npm run build      # assemble dist/ (what goes into the app)
```

No build step is needed while developing: edit a file and refresh.

## Repository layout

```
index.html          the hub (start screen) linking every game
games/<name>/       one folder per game, with its own style, fonts and code
shared/             what all games share: three.js, the platform layer, icons
scripts/            dev server, build, font downloader
tests/              smoke test + puzzle generator test
docs/               guides
```

## Documentation

- [MISSION.md](MISSION.md): the promise, and how to check every change against it
- [docs/ANDROID.md](docs/ANDROID.md): from browser to Google Play, including how to test on your phone; iOS notes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code is organised and how to improve it safely
- [TODO.md](TODO.md): what to do next, as a checklist
- [HISTORY.md](HISTORY.md): what was done, per day
- [docs/ROADMAP.md](docs/ROADMAP.md): tips and ideas for new games
- [docs/BACKLOG.md](docs/BACKLOG.md): the next games: ten puzzle games and one chaotic action game
- [docs/NAMING.md](docs/NAMING.md): notes for choosing the final name ("Honest Arcade" is a working title)
- [PRIVACY.md](PRIVACY.md): privacy policy (short version: we collect nothing)

## Credits

three.js (MIT), fonts from Google Fonts under the SIL Open Font License; the licence files sit next to the files in `shared/vendor/` and `games/*/fonts/`.
