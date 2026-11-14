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

## 2026-11-14

**Done**
- Graphite, Star Battle: **Auto-dots now also dot the star's whole row and column**, not only the cells around it (existing stars and dots are left alone, and one undo removes the star with its dots). The setting note and rules text say so, in English and Dutch.

## 2026-11-13

**Done**
- Crystal Reels, **more to do besides spinning**: live challenges (and bet quests) from a strip above the reels, level chests every 5 levels, a lucky wheel for every finished daily mission, free-spins vouchers, six reel frames to collect, six gems per machine, a weekly chain of three goals, and an opt-in double-or-collect after small wins. Autoplay asks first while a challenge runs. None of it touches the odds, and nothing punishes a player who ignores it. The proposed active-play bonus was left out: paying more for tapping than for autoplay is adaptive odds (FAIR-03).
- Crystal Reels: **levels are per machine and never end**. XP, level and bet unlocks belong to each machine; Neon Tumble opens at Crystal Fortune level 4. Past level 30 a level earns a **rank** (title and badge colour: Rookie … Legend, then Legend II, III, …) instead of coins, and coin rewards stop growing at level 30. The lobby tiles and the profile show each machine's level, rank and XP. Old saves keep what they had (played machines start at the old total).
- Crystal Reels, after a player who made 400k at the start and then lost steadily to level 30 (a 89.6% return): the payout was fine (96% RTP at every bet), but the bets grow over 100-fold with the level while rewards stayed flat, and Max bet picked the highest bet the balance could pay. Now **rewards grow with the level** (×8.25 at level 30), **Max bet stays within 2% of the balance**, a **large bet is flagged** and a **session loss of 50%** gives a warning, and the **RTP target is 97.5%** (small pays raised on both machines; 10 million spins: 97.3% and 97.5%).
- **Autoplay can be unlimited (∞)**, with an optional loss limit, and the session reminder still interrupts it.
- **Settings → Export profile** shows the profile as JSON with a Copy button.
- On phones: **dialogs scroll** (the rules, settings, profile and autoplay dialogs were taller than the screen and could not be reached), the **controls fit** (Turbo ran off the right edge; now a stepper and Max bet / Turbo / Auto in three equal columns beside the spin button), and the **reels use the spare height** (cells up to 1.5× taller than wide, bigger jackpot panels and win amount on taller screens).
- The folder `games/slots` is now **`games/crystal-reels`** (the save key, test folder and npm script names are unchanged, so saved progress survives).

**Decided**
- Loss limits are a warning and an option, never a lock: nothing stops a player who chooses to keep playing with play money.

**Next**
- Look at the feel of the taller reels on a real phone.

## 2026-11-07

**Done**
- New game: **Coin Dozer**, a coin pusher built from its specification ([docs/COIN-DOZER.md](docs/COIN-DOZER.md)), all seven build steps. Real rigid-body physics with [Rapier](https://rapier.rs) (vendored in `shared/vendor/rapier/`, like three.js): coins as rounded cylinders that stack, slide and tip, a kinematic pusher on a 2.4 s cycle, sleeping bodies, a fixed 60 Hz step and a seeded board. Gold and lucky coins, four gem cuts and 32 figures over four machine themes (Classic, Space, Candy, Ocean), coin showers, fever, jackpots and the wide shelf, anti-stall that looks like normal physics, a lifeline so the bank never stays empty, credits, milestones, a Workshop and a collection. Instanced coins in three.js r128, synthesised sound limited to 12 voices, haptics, settings, saving of the whole board, offline install. English and Dutch. On the hub as a new card; the hub's version is now **v0.3**.
- Tests for the acceptance criteria, in `npm test`: `tests/coin-dozer/rules.test.mjs` (31 tests on the real physics), `sim.test.mjs` (the cascade rate over 200 advances) and `e2e.mjs` (a phone browser: start, aim, drop, buttons, Workshop, collection, settings, reload, corrupt save, landscape, offline). The 10,000-cycle stability run is a separate CI job. `npm run coin-dozer:sim` prints the cascade rate and payout.
- Tuning with the simulation found a loop: a big cascade starts a coin shower, whose coins start another big cascade. A cascade-triggered shower now waits 40 s after the last one.
- Coin Dozer, after feedback that it looked plain: a **new look** and **two machines**. Physically based metal lit by a reflected arcade hall; gold coins with a raised rim, a struck crown, beads and a reeded edge (the 5-coin is silver with blue enamel); brushed steel, a lacquered cabinet, a neon back panel per theme, chasing bulbs, LED counters and arcade push buttons. The new **pin wall** machine (the default) drops your coin through one of three slots and down a wall of brass pins, so where it lands is up to chance; the **free drop** is the old way, aimed by you. Each machine keeps its own board, and your bank comes along when you switch. Coin Dozer also got the arcade's back button and menu drawer (H-1), which it was missing. New tests for the pin wall; the simulation runs both machines.
- Coin Dozer, after feedback that the view was hard to watch and clicks didn't respond: a **new view**, like standing at a real pusher. A wide lens low and close to the front edge, so the shelf runs away from you in perspective with big coins in front and the pin wall facing you at the top, under a new lit marquee. Where coins go is now visible: a gold light along the front edge (won) and open gutters with a red light in front of the side rails (lost); the shelf no longer looks half a coin longer than it is. **A press drops a coin at once**, anywhere on the board and with a mouse (before, the coin waited for the release, and presses on the top half, where the pin wall's slots are, did nothing). The Workshop and collection open at once: their pictures are drawn by the game's renderer and fill in after the screen opens, instead of a second renderer freezing the first screen.

**Decided**
- Coin Dozer follows the arcade where the spec and the codebase differ (listed in docs/COIN-DOZER.md): English and Dutch, every button in the bottom bar (settings moved to the pause card), credits per game. A theme's 12 collectibles are its 4 gems and 8 figures.

**Next**
- The feel gate on a real phone, and the performance numbers that need one (see TODO).

## 2026-11-06

**Done**
- New game: **Wallbreaker**, a brick breaker built from the game plan and acceptance criteria ([docs/WALLBREAKER.md](docs/WALLBREAKER.md)), all six build slices at once: one engine (fixed 120 Hz, swept-circle collision so nothing tunnels) under seven modes (Classic, Zen, Descent, Run, Daily, Puzzle, Time Attack); level 1 fixed and every other level generated from a seed, checked for reachability and at most 15% steel; bosses every 10th level; ten brick types; 16 good capsules and 6 risky ones you catch or dodge; credits, boosts, a Workshop and 24 cosmetics; save export and import; settings for colour-blind colours, reduced motion, left-handed layout, haptics, auto-launch, aim assist and sensitivity; synthesised sound packs; offline install with a service worker. English and Dutch. On the hub as the seventh card, and the hub's version is now **v0.2**.
- 30 Puzzle walls, each proven solvable by a solver that plays them with the real engine (`npm run wallbreaker:puzzles`); 8 Time Attack walls.
- Tests for the acceptance criteria: `tests/wallbreaker/rules.test.mjs` (38 tests in Node) and `tests/wallbreaker/e2e.mjs` (a phone browser: every mode starts, relative drag, boosts, quitting, settings, offline), both in `npm test`. `npm run wallbreaker:sim` lets an autopilot play Classic and prints pay per level.
- An autopilot playing 150 levels found three ways a level could drag on forever; each got a small fix in the config: a ball that touches nothing useful for 10 s gets a small turn, a ball takes a portal at most twice per paddle hit, and with 3 bricks or fewer left for 15 s the ball leans toward them. Steel is never placed next to other steel, so it can't seal bricks off.
- [PRIVACY.md](PRIVACY.md) now names every game in the app, Graphite and Wallbreaker included.
- One way around every game (**H-1**, from player feedback: there was no way back to the main menu). Every game now has a **back button top left** (level → the game's menu → the arcade, and the Android back button does the same) and a **☰ menu top right**: a drawer from the right, like the hub's, with that game's options and always "Back to arcade". The plumbing is shared (`shared/js/gamenav.js`, `shared/css/gamenav.css`); the look is each game's own, through `--gn-*` variables. Settings and crowded top-bar buttons moved into the drawers, and the pause dialogs of Unscrew, Camper Crew and Wallbreaker became the drawer. The smoke test checks every game has both buttons. This also closes release issue 1 (no way back to the hub on iPhone).
- Every game's own menu now reads the same way (**H-2**): back top left, the balance and ☰ top right; then the daily, the variants side by side, the difficulties as tabs, a card with where you are and one big Play, and a grid of every level with its stars (the next one ringed, later ones locked). Shared parts in `shared/js/gamelobby.js` and `shared/css/gamelobby.css`, styled by each game through the same `--gn-*` variables as the drawer. Moved onto it: **Wallbreaker** (the mode cards became tabs and the per-mode screens one lobby; Classic, Zen, Descent and Puzzle got a level grid, Zen and Descent no longer forget later levels when you replay an earlier one, and the last mode is remembered), **Jade Pavilion** (the level stepper became a grid), **Nuts & Bolts** (the number box became a grid, and the game now opens on the workshop with the puzzle you were on behind it), **Unscrew** (2D/3D, difficulty, your run, and once you have progress the stars per level) and **Camper Crew** (the road picker became a grid of roads). Outbound, Graphite and Crystal Reels already had this layout; Outbound's points moved next to ☰ like everyone's balance.
- Fixed along the way: Jade's menu was 40 px wider than a phone screen (its padding came on top of `width: 100%`).
- Nuts & Bolts got a new level type from a player's idea (**N-1**): **Keyed bolts**, bolts with a coloured base and tag that only take nuts of their own colour. It replaces the second Mixed level in the cycle (levels 4, 9, 14, …) and joins the daily rotation; the solver and hints know the rule, and every other level is unchanged.
- New [docs/ISSUES.md](docs/ISSUES.md): issues and player feedback per game, with IDs (`U-1`, `J-1`, …). First issue: **U-1**, players find Unscrew's 3D models too few and too alike.
- Unscrew got two new 3D models in two new categories: a **villa** (two floors, flat roofs, a glass balustrade, solar panels, a pool with a screwed-on rim) and a **giraffe** (the first animal: spots that hide screws, a leaning neck with a mane, an acacia tree). Eight models now.
- New [docs/UNSCREW-MODELS.md](docs/UNSCREW-MODELS.md): the models sorted into nine categories with ideas for each, the rules a model must follow to keep all its parts, and a step-by-step recipe (and a ready prompt) for adding a model, so one model can be handed to an AI agent at a time.
- New `npm run unscrew:models`: generates every model at every difficulty and reports screws per level and the share of parts kept; `--shots` saves screenshots.
- Unscrew's models moved out of `game.js` (893 → 467 lines) into `games/unscrew/models/`: `kit.js` with the building blocks, one file per category, and `order.js`. Every one of 88 sample levels came out identical before and after the move.
- Four more models, filling the empty categories (U-1): a **camper van** (two-tone panels, sliding door, roof box, awning, camping table), a **water tower** (legs and beams, a ladder, a railed platform, a staved tank, a pump house), a **turtle** (a tiered shell of scutes with hexagonal plates on top) and a **Dutch canal house** (a row of one to three houses with stepped gables, hoist beams and sash windows). Twelve models in eight categories, all keeping 98–100% of their parts.
- Six more models (U-1), each built with depth, so taking it apart is a puzzle: a **lighthouse** (a door with a window plate on it, a railed gallery, a glass lamp room, a keeper's house), a **Mars rover** (capped wheels, a body on a chassis, a deck plate with a camera mast, a dish and an arm), a **steam train** (a boiler lying on its side, a cab, a tender and up to two wagons, with the wheels blocking the frames), a **wind turbine** (a hub that hides all three blade roots, a hatch plate with an anemometer), an **arcade cabinet** (coin door, screen bezel, a control deck whose buttons each stand on a screw, a marquee with stars) and a **layer cake** (tiers that each hide the screws of the one below, icing dollops, candles). The cake opens a ninth category, everyday objects (`models/objects.js`). Eighteen models; the new ones keep 92–100% of their parts.
- Six more Unscrew models (U-1), each a chain of covers rather than a pile: a **burger** (a paper wrapper over the bun's screws, a ring of onion dots, sesame seeds over the top bun's screws, fries and a cup), a **pagoda** (roof slabs whose screws all hide under the next floor, tile plates and lanterns on the rim), a **harbour crane with containers** (stacks that come apart top-down, legs and beams whose only screws hide under plates and parts above them), a **fire engine** (roller shutters with handle plates, a ladder over a rack plate, a light bar), a **robot dog** (legs as stacks of parts, hip caps, a battery plate, a visor and a sensor module) and a **kitchen** (units as wide as two wall panels, a pan with a lid on a hob, a fridge). Twenty-four models in nine categories; the new ones keep 95-100% of their parts.
- Three more rules for the model recipe: a cover's screw needs 0.42 of free space towards screws pointing another way (also those of the part above it), two top screws 0.4 apart on one part cost one of them, and anything floating just over a top screw blocks it.
- `cladCyl` takes a `keep` filter (for a cylinder lying on its side), and the model rules gained four lessons from these six: corner posts crowd narrow walls, panel rows need 0.52, keep wheels 0.14 clear of panels, and a cover's own screw must not crowd the anchor it hides. A new "Depth" section in [docs/UNSCREW-MODELS.md](docs/UNSCREW-MODELS.md) lists the ways to make a model a puzzle.
- New `tests/unscrew.mjs` (part of `npm test`): every model file is loaded, every model is in the order list and named in both languages, and the order list only grows at the end.
- New **model inspector** for Unscrew, development only (`games/unscrew/index.html?models` in `npm run dev`): any model at any difficulty, level and variant, with its dropped parts as red ghosts, unused slots, x-ray, an explode slider, tap-a-part to see what holds it, step-by-step taking apart, and "play this level". `npm run build` strips it, like the slots debug menu. See [docs/UNSCREW-MODELS.md](docs/UNSCREW-MODELS.md#5-check-it).
- The build's debug-block strip now handles CRLF line endings, so `npm run build` works on a Windows checkout again.
- The hub got a **menu** (the ☰ button top right) that slides in from the right with the language picker, **Our mission** (the promise from [MISSION.md](MISSION.md), short and in both languages) and **What's new** (a change log per version) and a **Source code** link to [the GitHub repo](https://github.com/Pakspul/GameDev), with the version (**v0.1**) quietly at the bottom. New releases go at the top of `CHANGES` in [index.html](index.html), with `version` in `package.json` raised to match.

**Decided**
- Wallbreaker keeps its own economy (fixed prices, boosts bought ahead, 3-star replays pay 50%) instead of the arcade's "levels of the tier" rules, because it has no help to buy and no tiers. Explained in [docs/ECONOMY.md](docs/ECONOMY.md) and [docs/WALLBREAKER.md](docs/WALLBREAKER.md).
- Wallbreaker is on the hub and in production builds, not behind the experimental flag, so it can be tried on a phone from the website. Its feel and pacing gates are still open (see TODO).
- Navigation is the same in every game, the style is not: back top left, menu top right, a drawer from the right. New games use `GameNav` from the start.
- A game's own menu is laid out the same way everywhere too (`GameLobby`): daily, variants, difficulties, Play, levels with stars, in that order, with the balance as the way into the shop. A game leaves out what it doesn't have. Games with runs (Unscrew, Wallbreaker's Run, Classic's checkpoints) show the grid but only let you start where the rules allow.
- Adding models reshuffles which object each 3D level number shows. Saves hold no objects, so the save key stays `unscrew.v2`.
- Grow the models one category at a time; vehicles and industry first, as they are still empty.
- The level order of the models is written down in one list (`MODEL_ORDER` in `models/order.js`), apart from the files, so moving a model between files or reordering script tags never changes a level. New models go at the end.

**Next**
- Wallbreaker's feel gate on a real phone, then the pacing playtest.
- Issue **U-2**: the report shows the older models silently drop 5–45% of their parts, some of them visibly (a gap in the cottage's wall). Fix model by model.
- U-1 step 3: with twenty-four models, make the level picker avoid two models of one category in a row.
- More models from the catalogue.
- Crystal Reels' end-to-end test fails "the pick feature screen appeared" on this machine, also on the commits before today's navigation work; find out why.
- Move Outbound's and Graphite's own lobby code onto `GameLobby` when they're next touched (they already look the part).
- `npm test` on Node 20 (this machine) stops at two steps that need Node 22: `tests/puzzles.mjs` (`require()` of an ES module) and `node --test` with a glob. Use Node 22 as `package.json` asks.

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
