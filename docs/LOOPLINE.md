# Loopline

A colour-clearing puzzle. A pixel picture sits inside a loop. You send movers round the loop, and each one takes cells of its own colour. **The order you send them in is the puzzle.** Two modes share one engine:

| Mode | Movers | Cells | The yard |
|---|---|---|---|
| **Depot** | buses | passengers | a jammed **car park**: a bus can only leave if nothing stands in front of its nose |
| **Critters** | round critters | blocks | **lanes**: only the front critter of a lane can go. From level 16 the ones behind the front show a "?" |

The genre is sometimes called "pixel shooter" or "conveyor shooter" in the stores. Loopline is our own take on it: our own pictures, art, modes and level generator.

## The rules

1. Tap a mover that can go. It drives onto the loop at the bottom-left corner and goes round once, clockwise.
2. At each step along a side it looks straight into the picture. If the **first cell it sees** has its colour (empty cells don't count), it takes that cell: **one per step**. The cell behind it shows from then on.
3. The number on a mover is how many it can still take. After its lap a mover with **0 left** is done. One with **room left parks in a bay**; tap it to send it round again.
4. If a mover comes back with room left and **every bay is full**, the level is lost. If nothing that can go can take a cell and the yard can't be emptied into a bay, it's stuck (also lost).
5. Up to **4 movers** can be on the loop at once, two steps apart; the one in front acts first.
6. **Undo is free and unlimited.** So are hints: the hint button runs the solver from the current position and rings the mover to send next.

**Stars:** 3 when cleared without undo or hints, 2 with up to two, 1 otherwise. Restarting a level resets the count.

## How levels are made (always solvable)

Every level comes from a seed (`"<mode>:<n>:<attempt>"`), so level 12 is the same everywhere. `src/levels.js`:

1. Pick a picture. First the 15 drawn ones in `src/pictures.js` (each mode has its own order), then endless ones from the seed: symmetric creatures, quilts and waves, growing from 11 to 16 cells.
2. **Play it forwards.** Again and again: pick a colour that shows somewhere, weighted to colours that show a lot, and send a mover of that colour round. Its capacity becomes what it took. Sometimes it takes everything it can see, parks and comes back later for more, so that bays matter in the solution too.
3. That list of sends is a solution. Place the movers so it can be played:
   - **Critters:** in order over the lanes, so each lane keeps the solution's order.
   - **Depot:** the car park is filled from the *last* bus to leave to the first. Each bus gets a spot with a clear way out past the buses already parked, preferably in *their* way (that's the jam).
4. **Replay** the solution with the real rules (`src/engine.js`). Only a level that passes is used; otherwise the next attempt seed is tried.

`tests/loopline/rules.test.mjs` checks levels 1–60 of both modes this way, checks that the solver also finds its own way through levels 1–30, and pins fingerprints of a few levels. **Changing the generator, the pictures' order or the RNG changes levels**, and saved stars would point at different puzzles. If you do it on purpose, bump the save key (`loopline.v1`) and update the fingerprints.

### Difficulty

`params()` in `src/levels.js`, by level number:

| Levels | Bays | Max capacity | Lanes (Critters) | Parks in the made solution |
|---|---|---|---|---|
| 1–2 | 5 | 10 | 2 | never |
| 3–6 | 4 | 14 | 3 | up to 1 at a time |
| 7–18 | 3 | 20 | 3 → 4 from 13 | up to 2 |
| 19+ | 3 (every 4th: 2) | 26 | 4 | up to 2 |

To get a feel for it, we measured how often a player who **taps at random** still wins. Levels 1–6: always; 7–18: about 80–90%; 19–50: about 50%. A thinking player does much better, and the car park and hidden critters add difficulty the random player doesn't notice. Tune after playtesting.

Two rules were tried and changed because random tapping won ~95% of hard levels:
- taking a **whole run** of matching cells per step, now **one cell per step**;
- 4 bays late on, now 3, and 2 on every fourth late level.

## How it's built

```
games/loopline/
  index.html, style.css, strings.js   markup, look (cream + asphalt, orange accent; purple in Critters), English + Dutch
  game.js                              app shell: taps, tick loop, HUD, lobby, result, undo, hints, saving
  src/config.js                        every number, and the 15-colour palette (append only)
  src/engine.js                        the rules: track, take, launch, tick, park, lose, stuck, undo (snapshots)
  src/pictures.js                      drawn pictures and the seeded picture makers
  src/levels.js                        level generator (see above)
  src/solver.js                        depth-first search over whole sends, for hints and tests
  src/render.js                        2D canvas: picture, loop, bays, yard, movers, effects
  src/audio.js                         synthesised sounds
```

- Time runs in **ticks**; one lap is 3 seconds whatever the picture's size. The renderer blends between ticks. Frames run only while something moves.
- The solver plays one mover at a time (send, let the loop run empty, repeat), which a player can always do too. Its answers can really be played.
- Saves under `loopline.v1`: the mode, per mode the highest level cleared and the stars per level, sound and vibration.
- `window.Loopline` exposes the game for the end-to-end test (`tests/loopline/e2e.mjs`), which plays levels with real taps.

## To playtest

- Does the order feel like a puzzle by level ~10? Or too easy, or too punishing?
- Is the "first cell it sees, one per step" rule clear from the tips and the animation?
- Depot car park: is it obvious which way a bus faces? (the windscreen marks the nose)
- Big pictures (16×16) on a small phone: are cells big enough to see?
- Colour-blind check: the movers show a number, but colours alone tell the cells apart.

## V2 ideas

- **3D (Orbit):** a voxel sculpture on a turntable, movers orbit it and peel layers; what's exposed depends on the side. **Diorama:** Depot as a little 3D town.
- A picture album: every cleared picture collected.
- More yard twists: linked pairs that leave together, mystery buses, layered cells.
- A daily level.
