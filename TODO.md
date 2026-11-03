# To do

The concrete next steps, roughly in order. Tick a box when it's done (`- [x]`), and mention it in that day's entry in [HISTORY.md](HISTORY.md). Background and the "why" are in [docs/ROADMAP.md](docs/ROADMAP.md).

## Now

- [ ] Merge the restructure branch into `main`
- [ ] Turn on GitHub Pages: *repo Settings → Pages → Source: GitHub Actions*
- [ ] Play every game on the phone (`npm run dev`, or the Pages link) and write any bugs down under **Bugs & notes** below
- [ ] Choose a licence (GPL-3.0 or MIT, see the roadmap) and add a `LICENSE` file

## Decisions (no rush, but before the deadline in brackets)

- [ ] **App ID**, e.g. `io.github.pakspul.arcade` *(before the first Play Console upload; can never change)*
- [ ] **Language:** Unscrew is Dutch and the others English. Translate it, or make every game NL + EN? *(before the store listing)*
- [ ] **Name of the collection:** see [docs/NAMING.md](docs/NAMING.md) *(before going public; can still change later)*
- [ ] **Developer name** in the store, e.g. "Pakspul" *(when creating the Play account)*

## Games

- [ ] "Back to arcade" button in each game's own menu, calling `Platform.home()` (styled per game)
- [ ] Language work for Unscrew, per the decision above
- [ ] Colour-blind check: can Unscrew's screws and boxes be told apart without colour?
- [ ] Battery: pause rendering when nothing moves or the app is in the background
- [ ] Optional cleanup: remove the `window.claude` leftovers from the artifact days
- [ ] Graphite: play every type and tier on the phone. Are the tiers well spaced? Is Star Battle Expert (10×10, 2 stars) quick enough to generate on an older phone?
- [ ] Graphite: is the name a keeper? (Same checks as in [docs/NAMING.md](docs/NAMING.md).)
- [ ] Graphite: a next puzzle type (ideas in the roadmap: Nonograms, Kakuro, …)
- [ ] Pick the next game from [docs/BACKLOG.md](docs/BACKLOG.md)
- [ ] Action game: choose a concept (Camper Crew, Moving Day, Short Order) and build a grey-box prototype to test if it's fun

## Android app (see [docs/ANDROID.md](docs/ANDROID.md), part 2)

- [ ] Install Node.js 22+ and Android Studio
- [ ] Add Capacitor (`@capacitor/core`, `cli`, `android`, `app`, `haptics`) and commit the `android/` folder
- [ ] Debug build on my own phone; go through the manual test checklist
- [ ] Final app icon (1024×1024 PNG) and splash screen
- [ ] Create the signing key, **and back it up** (password manager + offline copy)

## Google Play (see [docs/ANDROID.md](docs/ANDROID.md), part 3)

- [ ] Developer account (US$25 one-time + ID verification)
- [ ] **Find 12 testers early.** The closed test takes 14 days.
- [ ] Store listing: short and full description (with the mission), 9:16 screenshots, 1024×500 feature graphic
- [ ] Forms: privacy policy URL, ads = no, data safety = nothing collected, content rating, target audience
- [ ] Internal test → closed test (12 testers × 14 days) → apply for production → release 🎉

## Later

- [ ] `Platform.storage` on `@capacitor/preferences` (needed for iOS)
- [ ] iOS port (Mac + Apple Developer Program)
- [ ] Also publish on itch.io and/or F-Droid
- [ ] Hub extras: "Continue" button, a "Today" row with every daily puzzle (Graphite already has one for its four types)
- [x] A fifth game: **Graphite** (Sudoku, Takuzu, Star Battle, Calcudoku)

## Bugs & notes

_Write down anything you notice while playing: game, what happened, on which phone._

-
