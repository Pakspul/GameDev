# Bubble shooter (plan)

*Working title still open, see [Name](#name).* Aim a launcher, fire coloured bubbles into a honeycomb, pop groups of three or more, and drop everything that hangs from them. Three modes on one engine (Classic, Levels, Endless) and super powers you collect during play.

**Status: plan, nothing built yet.** Discussed on 27 November 2026. The choices marked *(proposal)* are suggestions and can still change; the [open questions](#open-questions) need an answer before or during slice 1.

## Design principles

- One engine, three rule sets: every mode shares the same grid, aiming, physics and powers (like Wallbreaker).
- The usual mission rules ([MISSION.md](../MISSION.md)): no lives on a timer, no "buy 5 more shots", retrying is always free and instant, quitting costs nothing, fully offline.
- **Powers are earned in play, never bought.** The store versions of this genre sell boosters and extra moves; ours only gives them out on the board.
- Fair: the bubble you get is always a colour that's still on the board, and the aim line never lies about where the shot goes.
- Portrait phone first, one thumb. A round of Classic or a level takes 1–4 minutes.

## Core rules

- **Grid.** A hex grid, 11 bubbles wide; every other row is shifted half a bubble and holds 10. The field is 360 × 640 units, like Wallbreaker. *(proposal)*
- **Aiming.** Put your thumb anywhere above the launcher and drag: the launcher points at your thumb and a dotted line shows the path, including the first bounce off a side wall. Let go to fire; drag back below the launcher to cancel. Mouse: the same; keyboard: arrows to aim, Space to fire.
- **Next bubble.** You always see the current and the next bubble. Tap the launcher to swap them (free, unlimited).
- **Flight.** Shots bounce off the side walls and stick when they touch a bubble or the ceiling. They snap to the nearest free cell next to what they hit. The simulation runs at a fixed step with swept collision, so a shot never slips through a gap that's narrower than a bubble.
- **Pop.** Three or more touching bubbles of the same colour pop.
- **Drop.** After a pop, every bubble that is no longer connected to the ceiling (flood fill from the top row) falls off. Dropped bubbles score more than popped ones, so cutting a big cluster loose is the skill.
- **Colours.** Up to 6 colours, each with its own symbol for colour-blind players. A colour that's gone from the board is never dealt again.
- **Danger line.** A bubble that settles below the line ends the round (Classic, Endless) or the attempt (Levels).
- **Score.** Pop 10 per bubble, drop 20 per bubble doubling per extra group dropped in the same shot, plus a combo bonus for consecutive shots that pop something. *(proposal; all numbers in `config.js`)*

## Modes

| Mode | Goal | Pressure | Ends | Rewards |
|---|---|---|---|---|
| **Classic** | Clear the screen, then the next stage starts (endless stages, seeded) | The ceiling drops one row every 8 shots that pop nothing; the counter on screen shows how many are left. Later stages: every 6, then 5. | A bubble crosses the line | Score; best score and best stage are kept. A cleared stage pays a bonus for shots left. |
| **Levels** | Each numbered level has a goal and a shot budget | Only the budget. Levels can be taller than the screen and scroll down as you clear the top. | Out of shots (retry for free) | 1–3 stars by shots left; the next level opens with 1 star |
| **Endless** | Survive and score | A new row pushes in from the top every N shots; N starts at 7 and slowly drops to 3. Popping a big group pushes the next row back by a shot. | A bubble crosses the line | High score |

**Level goals** *(proposal, introduced in this order)*:

1. **Clear the top**: pop or drop every bubble in the top row.
2. **Rescue**: free the little creatures caught in bubbles; one is free once its bubble drops or pops.
3. **Collect**: pop a set number of one colour.
4. **Clear the board**.

**Obstacles** in Levels (and in later Classic stages), one at a time: **stone** (can't pop, only drops), **ice** (a pop next to it thaws it into a normal bubble), **cloud** (hides its colour until a neighbour pops), **wall** (a fixed block shots bounce off).

Levels are generated from a seed with a fixed level order, like Wallbreaker: level N is the same for everyone, and the tests pin it. Every generated level is checked by a solver/autoplay before it ships (enough shots, every goal reachable).

A **daily level** (one seeded level per date, display-only streak) can come later; it costs little once Levels exists.

## Super powers

You collect powers **on the board**: some bubbles carry a power icon. Pop or drop that bubble and the power flies into your **power tray** (3 slots). Tap a power to load it as your next shot. Unused powers stay until the round or level ends, so collecting is a choice you plan for. *(proposal)*

| Power | What it does |
|---|---|
| **Bomb** | Explodes where it lands and clears everything within two cells (stones too). |
| **Rainbow** | Takes the colour it touches, picking the group that pops the most. |
| **Fireball** | Flies straight through bubbles, popping each one, until it hits the ceiling. Doesn't bounce. |
| **Lightning** | Clears the whole row it lands in. |
| **Colour wipe** | Removes every bubble of the colour it hits. The rarest one. |
| **Freeze** | Classic and Endless only: stops the ceiling or the push for 5 shots. |

Big moves also earn powers: dropping 10 or more bubbles in one shot puts a random power in the tray (if there's room). Levels place power bubbles by hand in the generator so a level never depends on luck.

## Economy

**Proposal for the first version: no currency.** Powers come only from the board, Levels gives stars, Classic and Endless give scores. That's the simplest honest version and there's nothing to balance yet.

Later, if coins are wanted (for example a power at the start of a level, or launcher and bubble themes), they follow [ECONOMY.md](ECONOMY.md): pay per new star, help costs a star, cosmetics at fixed prices.

## How it will be built

The same structure as Wallbreaker and Loopline: ES modules, plain 2D canvas, a frame loop only while something moves, English and Dutch.

| File | What |
|---|---|
| `src/config.js` | Every number: grid size, shot speed, scoring, ceiling and push rates, power odds. |
| `src/rng.js` | Seeded generator. Frozen once levels ship. |
| `src/grid.js` | Hex grid maths: neighbours, snapping, match flood fill, floating clusters. Pure, no rendering. |
| `src/engine.js` | The simulation: aiming, flight (fixed step, swept circle against circles and walls), snap, pop, drop, powers. Reports events (`pop`, `drop`, `land`, `lose`…). |
| `src/levels.js` | Level and stage generator, goals and obstacles, the introduction order. Frozen (fingerprinted by the tests). |
| `src/modes.js` | Classic, Levels, Endless as rule sets on the engine. |
| `src/render.js`, `src/audio.js` | Drawing, particles, the aim line; synthesised sounds. |
| `src/save.js` | Save under its own versioned key. |
| `game.js` | Lobby (from `shared/js/gamelobby.js`), sessions, settings, input. |

Tests in `tests/<slug>/`: rules in Node (snapping, matching, dropping, every power, the push and ceiling rules, frozen level fingerprints, every level solvable) and an e2e run in a headless phone browser.

### Slices

1. **Feel:** aim, aim line, shoot, bounce, snap, pop, drop, Classic with the ceiling. Play it on a phone before anything else.
2. **Endless.**
3. **Powers:** power bubbles, the tray, all six powers.
4. **Levels:** generator, goals, obstacles, stars, the level list.
5. **Polish:** theme, sounds, settings (colour-blind symbols always on, reduced motion, left-handed), hub card, HISTORY.md.

## Name

"Bubble Blast" is already the name of a well-known mobile game (a different tap puzzle), and "bubble shooter" is a generic store term, so neither works as the name. Some working titles to choose from, none checked yet (see [NAMING.md](NAMING.md) for the checks): **Popcorn Sky**, **Fizzline**, **Bubbleworks**, **Pop Parade**.

## Open questions

- [ ] Name (above).
- [ ] Look and theme: for example soda bubbles in a glass, an aquarium, or space. Each game in the arcade has its own look.
- [ ] Classic: ceiling every 8 shots without a pop, or on a clock?
- [ ] Endless: push by shots (calm, proposed) or by time (frantic), or both as two options?
- [ ] Powers: only from power bubbles and big drops (proposed), or also a charge meter?
- [ ] Economy: no currency in the first version (proposed)?
