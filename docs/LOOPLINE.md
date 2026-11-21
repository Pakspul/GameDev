# Loopline

A colour-clearing puzzle in a chunky pixel style. A pixel picture sits inside a loop, and you clear it colour by colour. **The order you send things in is the puzzle.** Two modes, each with three difficulty tracks (Easy, Medium, Hard):

| Mode | What rides the loop | What you send | The yard |
|---|---|---|---|
| **Depot** | the picture's **pixels**, on trays | **buses** to one **stop**, where pixels of their colour get on | a jammed **car park**: a bus can only leave if nothing stands in front of its nose |
| **Critters** | **critters** | critters, which pop **blocks** of their colour | **lanes**: only the front critter of a lane can go; on harder tracks the ones behind keep their colour secret ("?") |

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

## Both modes

- **Undo is free and unlimited.** So are hints: the hint button runs the solver from the current position and rings the mover to send next. Restart is in the toolbar too.
- **Stars:** 3 when cleared without undo or hints, 2 with up to two, 1 otherwise. Restarting a level resets the count.
- Each mode × difficulty is its own **track** with its own levels, progress and stars.

## How levels are made (always solvable)

Every level comes from a seed (`"<mode>:<diff>:<n>:<attempt>"`), so Depot Hard level 12 is the same everywhere. `src/levels.js`:

1. **Pick a picture.** Easy starts with the 15 small drawn pictures (8–14 cells), Medium and Hard with the 14 bigger ones (16×12 to 16×17, `LARGE` in `src/pictures.js`; symmetric ones are drawn as a left half and mirrored). Then endless seeded ones: creatures, quilts and waves, 10–12 cells on Easy, 13–15 on Medium, 15–18 on Hard.
2. **Play it forwards with the real rules**, making up each mover as it's needed:
   - **Depot:** whenever the loop stops, pick a colour riding it (weighted to colours that ride a lot) and send a bus of that colour. Its seats are what would get on. Sometimes (and always for tiny buses) it gets extra seats for pixels still in the picture, so it waits at its dock. At most `open` buses wait at once, so a dock is always free.
   - **Critters:** pick a colour that shows, send a critter of it round; its capacity is what it took. Sometimes it parks and comes back later for more.
3. That list of sends is a solution. Place the movers so it can be played:
   - **Depot:** the car park is filled from the *last* bus to leave to the first. Each bus gets a spot with a clear way out past the buses already parked, preferably in *their* way (that's the jam; `jam` makes it denser on harder tracks).
   - **Critters:** in order over the lanes, so each lane keeps the solution's order.
4. **Replay** the solution with the real rules. Only a level that passes is used; otherwise the next attempt seed is tried.

`tests/loopline/rules.test.mjs` checks levels 1–30 of all six tracks this way, checks that the solver also finds its own way through levels 1–15, and pins fingerprints of a few levels per track. **Changing the generator, the pictures, their order or the RNG changes levels**, and saved stars would point at different puzzles. If you do it on purpose, bump the save key (`loopline.v2`) and update the fingerprints.

### Difficulty

`params()` in `src/levels.js`:

| | Easy | Medium | Hard |
|---|---|---|---|
| Depot docks | 4 | 3 | 3 (every 4th: 2) |
| Depot trays per cell of loop | 0.5 | 0.36 | 0.26 |
| Depot max seats | 12 | 18 | 24 |
| Critters bays | 5 | 3 | 3 (every 3rd and 4th: 2) |
| Critters lanes | 3 (2 on levels 1–2) | 4 | 4 |
| Critters hidden colours | no | from level 12 | yes |

How often a player who **taps at random** still wins (levels 1–20, 10 tries each): Depot 100% / 65% / 40%, Critters 100% / 84% / 53%. A thinking player does much better; hidden colours and reading the doors add difficulty the random player doesn't notice. Tune after playtesting.

## How it's built

```
games/loopline/
  index.html, style.css, strings.js   markup; the look (deep indigo, light rails, red toolbar, Lilita One + Baloo 2); English + Dutch
  fonts/                               the two fonts, vendored for offline play (scripts/vendor-fonts.mjs)
  game.js                              app shell: taps, tick loop, HUD, toolbar, lobby (mode, difficulty, levels), result, saving
  src/config.js                        every number, and the 15-colour palette
  src/engine.js                        Critters' rules (track, take, launch, tick, park, lose, stuck, undo) and the car-park helpers
  src/depot.js                         Depot's rules (doors, ring, stop, docks, car park, quiet, lose, undo)
  src/pictures.js                      drawn pictures (small and LARGE) and the seeded picture makers
  src/levels.js                        level generator and difficulty (see above)
  src/solver.js                        depth-first search over whole sends, for hints and tests, for both modes
  src/render.js                        2D canvas: voxel pixels, rails, pixel-sprite critters and buses, effects
  src/audio.js                         synthesised sounds
```

- Time runs in **ticks**. Critters: one lap is 3 seconds whatever the picture's size. Depot: a tray every 0.075 s. The renderer blends between ticks. Frames run only while something moves.
- **Pixel sprites**: critters and buses are drawn from tiny letter grids (`CRITTER`, `busRows()` in `src/render.js`) onto small canvases per colour, then scaled up without smoothing.
- The layout fits every level between the HUD and the toolbar on phones down to 375×667; on short screens (≤ 700 px) the HUD and toolbar get slimmer and the yard gives up room so pixels stay at least ~9 px. On a 320×568 phone big Depot pictures get small pixels (6–8 px).
- The solver plays one send at a time (send, let everything run until it stops, repeat), which a player can always do too. Its answers can really be played.
- Saves under `loopline.v2`: mode and difficulty, per track (`"depot:hard"`) the highest level cleared and the stars per level, sound and vibration. (`loopline.v1` had one track per mode with different levels; it is ignored.)
- `window.Loopline` exposes the game for the end-to-end test (`tests/loopline/e2e.mjs`), which plays levels with real taps.

## To playtest

- Depot: is the door order (outside column first, top down) readable from the pulsing marks? Is it clear why the loop stops?
- Depot: does Hard feel like planning, or like luck? Are 2 docks on every fourth Hard level too harsh?
- Critters Medium: random tapping still wins ~84%. Fewer bays, or hidden colours earlier?
- Big pictures (16×17) on a small phone: are cells big enough to see?
- Colour-blind check: movers show a number, but colours alone tell the pixels apart. Brown, peach and orange in the owl are close.

## V2 ideas

- **3D (Orbit):** a voxel sculpture on a turntable, movers orbit it and peel layers; what's exposed depends on the side. **Diorama:** Depot as a little 3D town.
- A picture album: every cleared picture collected.
- More yard twists: linked pairs that leave together, mystery buses, layered cells, a VIP dock.
- A daily level.
