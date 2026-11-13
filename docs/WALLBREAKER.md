# Wallbreaker

A mobile-first brick breaker: seven modes on one engine, endless seeded levels, risky capsules you catch or dodge, and a shop for credits you earn by playing. This file is the plan (from *Wallbreaker – Game Plan & Acceptance Criteria*, 6 November 2026), how the code is built, and where each acceptance criterion is checked.

The code is in [`games/wallbreaker/`](../games/wallbreaker/). Play it with `npm run dev`.

## Design principles

- No ads, no energy timers, no real-money purchases, ever.
- Everything is earned by playing. Credits belong to Wallbreaker only; they are never shared with other games in the arcade.
- Fair modes stay fair: Daily, Puzzle and Time Attack ignore boosts, Workshop upgrades and risky capsules, so results can be compared.
- One engine, many rule sets: every mode shares the same physics, bricks, power-ups and shop.
- A level takes 1–3 minutes, quitting mid-level costs nothing, and the game works fully offline.

### Where Wallbreaker differs from docs/ECONOMY.md

The arcade's [economy rules](ECONOMY.md) are about *help in a puzzle* (hints, spare bolts) and price help in levels of the tier you're playing. Wallbreaker has no help to buy and no tiers; its plan has its own economy, with fixed prices. So it does **not** register with `shared/js/economy.js` and keeps its numbers in `games/wallbreaker/src/config.js` instead (and `tests/economy.mjs` doesn't check it; `tests/wallbreaker/rules.test.mjs` does). Two deliberate differences from the arcade rules:

- **Boosts are bought ahead and kept** (rule 5 says "never stock up"). In Wallbreaker a boost is a head start for one game, not help to get unstuck, and the plan wants a boost shelf. A boost is only used up when the first brick breaks, so quitting never wastes one.
- **Replays pay.** A level you already have 3 stars on pays 50%, not 0. Levels are short action levels and Classic replays levels after a game over, so a replay still takes real effort.

Everything else from the mission holds: nothing is for sale, no login bonus, the Daily streak is display only.

## How it's built

| File | What it does |
|---|---|
| `src/config.js` | **Every number**: physics feel, drop rates, durations, credits, prices, Workshop curve, cosmetics, Run perks. Versioned. Tune here. |
| `src/rng.js` | Integer hashing and a seeded generator (mulberry32); run codes. **Frozen**: changing it changes every level. |
| `src/levels.js` | Level 1, `generate(worldSeed, n)` (templates mirrored for symmetry, introduction schedule, steel cap, re-roll with a salt), bosses, Descent walls, the Daily, capsule drops per brick. **Frozen** (fingerprinted by the tests). |
| `src/walls.js` | The 30 Puzzle walls and 8 Time Attack walls, drawn as text. |
| `src/puzzles.gen.js` | Par and a solution for every Puzzle wall, written by `npm run wallbreaker:puzzles`. |
| `src/collide.js` | Swept circle against rectangles: a ball can't tunnel through a brick at any speed. |
| `src/engine.js` | The simulation: fixed 120 Hz step, balls, paddle(s), bricks, capsules, lasers, explosions, the aim-and-fire volley. Knows nothing about the screen; reports what happens through events. |
| `src/modes.js` | The seven modes as rule sets, and which modifiers (Workshop, boosts, Run perks) each lets in. |
| `src/economy.js` | What a level pays, Workshop prices, cosmetics. Pure functions over the config. |
| `src/run.js` | Run levels and the seeded power-up offers. |
| `src/save.js` | Save data under `wallbreaker.save`, versioned, with export and import. |
| `src/render.js` | Canvas 2D drawing, particles, capsule icons, the HUD rings, aim assist. |
| `src/audio.js` | Synthesised sound packs and a quiet music loop (WebAudio, no files). |
| `game.js` | Menus (the lobby from `shared/js/gamelobby.js`: the daily on top, a tab per mode, Play, boosts and the levels with their stars), the modes as sessions, shop, settings, input, the frame loop. Exposes `window.Wallbreaker = { init, pause, resume, destroy }`. |
| `sw.js`, `manifest.webmanifest` | Offline install for the browser version (network first, cached copy without a network). |

Levels are JSON (`{ kind, number, seed, bricks: [{ id, t, hp, c, r, w, h }] }`): the generator and the handcrafted walls produce the same format.

### Feel

- **Controls:** relative drag (the paddle moves as far as your thumb moves, wherever your thumb is), tap to launch, optional auto-launch. A mouse moves the paddle directly. Keyboard: arrows/A-D, Space, P/Esc.
- **Bounce angle:** set by where the ball meets the paddle, up to 60° from vertical at the edges. A ball clipping the edge (3 units of grace) counts as a hit.
- **Speed:** 390 units/s on level 1 (the field is 360 × 640), +1% per level, capped at 540 from level 39.
- **Anti-stall:** near-horizontal (within 12°) for more than 2 s → nudged to 24° from horizontal.
- **Fair misses:** when the last ball drops below the paddle, time runs at 30% until it's gone.
- **Two additions to the plan**, both found by letting an autopilot play 150 levels: a ball that touches nothing useful for 10 s gets a small random turn (it could loop between steel and walls forever), and a ball may take a portal at most twice per paddle hit (portal loops). With 3 or fewer bricks left and none broken for 15 s, the ball leans gently toward the nearest one (the "last brick hunt"). All three are in `config.js`.
- **Juice:** break particles, shake on explosions, haptics on paddle hits and breaks, a hit sound that climbs with the combo. Reduced motion turns off shake and flashes and thins the particles.

### Levels

Level 1 is the same fixed wall everywhere: four rows of normal bricks and a gift brick (it drops Wide Paddle, to teach catching). From level 2 the wall comes from `generate(worldSeed, n)`: Classic and Zen share one world seed, a Run has its own (shown as a six-character run code), the Daily uses the date. Every generated wall is checked: all breakable bricks reachable (flood fill from below; steel blocks, everything else can be broken through, portals connect), steel at most 15% and never next to other steel. A failing seed is re-rolled with a salt.

| Level | Introduces |
|---|---|
| 1 | Normal bricks and one gift brick |
| 2 | Tough bricks |
| 4 | Good capsules from normal bricks (and the pity rule) |
| 6 | Moving bricks |
| 8 | Steel |
| 10 | First boss; risky capsules (Classic and Run) |
| 12 | Explosive |
| 15 | Portal pairs |
| 20 | Regenerating |
| 25 | Ghost |

### Modes

| Mode | Rules | Fail | Credits | Boosts / Workshop / risky |
|---|---|---|---|---|
| Classic | Endless, boss every 10th | 3 lives; game over → restart at the last checkpoint (every 5th level) | Full | All |
| Zen | Same walls | None: a lost ball comes back | 25% | None |
| Descent | Aim and fire; the wall drops a row every 5 shots; +1 ball pickups | Wall reaches the line | Full | Boosts (Multiball Start, Extra Life = one push-back, Lucky Drops) and Workshop; no risky; Multiball, Fireball, Bomb Ball and Lightning only, collected on the spot |
| Run | Pick 1 of 3 power-ups after each level | 3 lives per run | Full, banked at run end (or when you end it) | Workshop and risky; no boosts |
| Daily | One wall per date (built like Classic level 8–19) | 3 lives, unlimited retries, best counts | 25 once per date | None |
| Puzzle | 30 handcrafted walls, aim and fire, par + 2 shots | Out of shots | First clear full, repeats 50% | None |
| Time Attack | 8 set walls, a lost ball adds 5 s, a medal opens the next wall | None | 5 / 10 / 15 for bronze / silver / gold, paid once per medal you improve to | None |

All-In "loses the level": in Classic and Run that costs a life and the level restarts; with no lives left it's game over.

Run starting options unlock by milestone: Wider paddle (reach level 5), Safety Net (level 10), Twin start (beat a boss), Extra life (level 20), Hot start (beat two bosses).

## Acceptance criteria and where they are checked

`npm test` runs both test files. **Unit** = `tests/wallbreaker/rules.test.mjs` (Node, `npm run test:wallbreaker`). **E2E** = `tests/wallbreaker/e2e.mjs` (headless phone browser on `dist/`).

| Criterion | Checked |
|---|---|
| **Core** | |
| Paddle follows relative thumb movement; finger never covers it | E2E: drag from the far corner moves the paddle by the drag distance |
| Bounce angle depends on the contact point | Unit |
| A ball at max speed never passes through a brick or wall | Unit: 400 shots at 3,000 units/s (4× the real max) at a thin brick |
| Near-horizontal > 2 s is nudged | Unit |
| Quitting mid-level costs nothing | E2E (credits, boost and progress unchanged) |
| **Levels** | |
| Level 1 identical everywhere | Unit (same object from every mode + frozen fingerprint) |
| Level N identical for all players | Unit (frozen fingerprints of levels 2–60 and a Descent wall) |
| Run code reproduces the levels | Unit + E2E |
| All breakable reachable, ≤ 15% steel | Unit: 300 Classic levels, 20 Run worlds × 40, 60 Descent walls; an autopilot also clears levels 1–30 |
| Introduction table, boss every 10th | Unit |
| **Modes** | |
| Seven modes start from the menu and follow their rules | E2E (start) + Unit (rules) |
| Zen: no fail state, pays 25% | Unit |
| Daily, Puzzle, Time Attack reject boosts, Workshop, risky | Unit |
| Daily: same wall and drops on the same date | Unit |
| Descent: a row every 5 shots, ends at the line | Unit |
| **Bricks and power-ups** | |
| Every brick type behaves as described | Unit (incl. portals, regeneration, explosive chains, boss weak spot) |
| Every good capsule: effect, duration, HUD ring | Unit (effect and duration); the ring is drawn by `render.js` `drawEffects` (see screenshots) |
| Taking an active capsule refreshes, never stacks | Unit |
| Pity rule: a drop after 15 bricks without one | Unit |
| **Risky capsules** | |
| Distinct, states its effect before it's caught | Red pulsing outline, a label under the capsule and a banner above the paddle; Unit checks the texts exist in both languages |
| Letting it fall has no effect; catching applies at once | Unit |
| Multiplier on brick credits only, adds, cap ×4 | Unit |
| All-In removes the net, ends the level on the next lost ball | Unit |
| **Economy** | |
| Credits per the formula, stored per game | Unit + E2E |
| No real-money purchase path | Unit (source scan) + E2E (shop) |
| A boost is consumed only after the first brick breaks | E2E |
| Workshop 1.6× curve, stops at max | Unit |
| 3-star replay 50%, no login bonus | Unit |
| Prices, rewards and rates from the config | Unit (source scan) |
| **Settings and quality** | |
| Colour-blind palette, reduced motion, left-handed, haptics toggle | E2E |
| 60 fps on the reference phone with 200 bricks and 12 balls | **Not verified here.** Unit checks the simulation's share: well under 1 ms per step with 200 bricks and 12 balls on a desktop. Needs the phone. |
| Installs and plays fully offline | E2E: reload with the network off after the first visit |

### Not verified here (needs a person and a phone)

- **The feel gate** (slice 1): play on a real mid-range phone and accept the ball and paddle before anything else is tuned. Ball speed, bounce angle and sensitivity are in `config.js` and the settings.
- **60 fps** with 200 bricks and 12 balls, and **touch-to-paddle latency under 50 ms**: the paddle moves in the touch handler itself, so latency is one frame, but measure it.
- **The pacing gate** (slice 3): `npm run wallbreaker:sim` lets an autopilot play and prints pay per level and when the first boost and cosmetic become affordable (today: first boost after level 2, first cosmetic after level 6, about 1.7 minutes per level). A playtest with people decides.
- Sound: the packs and the music loop are synthesised placeholders; listen and tune or replace (open item below).

## Tools

- `npm run wallbreaker:puzzles` solves every Puzzle wall with the real engine (beam search over aim angles) and rewrites `src/puzzles.gen.js`. Run it after changing a Puzzle wall or the physics; the test fails if a stored solution stops working.
- `npm run wallbreaker:sim [-- N run]` plays Classic (or a random Run world) with an autopilot: time, stars and pay per level.

## Open items (from the plan)

- [ ] Daily leaderboard: local best only (as built), or an online board (needs a backend, and the mission's network rules)?
- [x] Languages at launch: English and Dutch, like every game in the arcade.
- [ ] Name check: confirm that Wallbreaker is free in the app stores and as a domain.
- [ ] Sound and music: original assets or licensed packs? (Today: synthesised.)
- [ ] Descent power-up subset: confirm the four ball power-ups (built as Multiball, Fireball, Bomb Ball, Lightning).
- [ ] Classic checkpoints every 5th level: confirm or change (`checkpointEvery` in the config).
- [ ] All prices and rates are starting values; tune after the slice 3 playtest.
