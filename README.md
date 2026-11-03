# Honest Arcade

**Puzzle games that are actually free to play. No ads, no tracking, no pay-to-win. Ever.**

Most "free" mobile games make you watch an ad after every level, until you spend more time on ads than on playing. These games are made the other way round: free because they are free. Read the full [mission](MISSION.md).

| Game | What it is |
|---|---|
| **Jade Pavilion** | Mahjong solitaire on a lantern-lit 3D table |
| **Nuts & Bolts** | Screw nuts from bolt to bolt until every colour is sorted |
| **Outbound** | Every arrow leaves the way it points; find the order that clears the board (2D and 3D shapes) |
| **Unscrew** | Take 3D objects apart screw by screw (in Dutch for now) |

All four are built with [three.js](https://threejs.org), run in any modern browser, work fully offline, and are being packaged as one Android app (iPhone later).

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm run dev        # play at http://localhost:8080 — and on your phone via the printed Wi-Fi address
npm install        # once, for the tests
npx playwright install chromium   # once
npm test           # build + open every game in a headless phone browser
npm run build      # assemble dist/ (what goes into the app)
```

No build step is needed while developing: edit a file and refresh.

## Repository layout

```
index.html          the hub (start screen) linking every game
games/<name>/       one folder per game, with its own style, fonts and code
shared/             what all games share: three.js, the platform layer, icons
scripts/            dev server, build, font downloader
tests/              smoke test
docs/               guides
```

## Documentation

- [MISSION.md](MISSION.md): the promise, and how to check every change against it
- [docs/ANDROID.md](docs/ANDROID.md): from browser to Google Play, including how to test on your phone; iOS notes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code is organised and how to improve it safely
- [docs/ROADMAP.md](docs/ROADMAP.md): next steps, tips and ideas for new games
- [PRIVACY.md](PRIVACY.md): privacy policy (short version: we collect nothing)

## Credits

three.js (MIT), fonts from Google Fonts under the SIL Open Font License; the licence files sit next to the files in `shared/vendor/` and `games/*/fonts/`.
