# Bubbleworks

A bubble shooter in space. Aim a launcher, bounce off the walls, pop groups of three or more of a colour and drop everything that hangs from them. Three modes on one engine (Classic, Levels, Endless), a daily level, powers you collect on the board, and stardust you earn by playing.

The code is in [`games/bubbleworks/`](../games/bubbleworks/). Play it with `npm run dev`.

**Status: first version, built on 27 November 2026.** On the hub with a "New" tag. Needs a playtest on a phone: see [Open questions](#open-questions).

## Design principles

- One engine, three rule sets: every mode shares the same grid, aiming, flight and powers.
- The mission rules ([MISSION.md](../MISSION.md)): no lives on a timer, no "buy 5 more shots" for money, retrying is always free and instant, quitting costs nothing, fully offline.
- **Powers are earned in play, never bought.** The store versions of this genre sell boosters and extra moves; here powers only come from the board.
- Fair: you're only dealt colours that are still on the board, and the aim line is the shot's real path (the same function computes both).
- Colour is never the only clue: every colour has its own symbol (ring, triangle, star, square, diamond, plus).
- Portrait phone first, one thumb. The field sits low on the screen so the launcher is near the thumb.

## How it plays

- **Grid.** A hex grid 11 bubbles wide; every other row is shifted half a bubble and holds 10. The field is 352 × 440 units.
- **Aiming.** Put your thumb anywhere above the launcher and drag: the launcher points at your thumb and a dotted line shows the path, including the first bounce off a side wall (150 units past it). Let go to fire; drag back below the launcher to cancel. Keyboard: ← → to aim (Shift for fine), Space or ↑ to fire, X to swap, 1–3 for the tray, R to restart.
- **Swap.** Tap the launcher (or the next bubble beside it) to swap the current and the next bubble.
- **Flight.** The path is worked out at once in 4-unit steps (so a shot can't skip past a bubble), bouncing off the side walls. A shot sticks when its centre comes within 0.8 of a bubble's width of another bubble (a little forgiving, as in every bubble shooter), or at the ceiling, and snaps into the nearest free cell that touches something.
- **Pop and drop.** Three or more touching bubbles of one colour pop. Then everything no longer connected to the top row falls off.
- **Score.** 10 per popped bubble, 30 per dropped one, +10% for every shot in a row that pops something (up to +100%).
- **Obstacles** (Levels, and stones in later Classic stages): **asteroids** (stones) can't pop, only drop. **Ice** doesn't match until a pop next to it thaws it.

## Modes

| Mode | Goal | Pressure | Ends | Stardust |
|---|---|---|---|---|
| **Classic** | Clear the screen, then the next stage starts. Endless stages; the boards are the same in every run, the deal differs. | The ceiling drops one row after every 8 shots that pop nothing (7 from stage 5, 6 from 10, 5 from 15). Pips by the launcher count down. | A bubble crosses the line | A stage you clear for the first time ever pays like a level of its tier |
| **Levels** | A goal per level: **clear every bubble**, **rescue the aliens** (pop or drop their bubbles) or **collect** a number of one colour. Tall levels scroll. | A shot budget | Out of shots: retry, or +5 shots (help, below) | New stars only (rule 2 of [ECONOMY.md](ECONOMY.md)) |
| **Endless** | Survive and score | A new row pushes in every 7 shots, one shot sooner every 12 rows, down to every 3. A shot that pops and drops 6 or more doesn't count. Colours grow from 4 to 6. | A bubble crosses the line | Every 10 rows past your best pays once |
| **Daily level** | One Levels board per date, built from the date (a level from the middle of the game) | As Levels | As Levels | Daily pay and streak (rule 6), priced as Hard |

Stars in Levels: at most 60% of the budget used is 3 stars, at most 80% is 2, else 1. Any help takes a star (rule 3).

### Levels: how they're made

`src/levels.js` builds each board from the level number: rows (5 to 24), colours (3 to 6), a shape (full, vee, pillars, arch, wave; shapes only open up in the bottom rows), often mirrored, colours in clusters but **no same-colour group bigger than 6**. Then stones, ice, the aliens (in the top third) or the colour to collect, and power bubbles.

| Level | Introduces |
|---|---|
| 1 | Clear every bubble |
| 3 | First power bubble (Bomb) |
| 5 | Prism |
| 6 | Rescue the aliens |
| 8 | Asteroids (stones) |
| 9 | Laser |
| 11 | Collect a colour |
| 12 | Comet |
| 14 | Ice |
| 18 | Black hole |

A board is kept only if the autoplayer (`src/bot.js`: tries 73 angles for both bubbles and each power, plays each out on a copy, takes the best) finishes it, and needs at least `4 + n/6` shots (capped at 14), so no level is over in one lucky shot. Otherwise it's made again with a new salt. The budget is the autoplayer's shots × 1.7 (levels 1–10), × 1.5 (11–30) or × 1.4, plus 3.

The autoplayer is slow on big boards (up to about 0.3 s on a desktop), so **`npm run bubbleworks:levels`** works out levels 1–300 once and stores each level's salt and the autoplayer's shots in `src/levels.gen.js`. Starting a level is then instant, and every device gets exactly the same budget. Levels past 300 and the daily are worked out when they're played. The test fails if the stored results no longer match the generator.

Tall levels scroll so the lowest bubbles sit in row 9, but never so far that a gap a shot could fly into is out of view (the engine floods the empty cells from below to find the highest reachable one).

## Powers

Some bubbles carry a power icon. Pop or drop one and the power goes into the **tray** (3 slots; a fourth is lost, with a toast). Tap a power to load it (tap again to unload), then aim and fire as usual. **A power shot doesn't use a shot.** In Classic and Endless, dropping 10 or more bubbles in one shot also puts a random power in the tray.

| Power | What it does |
|---|---|
| **Bomb** | Clears everything within 2.1 bubble widths of where it lands, stones too |
| **Prism** | Takes the colour (of its neighbours) that makes the biggest group |
| **Laser** | Clears the whole row of the bubble it hits |
| **Comet** | Flies through every bubble in its path up to the ceiling, popping them |
| **Black hole** | Removes every bubble of the colour it hits |
| **Freeze** | Classic and Endless only, works when tapped: the ceiling or the push stops for 5 shots |

Power odds on the board (Classic and Endless): Bomb 5, Prism 5, Laser 4, Comet 3, Freeze 3, Black hole 1.

## Stardust (economy)

Bubbleworks follows the arcade's [economy rules](ECONOMY.md) with the shared `Economy.register` ([`economy.js`](../games/bubbleworks/economy.js)). The currency is **stardust**.

| | Easy (1–15) | Medium (16–40) | Hard (41–80) | Expert (81+) |
|---|---|---|---|---|
| 3-star clear pays | 20 | 35 | 60 | 100 |
| Aim+ (peek): the whole aim line and where the bubble sticks, for the rest of the level | 10 | 18 | 30 | 50 |
| +5 shots (boost), doubles per use in a level | 40 | 70 | 120 | 200 |

Players start with 70. Help exists only in Levels and the daily (priced as Hard), and always takes a star. Classic stages pay like a level of their tier the first time you clear them (stages 1–3 Easy, 4–7 Medium, 8–12 Hard, then Expert); Endless pays for every 10 rows past your best (10 Easy, 20 Medium, 30–40 Hard, then Expert). Powers can't be bought, with stardust or anything else.

## How it's built

| File | What |
|---|---|
| `src/config.js` | Every number: grid, aiming, flight, score, Classic, Endless, powers, Levels' budget and stars |
| `src/rng.js` | Seeded generator and hashing. **Frozen.** |
| `src/grid.js` | The honeycomb (rows shift by `parity`, so a row can be pushed in on top), `trace` (the flight), `snap`, `group`, `floating`, `resolve` (a shot's whole outcome, including every power), Endless' new rows |
| `src/engine.js` | `Game`: the launcher, deal, tray, `fire()` → flight, `land()` → events; the three modes' rules; the Levels scroll |
| `src/bot.js` | The autoplayer |
| `src/levels.js` | Levels, the daily, Classic stages, Endless' start. **Frozen** (fingerprinted). |
| `src/levels.gen.js` | Generated by `npm run bubbleworks:levels` |
| `src/render.js` | Canvas 2D: starfield (cached), bubble sprites (cached per size), the launcher, the aim line, effects. Draws only while something moves. |
| `src/audio.js` | Synthesised sounds |
| `game.js` | Input, the frame loop, HUD, tray, help, stardust, the lobby (daily, modes, Play, levels), results, saving. Exposes `window.Bubbleworks` for the tests. |
| `economy.js`, `strings.js` | Prices; English and Dutch |

Saves under `bubbleworks.v1`: mode, stardust, Levels' stars, best Classic and Endless runs and how far they've paid, the daily (date, stars, streak), sound and vibration.

Tests: `npm run test:bubbleworks` (rules in Node: grid, flight never skips a bubble, pop/drop, stones and ice, every power, dealing, Classic's ceiling and stages, Endless' push, Freeze, the tray, Levels' goals and +5, levels 1–60 match `levels.gen.js` and are finished in budget, frozen fingerprints, introduction order, no hidden gaps on scrolled levels, the daily, the economy) and `tests/bubbleworks/e2e.mjs` (a phone browser: real touches to aim, cancel and swap, the tray, help, running out of shots, winning a level, every mode).

## Open questions

- [ ] **Feel on a phone**: shot speed (1,150 units/s), the forgiving hit distance (0.8 of a bubble), how far the aim line reaches. All in `config.js`.
- [ ] **Difficulty**: the autoplayer survives Endless for 600 shots and gets through Classic stage after stage, so for it both modes are easy. People will be slower and less exact. A playtest decides whether Endless should push faster or Classic's ceiling drop sooner.
- [ ] Level budgets: the early levels are generous (level 1: 34 shots for a board the autoplayer clears in 18). Tune `levels.slack` after a playtest; then run `npm run bubbleworks:levels` and update the fingerprints.
- [ ] Name check: confirm that "Bubbleworks" is free in the stores (see [NAMING.md](NAMING.md)).
- [ ] Sounds are synthesised placeholders.
- [ ] Not built from the plan: cloud bubbles (hidden colour) and fixed wall blocks. Could come as later obstacles.
