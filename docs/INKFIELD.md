# Inkfield

*Working title.* A territory game in the style of the "draw a loop, claim the land" genre (Splix.io, Paper.io): leave your land, draw a trail, get back home, and the trail plus everything it encloses is yours. Cross someone's trail and they're out. Win by being the last one on the board. All opponents are computer players, so it plays fully offline.

**Status: prototype, experimental.** Playable in `npm run dev`, left out of release builds (`EXPERIMENTAL` in `scripts/build.mjs`). Its own name and look (ink on paper, ink-blob heads with eyes); only the genre's mechanics are shared with other games.

## Rules (as built)

- A square board of 220 × 220 cells. Everyone moves at the same speed and steers with a limited turning rate.
- Each player starts on a small disc of land. Outside your land you leave a trail.
- Back on your land: the trail and everything it encloses becomes yours, including other players' land.
- Out when: someone crosses your trail; you run into your own trail; someone takes your last bit of land. Your land goes back to nobody.
- The edge of the board stops you; it doesn't hurt.
- Heads that touch: nothing happens (only trails count). The old rule "the one off its land is out" is still there behind `headOn` in `src/config.js`.
- The match ends when you're out, or when you're the last one left (owning 100% means that too).

## How it is built

| File | What |
|---|---|
| `src/config.js` | Every number: board size, speed, turning, bot counts and skill per difficulty, colours, names |
| `src/sim.js` | The rules, no rendering. Owner and trail grids (one byte per cell), 4-connected trails, capture by flood fill from the land's bounding box, kills. Fixed 60 Hz step |
| `src/bots.js` | Computer players: plan a box-shaped loop, go home when an enemy could reach the trail first, hunt nearby trails. Going home uses a distance-to-home map (breadth-first search around their own trail) and short look-ahead "rollouts" with the real turning circle |
| `src/render.js` | three.js r128, top-down orthographic. The land is smoothed on the GPU into a picture only where it changed; every frame cuts it crisply and adds the darker side. Trails are growing ribbons; heads are ink blobs. Also the minimap |
| `src/audio.js` | Synthesised sounds, no files |
| `game.js` | The shell: input (drag anywhere as a floating stick, arrows/WASD, or point with the mouse), loop, HUD, lobby, result screen, saving (`inkfield.v1`) |

Tests: `npm run test:inkfield` (rules in `tests/inkfield/rules.test.mjs`, bot sanity bounds in `bots.test.mjs`). `npm run inkfield:sim -- 20 hard` plays bots-only matches and prints how players went out, for tuning.

Bots-only matches at Normal (10 matches): ~80% of outs are trails being cut, ~20% bots running into their own trail.

## Ideas for later (add-ons)

Pick-ups on the board, short-lived:
- **Dash**: a short burst of speed (also possible as a button with a cool-down).
- **Shield**: your trail survives one cut.
- **Ink bomb**: claims a circle of land where you pick it up.
- **Freeze**: nearby opponents slow down for a few seconds.

Board and modes:
- **Daily board**: a seeded match, the same for everyone that day (fits the other games' dailies).
- **Shrinking board**: the edge closes in over time, so matches can't drag on.
- **Obstacles**: rocks or water you can't claim, and that block trails.
- **Time attack**: reach 25% as fast as you can.
- **Gold cells**: claim them for coins, spent on cosmetic skins and trail patterns (earned only, see ECONOMY.md).

Bots: names with visible personalities (the careful one, the hunter, the greedy one); kill streak callouts.

## Open questions for the playtest

- Is the speed right on a phone? Is the camera zoomed in far enough?
- Matches with many opponents can last long: do bots need to fight each other more, or should the board shrink?
- Should head-on collisions count?
