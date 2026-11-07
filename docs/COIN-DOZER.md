# Coin Dozer

A mobile-first coin pusher with no ads. You drop coins onto a shelf, a moving pusher shoves the pile toward the front edge, and whatever falls over the edge is yours. This file covers the plan (from *Coin Dozer – Game Specification*, 7 November 2026), how the code is built, where it differs from the spec and why, and where each acceptance criterion is checked.

The code is in [`games/coin-dozer/`](../games/coin-dozer/). Play it with `npm run dev`.

## Design pillars

1. **The push is the game.** Real rigid-body physics: coins stack, slide and tip, and a shove that tips one stack can tip the next.
2. **Honest.** No ads, no energy timers, no real-money purchases. When the bank is empty and no coin is falling, the player gets 10 coins at once, every time, so nobody is ever locked out.
3. **Short sessions.** The game opens straight into play with the last saved board, and it is safe to close at any time.
4. **Juicy.** Sound, vibration and visuals scale with the size of the moment.
5. **Tunable.** Every number lives in [`src/config.js`](../games/coin-dozer/src/config.js).

## How it's built

| File | What it does |
|---|---|
| `src/config.js` | **Every number**: physics feel, board size, pusher, drops, prizes, events, anti-stall, economy, feedback, performance. Versioned. Tune here. |
| `src/board.js` | The physics board in a [Rapier](https://rapier.rs) world: shelf, back wall, side rails, gutter covers, kinematic pusher, coins and prizes. Fixed 60 Hz step. Reports landings, wins (front edge) and losses (sides). Saves and restores a compact snapshot. No DOM. |
| `src/machine.js` | The rules on top of the board: bank, drops and their rate limit, auto-drop, nudges, gold and lucky coins, prize replenishment, cascades, coin shower, fever, jackpot, wide shelf, anti-stall, the coin cap and the lifeline. One seeded generator for everything random. No DOM. |
| `src/economy.js` | Pure functions: starting bank, lifeline, coin values, credits, milestones, collection, Workshop prices and themes. |
| `src/save.js` | The save under `coin-dozer.save`, versioned, with migration and a memory fallback when storage is blocked. |
| `src/shapes.js` | Gem cuts shared by physics and rendering, so a gem collides exactly as big as it looks. |
| `src/themes.js` | The four machine themes: colours, sound palette, gem colours, and 8 figures each, built from primitives. |
| `src/render.js` | three.js (the arcade's shared r128). Instanced coins (one draw call per coin kind), prizes, particles, camera fit and shake, aim ghost, thumbnails. |
| `src/audio.js` | Synthesised sound (WebAudio, no files). At most 12 voices; the quietest one is cut first. |
| `game.js` | The shell: input, the fixed-step loop with interpolation, HUD, the four screens, haptics, saving. Exposes `window.CoinDozer = { init, pause, resume, destroy }`. |
| `sw.js`, `manifest.webmanifest` | Offline install for the browser version, as Wallbreaker does. |

**Physics engine.** Rapier (`@dimforge/rapier3d-compat` 0.19.3, Apache-2.0) is vendored in [`shared/vendor/rapier/`](../shared/vendor/rapier/) next to three.js, so it loads with no network and no bundler. It is an ES module with the WebAssembly embedded (2.2 MB). Coins are rounded cylinders (smoother stacking and tipping), the pusher is a kinematic body, falling coins use continuous collision detection, and resting bodies go to sleep. The same file runs in Node, so the tests and the simulation use the real engine.

**Board.** Units are coin diameters. The shelf is 7 wide and 10 deep. The pusher moves 3 diameters over a 2.4 s cycle at constant speed. It is 0.62 tall, so coins can ride on it, and the back wall hanging just above it sweeps those riders off as it pulls back. Side rails run from the back to z = 1.6; in front of that the sides are open gutters. Coins drop from 3.2 above the back of the shelf, at the aim ±0.15 (seeded).

### Feel, and the cascade target

`npm run coin-dozer:sim` runs a seeded player who keeps auto-drop on and wanders the aim across the shelf. It reports the cascade rate, the payout and any physics problem. With the default config it measures **a cascade of 5+ coins in about 1 of every 4–5 advances**. That is inside the accepted range (1 in 10 to 1 in 3), a little more often than the 1-in-6 target. Over 9 minutes the bank stays around where it started: coins come and go, prizes and credits accumulate. The two numbers that move this most are `board.sideOpenFrom` (more gutter means fewer coins over the front) and the friction values.

Tuning found one loop that had to be broken. A cascade of 15 starts a coin shower, the shower's coins fill the board, and that could set off another 15-coin cascade and another shower, without end (one simulated bank grew to 1,000+ coins). A cascade-triggered shower therefore waits until 40 s after the previous shower ends (`events.cascadeCooldown`). Lucky coins still always start one.

## Where this differs from the spec (the codebase wins, as the spec says)

| Spec | Built | Why |
|---|---|---|
| English strings in one file | English **and Dutch** in `strings.js` | Every arcade game ships both; the hub's language choice applies here too. |
| Top bar with a settings button | Top bar shows bank, credits and the collection count only; Settings is on the pause card | AC 20 requires every button in the bottom 35% of the screen. The bottom bar holds pause, prizes (collection), nudge and auto-drop. |
| Pause card: Resume, Workshop, Settings, Exit | Also **Collection** | So the collection is reachable from pause as well as from its own button. |
| Gems give "1 collection item" | A theme's 12 collectibles are **its 4 gems (one per colour) and 8 figures** | This is how "gem: 1 collection item" and "12 collectibles per theme" fit together. Each gem colour has its own cut, so gems differ by shape as well as colour. |
| Lucky coin: value "triggers a lucky bonus" | It also pays 1 coin (`values.lucky`) | So the bank still ticks when it falls. Set it to 0 in the config if wanted. |
| Jackpot "worth 50 coins" | Always 50, not doubled by fever | A jackpot can only happen during fever, so a doubled jackpot would always be 100. |
| Coin shower from a 15+ cascade | ...unless a shower ended in the last 40 s | Breaks the shower → cascade → shower loop described above. |
| Starting bank "+25 coins at new game" | Settings has **New board** (confirm once): a fresh board with the starting bank; credits, upgrades and prizes are kept | Otherwise a "new game" only happens on reset, which wipes the upgrade. |
| Auto-drop "stops when the bank is empty" | It switches off on the drop that empties the bank | Otherwise the lifeline refills the bank before the next tick and auto-drop never stops. |

## Acceptance criteria and where they are checked

**Unit** = `tests/coin-dozer/rules.test.mjs` (Node, real physics). **Sim** = `tests/coin-dozer/sim.test.mjs`. **E2E** = `tests/coin-dozer/e2e.mjs` (headless phone browser on `dist/`). All three run in `npm test`.

| # | Criterion | Checked |
|---|---|---|
| 1 | New game: ~60 coins, 3 prizes, bank 50 | Unit + E2E |
| 2 | Drag on the lower half moves the ghost and guide line, clamped | Unit (clamp) + E2E (drag, ghost) |
| 3 | Release drops one coin, −1; second within 0.25 s ignored | Unit + E2E |
| 4 | Pusher: 2.4 s cycle, 3-diameter stroke, nothing passes through | Unit (timing, speed, a squeezed 72-coin pile over 10 cycles) |
| 5 | Front edge pays by type, coin removed | Unit |
| 6 | Side loss doesn't change the bank | Unit |
| 7 | No jitter or drift at rest; stacks hold; no explosion or tunnelling | Unit (sleep and no drift over 3 s; a stack of 4; squeeze test) |
| 8 | Cascade 5+ in about 1 in 6 advances (1 in 10 to 1 in 3) over 200 | Sim |
| 9 | Gold ~1 in 25; 2–4 gems and 1 figure kept | Unit |
| 10 | Gem +10 and an entry, figure +25 and an entry, duplicates credits only | Unit |
| 11 | Lucky → shower; 15 in one advance → shower; 3 gems in 60 s → fever; effects | Unit (each trigger, fever ×2 and +25% speed for 15 s, jackpot, wide shelf for 10 drops) |
| 12 | One rain event at a time, at most 2 queued | Unit |
| 13 | Anti-stall order, no message | Unit (settle at 3 cycles, free coins at 5, prize push; no events beyond normal play) |
| 14 | Lifeline: 10 coins at once, no wait, ad or limit | Unit (5 rounds in a row) |
| 15 | Workshop deducts, applies at once, persists; blocked with a message | Unit + E2E |
| 16 | Themes unlock for their cost; theme doesn't change physics | Unit (same seed, two themes, identical boards) |
| 17 | Milestones once | Unit |
| 18 | Auto-drop every 0.8 s at the aim; stops on an empty bank | Unit + E2E |
| 19 | Nudge: 3 charges, 1 per 60 s of play, wakes sleeping coins | Unit + E2E |
| 20 | Buttons ≥ 44 × 44 px in the bottom 35% | E2E (every visible button on the game screen) |
| 21 | Sound, vibration, shake switch off and stay off; shake off with reduced motion | E2E |
| 22 | Cascade pitch, haptics and shake grow with size, capped | `game.js` `onMachine("won")` and `audio.js` `cascade()` (capped at 8 steps, 20–60 ms, `shakeMax`); **listen and feel on a phone** |
| 23 | 60 fps with 250 coins; > 30 fps in a shower | **Not verified here** (needs the phone). Sim reports ms per physics step: about 1.2 ms on a desktop with 150–200 bodies |
| 24 | Beyond 250, the oldest settled coin farthest from the edge fades, nothing else changes | Unit (a smaller cap, same code) |
| 25 | Reopen restores bank, credits, upgrades, collection, settings, board | Unit (snapshot round trip) + E2E (reload) |
| 26 | Corrupt or missing save → fresh start, no crash | Unit + E2E |
| 27 | No ads, trackers, purchases; offline after first load | Unit (source scan) + E2E (no outside request; reload offline) + `tests/smoke.mjs` |
| 28 | Seeded headless run of 10,000 cycles: no exceptions, NaN or out-of-bounds coins | `npm test` runs 230 cycles; CI's `coin-dozer-sim` job runs **10,000** (`npm run coin-dozer:sim -- --cycles 10000 --check`, about half an hour) |

### Not verified here (needs a person and a phone)

- **The feel gate** (build step 2): watch it on a real phone and accept the push before tuning anything else. Physics numbers are in `config.js` (`physics`, `board`).
- **60 fps** with 250 coins and **30+ fps in a coin shower** on a mid-range 2020 phone. Particle counts already thin out by themselves (`performance` in the config). If the phone struggles, the next levers are shadow-map size in `render.js` and `physics.solverIterations`.
- **Load time** (3 s on a typical connection) and **memory** (under 150 MB). The game downloads about 2.4 MB the first time (Rapier is 2.2 MB of it) and nothing after.
- **Sound**: all synthesised placeholders; listen and tune.

## Tools

- `npm run coin-dozer:sim` (`-- --cycles N --seed S --check`): the seeded headless player described above.
- `npm run test:coin-dozer`: the unit and simulation tests only.

## Open questions from the spec (defaults taken)

- [x] Credits per game, as in the other arcade games: **yes**.
- [x] Rendering and physics stack: **three.js r128** (the arcade's copy) **+ Rapier**.
- [ ] Final name: **Coin Dozer** for now.
- [x] Themes in v1: **all four** (Classic, Space, Candy, Ocean), with 12 prizes each.
- [x] Tutorial beyond the one-time hint: **no**.
- Hazard modifier (bomb tokens): the physics and rules are in (`hazard` in the config, off); no gameplay or setting yet, as the spec says.
