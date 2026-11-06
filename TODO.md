# To do

The concrete next steps, roughly in order. Tick a box when it's done (`- [x]`), and mention it in that day's entry in [HISTORY.md](HISTORY.md). Background and the "why" are in [docs/ROADMAP.md](docs/ROADMAP.md).

## Now

- [ ] Merge the restructure branch into `main`
- [ ] Turn on GitHub Pages: *repo Settings → Pages → Source: GitHub Actions*
- [ ] Azure Static Web Apps: create the app (deployment source *Other*) and save its deployment token as the repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (see `.github/workflows/azure-static-web-apps.yml`)
- [ ] Play every game on the phone (`npm run dev`, or the Pages link) and write any bugs down under **Bugs & notes** below
- [ ] Choose a licence (GPL-3.0 or MIT, see the roadmap) and add a `LICENSE` file

## Decisions (no rush, but before the deadline in brackets)

- [ ] **App ID**, e.g. `io.github.pakspul.arcade` *(before the first Play Console upload; can never change)*
- [x] **Language:** every game in English and Dutch, picked on the hub (English by default)
- [ ] **Name of the collection:** see [docs/NAMING.md](docs/NAMING.md) *(before going public; can still change later)*
- [ ] **Developer name** in the store, e.g. "Pakspul" *(when creating the Play account)*

## Games

- [ ] "Back to arcade" button in four games: see **Release issues**, item 1
- [x] Language work for Unscrew, per the decision above
- [ ] Colour-blind check: can Unscrew's screws and boxes be told apart without colour?
- [ ] Unscrew: more 3D models, one category at a time (issue U-1; catalogue and recipe in [docs/UNSCREW-MODELS.md](docs/UNSCREW-MODELS.md)). Vehicles and industry first
- [ ] Unscrew: older models silently lose parts (issue U-2)
- [ ] Battery: pause rendering when nothing moves or the app is in the background
- [ ] Optional cleanup: remove the `window.claude` leftovers from the artifact days
- [ ] Graphite: play every type and tier on the phone. Are the tiers well spaced? Is Star Battle Expert (10×10, 2 stars) quick enough to generate on an older phone?
- [ ] Graphite: is the name a keeper? (Same checks as in [docs/NAMING.md](docs/NAMING.md).)
- [ ] Graphite: a next puzzle type (ideas in the roadmap: Nonograms, Kakuro, …)
- [ ] Pick the next game from [docs/BACKLOG.md](docs/BACKLOG.md)
- [x] Action game: choose a concept (**Camper Crew**) and build a grey-box prototype
- [ ] Camper Crew: playtest on the phone (landscape and portrait) and with someone else; answer the questions in [docs/BACKLOG.md](docs/BACKLOG.md#prototype-status)
- [ ] Camper Crew: tune or cut based on the playtest, *then* decide on art, sound and more troubles

## Release issues

Found while writing the [release guide](docs/RELEASE.md) (4 November 2026). Each item says which release needs it. All four can be done by Claude in a session: just ask for the item by number.

1. [ ] **No way back to the hub in four games.** Jade Pavilion, Nuts & Bolts, Outbound and Unscrew have no button that calls `Platform.home()` (Graphite and Camper Crew do). On Android the back button covers it; on iPhone a player is stuck in the game until they kill the app, and Apple rejects that. Add a "Back to arcade" button to each game's own menu, styled per game, with the label in English and Dutch in its `strings.js`.
   *Needed for: iPhone (required). Nice for Android and the browser.*
2. [ ] **Outbound vibrates through `navigator.vibrate` directly** (`games/outbound/game.js`). That doesn't exist on iPhone and skips the native Haptics plugin on Android. Replace it with `Platform.haptic(60)`.
   *Needed for: iPhone. Better on Android.*
3. [ ] **Progress is only in `localStorage`.** Inside an iPhone app, iOS may clear that when the phone runs low on space, and players lose all progress. Mirror every write to `@capacitor/preferences` in `shared/js/platform.js` and restore missing keys at start-up, so the games don't need changes (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
   *Needed for: iPhone. Extra safety on Android.*
4. [ ] **The privacy policy is out of date.** [PRIVACY.md](PRIVACY.md) lists only four games (Graphite is missing) and only the Android app. Name every game in the app, and the iPhone app once it exists; update the date.
   *Needed for: Android (before the store listing), iPhone.*

## Crystal Reels (slots)

- [ ] Play on a real phone: 60 fps during spins and big wins, spin-to-movement latency under 100 ms, start-up under 3 s (see "Not verified here" in [docs/SLOTS.md](docs/SLOTS.md))
- [ ] Listen to the synthesised music loops and feel the haptics; tune or replace them
- [ ] Decide on final theme and art for the first machine (symbols are drawn in code in `games/slots/src/ui/art.js`)
- [ ] Before releasing a changed machine config: `npm run slots:verify` (10 million spins per machine)
- [ ] Store listing: play-money statement and the "simulated gambling" content rating (text in [docs/SLOTS.md](docs/SLOTS.md))
- [ ] Add the new game to [PRIVACY.md](PRIVACY.md)'s list once the app is built (it stores progress locally and nothing else)
- [ ] Optional: a cooldown on the free refill (`refill.cooldownMinutes` in `games/slots/data/game.json`; the specification default is 10)

## Wallbreaker (see [docs/WALLBREAKER.md](docs/WALLBREAKER.md))

- [ ] **Feel gate:** play on a real mid-range phone (`npm run dev`, phone on the same Wi-Fi). Is the ball speed right, does the relative drag feel right, are the edges forgiving enough? Tune `physics` in `games/wallbreaker/src/config.js`
- [ ] Measure on that phone: 60 fps with 200 bricks and 12 balls, and touch-to-paddle latency under 50 ms
- [ ] **Pacing gate:** a playtest with a few people; compare with `npm run wallbreaker:sim`, then tune prices and rewards in the config
- [ ] Play all 30 Puzzle walls and the 8 Time Attack walls: are they fun, in a good order, and are the medal times fair?
- [ ] Decide the open items: Daily leaderboard (local or online), sound (synthesised, original or licensed), Descent's four power-ups, checkpoints every 5th level, name check

## Android app, priority 1 (see [docs/RELEASE.md](docs/RELEASE.md), chapter 1)

- [ ] Install Node.js 22+ and Android Studio
- [ ] Add Capacitor (`@capacitor/core`, `cli`, `android`, `app`, `haptics`) and commit the `android/` folder
- [ ] Debug build on my own phone; go through the manual test checklist
- [ ] Final app icon (1024×1024 PNG) and splash screen
- [ ] Create the signing key, **and back it up** (password manager + offline copy)

## Google Play (see [docs/RELEASE.md](docs/RELEASE.md), chapter 1)

- [ ] Developer account (US$25 one-time + ID verification)
- [ ] **Find 12 testers early.** The closed test takes 14 days.
- [ ] Privacy policy online at a public URL (the text now names all seven games in the app)
- [ ] Store listing: short and full description (with the mission), 9:16 screenshots, 1024×500 feature graphic
- [ ] Forms: privacy policy URL, ads = no, data safety = nothing collected, content rating, target audience
- [ ] Internal test → closed test (12 testers × 14 days) → apply for production → release 🎉

## Later

- [ ] iPhone release, on hold because of the US$99/year fee (see [docs/RELEASE.md](docs/RELEASE.md), chapter 2). Release issues 1–3 come first and cost nothing.
- [ ] Also publish on itch.io and/or F-Droid
- [ ] Hub extras: "Continue" button, a "Today" row with every daily puzzle (Graphite already has one for its four types)
- [x] A fifth game: **Graphite** (Sudoku, Takuzu, Star Battle, Calcudoku)

## Bugs & notes

_Write down anything you notice while playing: game, what happened, on which phone._ Anything that needs more than a line goes into [docs/ISSUES.md](docs/ISSUES.md), per game.

-
