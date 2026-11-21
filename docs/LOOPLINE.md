# Loopline

A colour-clearing puzzle in a chunky pixel style. A pixel picture (or, in Orbit, a voxel sculpture) sits inside a loop, and you clear it colour by colour. **The order you send things in is the puzzle.** Three modes, each with three difficulty tracks (Easy, Medium, Hard):

| Mode | What rides the loop | What you send | The yard |
|---|---|---|---|
| **Depot** | the picture's **pixels**, on trays | **buses** to one **stop**, where pixels of their colour get on | a jammed **car park**: a bus can only leave if nothing stands in front of its nose |
| **Critters** | **critters** | critters, which pop **blocks** of their colour | **lanes**: only the front critter of a lane can go; on harder tracks the ones behind keep their colour secret ("?") |
| **Orbit** | **critters**, round a **3D voxel sculpture** of 10,000 to 16,000 blocks | critters, which pop blocks of their colour on **every layer** | lanes, as in Critters |

The genre is sometimes called "pixel shooter" or "bus jam" in the stores. Loopline is our own take on it: our own pictures, sprites, rules and level generator.

## Depot: the bus stop

Rules in `src/depot.js`.

1. The picture empties through **two doors**: the left half by the left door, the right half by the right door. Each half goes from its **outside column inwards**, each column **from the top down**. The next pixel out of each door pulses; the three after it are marked.
2. Round the picture runs a loop of **trays** that turns clockwise, one tray per tick. A pixel steps onto an empty tray as it passes its door. Fewer trays make a busier loop (Hard).
3. Under the loop is the one **stop**, with a row of **docks** (4 on Easy, 3 on Medium and Hard, 2 on every fourth Hard level). Tap a bus that can leave the car park and it drives to a free dock (7 ticks).
4. Each tick, the pixel at the stop gets on a docked bus of its colour if one has a seat left. A **full bus drives away** and frees its dock. Pixels with no bus ride round again.
5. When nothing can happen any more (no pixel on the loop has a bus with a seat, no pixel can get on the loop), the loop **stops and waits**. If it stops with **every dock taken**, you're jammed: the level is lost.

A bus's seats match the pixels it will carry exactly, so every bus leaves full in the end. The puzzle is which bus to bring when: a bus whose colour isn't on the loop (yet) blocks a dock.

## Critters: round the loop

Rules in `src/engine.js`.

1. Tap the front critter of a lane. It rides onto the loop at the bottom-left corner and goes round once, clockwise.
2. At each step along a side it looks straight into the picture. If the **first block it sees** has its colour (empty cells don't count), it pops it: **one per step**. The block behind shows from then on.
3. The number on a critter is how many it can still pop. After its lap a critter with **0 left** is done. One with **pops left parks in a bay**; tap it to send it round again.
4. If a critter comes back with pops left and **every bay is full**, the level is lost. If nothing that can go can pop a block and no lane critter can be parked, it's stuck (also lost).
5. Up to **4 critters** ride at once, two steps apart; the one in front acts first.

## Orbit: Critters in 3D

Rules in `src/orbit.js` (a subclass of Critters' `Game`); everything not listed here is Critters'.

1. A **sculpture** of w × h × d blocks (h is the height) stands on a turntable. The loop runs round its **footprint** (w × d), exactly like Critters' track round a picture.
2. At each step along a side a critter looks straight in on **every layer at once**, bottom to top. On each layer it pops the **first block it sees** if that has its colour, while it has pops left. So one step can pop a whole column of blocks.
3. Sculptures are solid: peeling the outside shows the inside (a planet's crust, mantle and core; an apple's flesh and pips; a geode's quartz and amethyst; a cake's layers).
4. **Drag** anywhere outside the bays and lanes to turn the view (the mouse wheel zooms). Turning only changes the view, never the rules.

**Sculptures** (`src/sculptures.js`) are shapes in maths, not drawn grids, so each can be built at any size: `sculptFor()` takes the smallest grid that gives at least the target number of blocks. A `body()` gives the inside, an optional `skin()` the outermost blocks (sprinkles, eyes, stickers). 22 drawn ones (thin, tall ones like the snowman and the rocket only on Easy, because they stay small), then endless seeded ones: layered candy, worlds, rock strata and totems. Their order and shapes are part of every Orbit level, like the pictures are for the other modes.

| | Easy | Medium | Hard |
|---|---|---|---|
| Blocks (grows every 4 levels) | ~10,000–11,500 | ~12,000–14,000 | ~14,000–16,000 |
| Critter sizes (pops) | 180–420 | 220–500 | 260–580 |
| Bays | 5 | 3 | 3 (every 4th: 2) |
| Lanes | 4 (3 on levels 1–2) | 5 | 5 |
| Hidden colours | no | from level 10 | yes |

Since November 2026 sculptures have **10,000+ blocks** (they had 1,000–4,900), to see how a phone copes: grids up to 64 blocks on a side (`sculptFor()` guesses the size from a small grid instead of trying every size), one instanced mesh, up to 2,400 flying blocks at once. A level has 35–65 critters. Each critter aims for a random size in its range, so a lap that could take hundreds of blocks of one colour stops somewhere along the way. Making a level takes 50–200 ms on a laptop; a hint usually under 100 ms (at most 2.5 s, then it says it found nothing and costs nothing).

## All modes

- **Undo is free and unlimited on Easy and Medium. On Hard it costs coins** (half a level's pay, every time): with free undo nothing is ever at stake, which is a big part of why Hard didn't feel hard. Losing on Hard offers a paid undo if you can afford it, otherwise Try again.
- **Hints cost coins** (half a level's pay): the hint button runs the solver from the current position and rings the mover to send next. A hint that finds nothing costs nothing. Restart is free and in the toolbar too.
- **Stars:** 3 when cleared without undo, hints or powers, 2 with up to two, 1 otherwise. Restarting a level resets the count.
- Each mode × difficulty is its own **track** with its own levels, progress and stars.

## Coins and powers

Clearing a level pays **coins** for every new star (the rules every game follows: [ECONOMY.md](ECONOMY.md); the numbers: `economy.js`). Prices follow the tier you're playing, and you pay at the moment a power is used, so nothing is bought ahead. Coins are earned by playing only.

| Power | Critters, Orbit | Depot | Kind (price) |
|---|---|---|---|
| **Hint** | rings the critter to send next | rings the bus | peek (½ level) |
| **Undo** on Hard | back to before the last send | same | peek (½ level) |
| **+1 Bay / +1 Dock** | one more bay for the rest of the level | one more dock | boost (2 levels, doubling per use in a level) |
| **Pick / Tow** | tap any critter in a lane, not just the front one; hidden colours show while it waits | a tow truck pulls any bus out of the car park, whatever is in its way | boost (2 levels, doubling) |
| **Laser / Magnet** | the next critter pops its colour **through other colours** for one lap (`takeColour`) | the next bus, as it docks, pulls in every pixel of its colour it has seats for: off the loop, then straight out of the picture | heavy (3 levels, doubling) |

- Pick and Laser **arm** on a tap (the button glows; tap again to put it away for free) and are paid when the send happens. Pick on a critter that could go anyway costs nothing.
- Undoing a send that used a power hands its coins back (`launch(m, { power })` keeps what it cost; `undo()` returns it as `undone`). An extra bay is not tied to a send and stays, undo included.
- The powers never break the "capacity = blocks" rule: they change *which* blocks a mover reaches or where it waits, never how many it takes.

## How levels are made (always solvable)

Every level comes from a seed (`"<mode>:<diff>:<n>:<attempt>"`), so Depot Hard level 12 is the same everywhere. `src/levels.js`:

0. **Hard only: make a few, keep the hardest.** Depot Hard makes 6 solvable candidates and Critters Hard 8, and keeps the one two stand-in players (`src/judge.js`) do worst on: a greedy one that sends whatever takes the most right now, and the same with a 25% chance of a random tap. Orbit Hard skips this (judging 15,000-block levels is too slow for a phone).

1. **Pick a picture.** Easy starts with the 15 small drawn pictures (8–14 cells), Medium and Hard with the 14 bigger ones (16×12 to 16×17, `LARGE` in `src/pictures.js`; symmetric ones are drawn as a left half and mirrored). Then endless seeded ones: creatures, quilts and waves, 10–12 cells on Easy, 13–15 on Medium, 15–18 on Hard.
2. **Play it forwards with the real rules**, making up each mover as it's needed:
   - **Depot:** whenever the loop stops, pick a colour riding it (weighted by how many ride, to the power `bias`) and send a bus of that colour. Its seats are what would get on. Sometimes (and always for tiny buses) it gets extra seats for pixels still in the picture, so it waits at its dock. At most `open` buses wait at once, so a dock is always free.
   - **Critters:** pick a colour that shows (weighted by how much shows, to the power `bias`), send a critter of it round; its capacity is what it took. Sometimes it parks and comes back later for more.
3. That list of sends is a solution. Place the movers so it can be played:
   - **Depot:** the car park is filled from the *last* bus to leave to the first. Each bus gets a spot with a clear way out past the buses already parked, preferably in *their* way (that's the jam; `jam` makes it denser on harder tracks).
   - **Critters:** in order over the lanes, so each lane keeps the solution's order.
4. **Replay** the solution with the real rules. Only a level that passes is used; otherwise the next attempt seed is tried.

`tests/loopline/rules.test.mjs` checks levels 1–30 of all nine tracks this way, checks that the solver also finds its own way through levels 1–10 (without the shortcut below), and pins fingerprints of a few levels per track. **Changing the generator, the pictures, their order or the RNG changes levels**, and saved stars would point at different puzzles. If you do it on purpose, bump the save key (now `loopline.v3`) and update the fingerprints.

**Hints** use the solver from the current position. It knows the positions along the level's made solution: as soon as its search reaches one, the rest of the made solution finishes it. That makes hints on 15,000-block Orbit levels fast, and Hard levels (whose obvious moves are often wrong) much quicker to search.

### Difficulty

`params()` in `src/levels.js`:

| | Easy | Medium | Hard |
|---|---|---|---|
| Depot docks | 4 | 3 | 3 (every 4th: 2) |
| Depot trays per cell of loop | 0.5 | 0.36 | 0.26 |
| Depot max seats | 12 | 18 | 24 |
| Critters bays | 5 | 3 | 2 |
| Critters lanes | 3 (2 on levels 1–2) | 4 | 4 |
| Critters hidden colours | no | from level 12 | yes |
| Critters max critter size | 12 | 18 | 30 |

Hard also has: **`bias`**, how the made solution picks its next colour. Easy and Medium follow the obvious move (weight = shows^1.5), so the obvious send is usually right. Hard leans the other way (Depot 0.5, Critters and Orbit −0.5), so the colour that shows most is often not the one to send yet. **`pick`**: see step 0 above. Critters Hard has 2 bays (was 3) and critters of up to 30 (was 24) that come back for more more often (`keep` 0.85).

How often the stand-in players win, without undo (levels 1–24, 8 tries each; `src/judge.js`). **Random** taps anything; **human** is greedy with a 25% chance of a random tap; **greedy** always sends what takes the most right now:

| | Easy | Medium | Hard before (Nov 2026) | Hard now |
|---|---|---|---|---|
| Depot (random / human / greedy) | 97 / 100 / 100% | 61 / 89 / 93% | 36 / 70 / 83% | **20 / 34 / 40%** |
| Critters | 100 / 100 / 100% | 73 / 88 / 100% | 49 / 73 / 94% | **27 / 46 / 57%** |
| Orbit (levels 1–12, 3 tries) | 100 / – / 94% | 44 / – / 97% | 31 / – / 94% | **19 / 28 / 69%** |

Greedy winning 94% of Hard levels is why Hard didn't feel hard: sending whatever popped the most almost always worked, and free undo took away what risk was left. Easy and Medium Depot and Critters levels are unchanged (fingerprints pinned), so their saved stars still hold. A thinking player does better than greedy; hidden colours and reading the doors add difficulty these players don't notice. Tune after playtesting.

## How it's built

```
games/loopline/
  index.html, style.css, strings.js   markup; the look (deep indigo, light rails, red toolbar, Lilita One + Baloo 2); English + Dutch
  fonts/                               the two fonts, vendored for offline play (scripts/vendor-fonts.mjs)
  economy.js                           coins: pay per tier and the kind (price) of every power (docs/ECONOMY.md)
  game.js                              app shell: taps, tick loop, HUD, toolbar, coins and powers, lobby (mode, difficulty, levels), result, saving
  src/config.js                        every number, and the 15-colour palette
  src/engine.js                        Critters' rules (track, take, launch, tick, park, lose, stuck, undo) and the car-park helpers
  src/depot.js                         Depot's rules (doors, ring, stop, docks, car park, quiet, lose, undo)
  src/pictures.js                      drawn pictures (small and LARGE) and the seeded picture makers
  src/levels.js                        level generator and difficulty (see above)
  src/solver.js                        depth-first search over whole sends, for hints and tests, every mode; shortcut via the made solution
  src/judge.js                         stand-in players (greedy, greedy with slips) that pick Hard levels and measure difficulty
  src/orbit.js                         Orbit's rules: Critters' engine, looking in on every layer
  src/sculptures.js                    Orbit's voxel sculptures (shapes in maths, any size) and the seeded makers
  src/render.js                        2D canvas: voxel pixels, rails, pixel-sprite critters and buses, effects
  src/render3d.js                      Orbit: three.js view (instanced blocks, voxel critters, drag to turn), and the flat bays and lanes on the 2D canvas
  src/audio.js                         synthesised sounds
```

- Time runs in **ticks**. Critters: one lap is 3 seconds whatever the picture's size. Depot: a tray every 0.075 s. The renderer blends between ticks. Frames run only while something moves.
- **Pixel sprites**: critters and buses are drawn from tiny letter grids (`CRITTER`, `busRows()` in `src/render.js`) onto small canvases per colour, then scaled up without smoothing.
- The layout fits every level between the HUD and the toolbar on phones down to 375×667; on short screens (≤ 700 px) the HUD and toolbar get slimmer and the yard gives up room so pixels stay at least ~9 px. On a 320×568 phone big Depot pictures get small pixels (6–8 px).
- The solver plays one send at a time (send, let everything run until it stops, repeat), which a player can always do too. Its answers can really be played.
- Saves under `loopline.v3`: mode and difficulty, per track (`"depot:hard"`) the highest level cleared and the stars per level, coins, sound and vibration. A `loopline.v2` save keeps its Easy and Medium Depot and Critters progress (same levels) and gets the coins those stars would have paid; Hard and Orbit start over (new levels). (`loopline.v1` had one track per mode with different levels; it is ignored.)
- `window.Loopline` exposes the game for the end-to-end test (`tests/loopline/e2e.mjs`), which plays levels with real taps.

## To playtest

- Depot: is the door order (outside column first, top down) readable from the pulsing marks? Is it clear why the loop stops?
- Hard after the November 2026 retune: hard enough now? Too hard? Is paying for undo on Hard fair, or should it be a few free undos per level?
- Orbit with 10,000–16,000 blocks on a real phone: frame rate while popping, time to make a level, battery. If it struggles, lower `target` in `params()` (and bump the save key).
- Powers: are +1 Bay, Pick and Laser (Tow and Magnet in Depot) worth their price? Is it clear that Pick and Laser wait for the next tap?
- Depot: does Hard feel like planning, or like luck? Are 2 docks on every fourth Hard level too harsh?
- Critters Medium: random tapping still wins ~84%. Fewer bays, or hidden colours earlier?
- Big pictures (16×17) on a small phone: are cells big enough to see?
- Colour-blind check: movers show a number, but colours alone tell the pixels apart. Brown, peach and orange in the owl are close.

## V2 ideas

- **Diorama:** Depot as a little 3D town (Orbit, the 3D Critters, is done).
- Orbit: tap a block to see which colours could reach it; a slow turntable spin while idle (costs battery).
- A picture album: every cleared picture collected.
- More yard twists: linked pairs that leave together, mystery buses, layered cells, a VIP dock.
- A daily level.
