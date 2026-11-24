# Loopline

A colour-matching puzzle in a chunky pixel style. In Critters and Orbit a pixel picture (or a voxel sculpture) sits inside a loop and you clear it colour by colour; in Depot a crowd walks a loop and you get everyone onto a vehicle of their colour. **The order you send things in is the puzzle.** Three modes, each with three difficulty tracks (Easy, Medium, Hard):

| Mode | What rides the loop | What you send | The yard |
|---|---|---|---|
| **Depot** | a **crowd** of people, walking in from 1–3 streams | **cars, vans and buses** to the **bays** at the stop, where people of their colour get on | a jammed **car park**, straight, diagonal or both: a vehicle can only leave if nothing stands in the way of its arrow |
| **Critters** | **critters** | critters, which pop **blocks** of their colour | **lanes**: only the front critter of a lane can go; on harder tracks the ones behind keep their colour secret ("?") |
| **Orbit** | **critters**, round a **3D voxel sculpture** of 10,000 to 16,000 blocks | critters, which pop blocks of their colour on **every layer** | lanes, as in Critters |

The genre is sometimes called "pixel shooter" or "bus jam" in the stores. Loopline is our own take on it: our own pictures, sprites, rules and level generator. (Depot's crowd-and-car-park layout was inspired by bus-jam games such as Bus Traffic Fever; its look, rules and levels are Loopline's own.)

## Depot: the crowd and the car park

Rules in `src/depot.js`, the car park's geometry in `src/lot.js`. Top to bottom on screen: the crowd, the stop with its bays, the car park.

1. People arrive in **one, two or three streams** (from the top, from the left and right, or all three). They step into the **loop**, a walkway with a fixed number of **spots** (44 on Easy, 38 on Medium, 34 on Hard) that walks round clockwise, one spot per tick. A stream's front person steps in when an empty spot passes their gate. The streams **take turns** (a zip), so each keeps moving. When the loop is **full**, the streams stand still.
2. At the bottom of the loop is the **stop**, with a row of **bays** (5 on Easy, 3 on Medium and Hard, 2 on every fourth Hard level). Tap a vehicle that can leave the car park and it drives round the road to a free bay (7 ticks).
3. Each tick, the person at the stop gets on a parked vehicle of **their colour** if one has a seat left. That frees their spot for the streams. A **car** seats 4, a **van** 6, a **bus** 10; the number under a bay is the seats left. A **full vehicle drives away** and frees its bay.
4. A vehicle drives **straight ahead** (the arrow on its roof) to leave the car park. It can go only if no vehicle still parked overlaps the strip in front of it. Vehicles stand at any of eight headings, so the strip can run straight or at 45°.
5. When nothing can happen any more (nobody on the loop has a vehicle with a seat, and the loop is full or the streams are empty), the game **waits for you**. If it waits with **every bay taken**, you're jammed: the level is lost.

The crowd **keeps walking** while the game waits; that changes nothing, because everyone on the loop passes the stop within a lap and the streams always fill in the same order. (The rules check this: `key()` only counts colours on the loop, and a test plays a level with and without waiting and compares.) Every vehicle leaves full in the end: the seats per colour match the crowd exactly. The puzzle is which vehicle to bring when: one whose colour isn't on the loop (yet) blocks a bay, and the one you need may be jammed in behind others.

**Car parks** come in three shapes: **straight** (horizontal and vertical), **diagonal** (everything at 45°) and **mixed** (a diagonal heart in a straight ring). Easy starts straight; Medium takes turns of straight, diagonal, mixed; Hard leans to mixed and diagonal.

## Critters: round the loop

Rules in `src/engine.js`.

1. Tap the front critter of a lane. It rides onto the loop at the bottom-left corner (the **chequered start and finish line**) and goes round once, clockwise.
2. At each step along a side it looks straight into the picture. If the **first block it sees** has its colour (empty cells don't count), it pops it: **one per step**. The block behind shows from then on.
3. The number on a critter is how many it can still pop. After its lap a critter with **0 left** is done. One with **pops left parks in a bay**; tap it to send it round again.
4. If a critter comes back with pops left and **every bay is full**, the level is lost. If nothing that can go can pop a block and no lane critter can be parked, it's stuck (also lost).
5. Up to **4 critters** ride at once, two steps apart; the one in front acts first. The **loop bar** over the bays shows how many ride now ("2/4"), one pip per place in the colour of the critter in it.
6. **Buddies**: two critters tied together with a gold rope (with a chain link half way) leave the lanes **together**. Both have to be at the front of their lanes; then tapping either sends both, the lead first (`level.pairs`: `[[lead, follower]]`; `group()` in `src/engine.js`). They need two places on the loop. Tapping one while its buddy is still behind another critter shakes both and says so. Once on the loop they are two ordinary critters: each parks, comes back and finishes on its own. Pick takes both from anywhere in their lanes; one undo puts both back. The first level with buddies shows a tip until a pair is sent.
7. **Repeat** (on the loop bar) sends the parked critters round again by themselves, as soon as there is room on the loop. It stops on its own once every critter going round has finished two laps without a single block popping anywhere (`dry` in `game.js`): nothing would change any more. You can still send lane critters while it runs; undo, restart and a new level switch it off.
8. **A sure win finishes itself.** When every critter not yet done (in a lane, a bay or on the loop) would find a free bay, no critter can come back to a full yard, so the level can't be lost (`sureWin()` in `src/engine.js`). It can't get stuck either: a critter's capacity is exactly what it took in the made solution, so per colour the pops left equal the blocks left, and some block always shows. From the moment that holds, and at least half the critters are done (so Easy level 1 isn't over after one tap), the game says so and plays the rest out **live**: before every tick, every critter that can go goes (`sendAll()`, the same steps as `playOut()`), so you see the critters pop the last blocks while fireworks go off (in Orbit the turntable makes one slow turn). A copy plays it first to count the ticks, and the pace is set so the last block pops after about 4 seconds (`finishPop` in `src/config.js`: slow motion when little is left, up to 3× slower than normal; fast forward when a lot is, up to 12× faster), and the result shows 5 seconds after it started at the earliest (`finishSeconds`). Taps, undo, hints and powers wait meanwhile; restart and the menu still work. It counts as a clean clear. (Until November 2026 the blocks all flew off at once in about 2 seconds, which was too quick to follow.)

## Orbit: Critters in 3D

Rules in `src/orbit.js` (a subclass of Critters' `Game`); everything not listed here is Critters'.

1. A **sculpture** of w × h × d blocks (h is the height) stands on a turntable. The loop runs round its **footprint** (w × d), exactly like Critters' track round a picture.
2. At each step along a side a critter looks straight in on **every layer at once**, bottom to top. On each layer it pops the **first block it sees** if that has its colour, while it has pops left. So one step can pop a whole column of blocks.
3. Sculptures are solid: peeling the outside shows the inside (a planet's crust, mantle and core; an apple's flesh and pips; a geode's quartz and amethyst; a cake's layers).
4. **Drag** anywhere outside the bays and lanes to turn the view (the mouse wheel zooms). Turning only changes the view, never the rules.
5. The start and finish line is a chequered strip across the rail, at the corner where every lap starts. (It had a little flag on a pole too, until November 2026.)

**Sculptures** (`src/sculptures.js`) are shapes in maths, not drawn grids, so each can be built at any size: `sculptFor()` takes the smallest grid that gives at least the target number of blocks. A `body()` gives the inside, an optional `skin()` the outermost blocks (sprinkles, eyes, stickers). 32 drawn ones (thin, tall ones like the snowman and the rocket only on Easy, because they stay small; the second batch of ten, from the burger to the bee, comes after the first 22 on every track), then endless seeded ones: layered candy, worlds, rock strata and totems. Their order and shapes are part of every Orbit level, like the pictures are for the other modes.

| | Easy | Medium | Hard |
|---|---|---|---|
| Blocks (grows every 4 levels) | ~10,000–11,500 | ~12,000–14,000 | ~14,000–16,000 |
| Critter sizes (pops) | 180–420 | 220–500 | 260–580 |
| Bays | 5 | 3 | 3 (every 4th: 2) |
| Lanes | 4 (3 on levels 1–2) | 5 | 5 |
| Hidden colours | no | from level 10 | yes |
| Buddy pairs (at most) | 2 from level 3 | 3 | 4 |

Since November 2026 sculptures have **10,000+ blocks** (they had 1,000–4,900), to see how a phone copes: grids up to 64 blocks on a side (`sculptFor()` guesses the size from a small grid instead of trying every size), one instanced mesh, up to 2,400 flying blocks at once. A level has 35–65 critters. Each critter aims for a random size in its range, so a lap that could take hundreds of blocks of one colour stops somewhere along the way. Making a level takes 50–200 ms on a laptop; a hint usually under 100 ms (at most 2.5 s, then it says it found nothing and costs nothing).

### The model gallery

**Model gallery** in the lobby (under Play) and in the menu drawer shows every drawn sculpture on a slowly turning turntable: its name, blocks and colours, prev/next (or the arrow keys), drag to turn it, and a size (Easy, Medium, Hard: the number of blocks it has on that track). **Test play** makes a test level round it like level 1 of that difficulty (`makeTestLevel()` in `src/levels.js`: same bays, critter sizes and hidden colours, always solvable). Tests are not part of any track: nothing is saved, no coins are paid, powers and hints are free, and back leads to the gallery. (Unscrew has a model inspector too, but only in dev builds behind `?models`; here it's for players.)

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
| **+1 Bay** | one more bay for the rest of the level | one more bay at the stop | boost (2 levels, doubling per use in a level) |
| **Pick / Tow** | tap any critter in a lane, not just the front one; hidden colours show while it waits | a tow truck pulls any vehicle out of the car park, whatever is in its way | boost (2 levels, doubling) |
| **Laser / Magnet** | the next critter pops its colour **through other colours** for one lap (`takeColour`) | the next vehicle, as it parks in its bay, pulls in everyone of its colour it has seats for: off the loop (nearest the stop first), then out of the streams (the next to step in first) | heavy (3 levels, doubling) |

- Pick and Laser **arm** on a tap (the button glows; tap again to put it away for free) and are paid when the send happens. Pick on a critter that could go anyway costs nothing.
- Undoing a send that used a power hands its coins back (`launch(m, { power })` keeps what it cost; `undo()` returns it as `undone`). An extra bay is not tied to a send and stays, undo included.
- The powers never break the "capacity = blocks" rule: they change *which* blocks a mover reaches or where it waits, never how many it takes.

## How levels are made (always solvable)

Every level comes from a seed (`"<mode>:<diff>:<n>:<attempt>"`), so Depot Hard level 12 is the same everywhere. `src/levels.js`:

**Hard only: make a few, keep the hardest.** Depot Hard makes 6 solvable candidates and Critters Hard 8, and keeps the one two stand-in players (`src/judge.js`) do worst on: a greedy one that sends whatever takes the most right now, and the same with a 25% chance of a random tap. Orbit Hard skips this (judging 15,000-block levels is too slow for a phone).

**Depot** has no picture and is made like this:

1. **Pick the vehicles:** a number of them (10–18 on Easy, 18–26 on Medium, 24–32 on Hard), their colours (3 to 7, from a list chosen to stay easy to tell apart in a crowd, at least two vehicles each) and kinds (car, van or bus; more buses on harder tracks).
2. **Play it forwards with the real rules, making the crowd up as it walks in.** Each person's colour is picked as they step into the loop, from the seats still unclaimed: often the colour of the person in front of them in their stream (so the crowd comes in colour blocks), and more often a colour a parked vehicle is waiting for. Whenever the game waits, send a vehicle whose colour walks the loop (weighted by how many of it walk, to the power `bias`): usually one that fills up at once, now and then (`keep`) one that has to wait in its bay for more, but never so many that no bay is left free.
3. **Park them:** the car park is filled from the *last* vehicle to leave to the first, on lattices of cells (straight or turned 45°, clipped to an oval). Each vehicle gets a spot with a clear way out past the ones already parked, preferably in *their* way (the jam) and tight against them, close to the middle (so it looks like a packed car park).
4. **Replay** the solution with the real rules, as for the other modes.

**Critters and Orbit:**

1. **Pick a picture.** Easy starts with the 15 small drawn pictures (8–14 cells), Medium and Hard with the 14 bigger ones (16×12 to 16×17, `LARGE` in `src/pictures.js`; symmetric ones are drawn as a left half and mirrored). Then endless seeded ones: creatures, quilts and waves, 10–12 cells on Easy, 13–15 on Medium, 15–18 on Hard.
2. **Play it forwards with the real rules**, making up each mover as it's needed:
   - **Critters:** pick a colour that shows (weighted by how much shows, to the power `bias`), send a critter of it round; its capacity is what it took. Sometimes it parks and comes back later for more.
3. That list of sends is a solution. Place the movers so it can be played:
   - **Critters:** in order over the lanes, so each lane keeps the solution's order.
4. **Replay** the solution with the real rules. Only a level that passes is used; otherwise the next attempt seed is tried.
5. **Buddies** (Critters and Orbit, `buddyUp()`): two critters the made solution sends one right after the other, both from the front of neighbouring lanes, become a pair that the solution sends as one, if the solution still wins that way (replayed). Up to `buddies` pairs per level, picked with their own random stream (`"<key>:buddies"`), so picture, critters and lanes stay exactly what they were and the fingerprints don't change. Pairs can never wait on each other: the lanes keep the order the solution sends them in. Hard levels, which send more critters from bays, find fewer spots and get 0–3 pairs.

`tests/loopline/rules.test.mjs` checks levels 1–30 of all nine tracks this way, checks that the solver also finds its own way through levels 1–10 (without the shortcut below), and pins fingerprints of a few levels per track. **Changing the generator, the pictures, their order or the RNG changes levels**, and saved stars would point at different puzzles. If you do it on purpose, drop the changed tracks' saved progress on load (as `loadSave` in `game.js` does for Depot) or bump the save key (now `loopline.v3`), and update the fingerprints.

**Hints** use the solver from the current position. It knows the positions along the level's made solution: as soon as its search reaches one, the rest of the made solution finishes it. That makes hints on 15,000-block Orbit levels fast, and Hard levels (whose obvious moves are often wrong) much quicker to search.

### Difficulty

`params()` in `src/levels.js`:

| | Easy | Medium | Hard |
|---|---|---|---|
| Depot streams | 1 (2 from level 5) | 2 (every 3rd: 3) | 3 (levels 1, 5, 9…: 2) |
| Depot spots on the loop | 44 | 38 | 34 |
| Depot bays | 5 | 3 | 3 (every 4th: 2) |
| Depot vehicles (grows every 3 levels) | 10–18 | 18–26 | 24–32 |
| Depot colours | 3–5 | 5–6 | 6–7 |
| Depot car parks | straight, some diagonal and mixed | straight, diagonal, mixed in turns | mostly mixed and diagonal |
| Critters bays | 5 | 3 | 2 |
| Critters lanes | 3 (2 on levels 1–2) | 4 | 4 |
| Critters hidden colours | no | from level 12 | yes |
| Critters max critter size | 12 | 18 | 30 |
| Critters buddy pairs (at most) | 1 from level 4, 2 from level 10 | 2 | 3 |

Hard also has: **`bias`**, how the made solution picks its next colour. Easy and Medium follow the obvious move (weight = shows^1.5), so the obvious send is usually right. Hard leans the other way (Depot 0.5, Critters and Orbit −0.5), so the colour that shows most is often not the one to send yet. **`pick`**: see "Hard only" above. Critters Hard has 2 bays (was 3) and critters of up to 30 (was 24) that come back for more more often (`keep` 0.85).

How often the stand-in players win, without undo (levels 1–24, 8 tries each; `src/judge.js`). **Random** taps anything; **human** is greedy with a 25% chance of a random tap; **greedy** always sends what takes the most right now:

| | Easy | Medium | Hard before (Nov 2026) | Hard now |
|---|---|---|---|---|
| Depot (random / human / greedy) | 100 / 100 / 100% | 69 / 98 / 100% | – | **8 / 56 / 72%** |
| Critters | 100 / 100 / 100% | 73 / 88 / 100% | 49 / 73 / 94% | **27 / 46 / 57%** |
| Orbit (levels 1–12, 3 tries) | 100 / – / 94% | 44 / – / 97% | 31 / – / 94% | **19 / 28 / 69%** |

Greedy winning 94% of Hard levels is why Hard didn't feel hard: sending whatever popped the most almost always worked, and free undo took away what risk was left. Easy and Medium Critters levels are unchanged (fingerprints pinned), so their saved stars still hold. Depot's row is the crowd-and-car-park Depot (its Hard went from 4 bays to 3, every fourth level 2, to get here); the old Depot's Hard went from 36 / 70 / 83% to 20 / 34 / 40% in the same retune. A thinking player does better than greedy; hidden colours and planning a way through a jammed car park add difficulty these players don't notice. Tune after playtesting.

## How it's built

```
games/loopline/
  index.html, style.css, strings.js   markup; the look (deep indigo, light rails, red toolbar, Lilita One + Baloo 2); English + Dutch
  fonts/                               the two fonts, vendored for offline play (scripts/vendor-fonts.mjs)
  economy.js                           coins: pay per tier and the kind (price) of every power (docs/ECONOMY.md)
  game.js                              app shell: taps, tick loop, HUD, toolbar, loop bar and Repeat, sure wins, coins and powers, lobby (mode, difficulty, levels), model gallery and test levels, result, saving
  src/config.js                        every number, and the 15-colour palette
  src/engine.js                        Critters' rules (track, take, launch, buddies, tick, park, lose, stuck, sure win, undo) and the car-park helpers
  src/depot.js                         Depot's rules (streams, the zip, loop, stop, bays, car park, quiet, lose, undo, Tow, Magnet)
  src/lot.js                           Depot's car park in geometry: vehicles as rectangles at 8 headings, who blocks whom, lattices
  src/renderDepot.js                   Depot's 2D canvas: the crowd, the bays, the car park and the road (static parts painted once)
  src/pictures.js                      drawn pictures (small and LARGE) and the seeded picture makers
  src/levels.js                        level generator and difficulty (see above)
  src/solver.js                        depth-first search over whole sends, for hints and tests, every mode; shortcut via the made solution
  src/judge.js                         stand-in players (greedy, greedy with slips) that pick Hard levels and measure difficulty
  src/orbit.js                         Orbit's rules: Critters' engine, looking in on every layer
  src/sculptures.js                    Orbit's voxel sculptures (shapes in maths, any size) and the seeded makers
  src/render.js                        2D canvas (Critters): voxel pixels, rails, pixel-sprite critters, effects
  src/render3d.js                      Orbit: three.js view (instanced blocks, voxel critters, drag to turn), and the flat bays and lanes on the 2D canvas
  src/audio.js                         synthesised sounds
```

- Time runs in **ticks**. Critters: one lap is 3 seconds whatever the picture's size. Depot: the crowd walks one spot every 0.15 s (`CONFIG.depot.tick`; it was a hurried 0.075 s before the redesign). The renderer blends between ticks. Frames run only while something moves, except in Depot, where the crowd walks for as long as a level is played; Depot draws at most 30 frames a second, and paints what never moves (plaza, walkways, road, car park, bays) once per layout onto a layer of its own.
- **Pixel sprites**: critters and buses are drawn from tiny letter grids (`CRITTER`, `busRows()` in `src/render.js`) onto small canvases per colour, then scaled up without smoothing.
- The layout fits every level between the HUD and the toolbar on phones down to 375×667; on short screens (≤ 700 px) the HUD and toolbar get slimmer and the yard gives up room so pixels stay at least ~9 px. On a 320×568 phone Depot's road and bays shrink so the car park keeps vehicles of about 20 px per cell.
- The solver plays one send at a time (send, let everything run until it stops, repeat), which a player can always do too. Its answers can really be played.
- Saves under `loopline.v3`: mode and difficulty, per track (`"depot:hard"`) the highest level cleared and the stars per level, coins, sound and vibration. A `loopline.v2` save keeps its Easy and Medium Critters progress (same levels) and gets the coins those stars would have paid; Hard and Orbit start over (new levels). (`loopline.v1` had one track per mode with different levels; it is ignored.)
- Saves without `depot: 2` come from before Depot became the crowd and the car park: their Depot progress is dropped on load (the coins it earned stay), Critters' and Orbit's is kept.
- Orbit levels past the first 22/17/15 drawn sculptures (Easy/Medium/Hard) changed in November 2026, when the second batch of models was put there (Orbit level 25's fingerprints were updated). Saved stars for those levels were kept rather than bumping the save key: Orbit's tracks were days old.
- `window.Loopline` exposes the game for the end-to-end test (`tests/loopline/e2e.mjs`), which plays levels with real taps.

## To playtest

- Hard after the November 2026 retune: hard enough now? Too hard? Is paying for undo on Hard fair, or should it be a few free undos per level?
- Orbit with 10,000–16,000 blocks on a real phone: frame rate while popping, time to make a level, battery. If it struggles, lower `target` in `params()` (and bump the save key).
- Powers: are +1 Bay, Pick and Laser (Tow and Magnet in Depot) worth their price? Is it clear that Pick and Laser wait for the next tap?
- Depot: is the walking pace (0.15 s a spot) calm but not slow? Clearing a level takes a minute or two at this pace.
- Depot: are the arrows readable on diagonal vehicles on a small phone? Is it clear why a vehicle won't leave (it nudges forward and back)?
- Depot: does Hard feel like planning, or like luck? Are 2 bays on every fourth Hard level too harsh?
- Critters Medium: random tapping still wins ~84%. Fewer bays, or hidden colours earlier?
- Big pictures (16×17) on a small phone: are cells big enough to see?
- Colour-blind check: movers show a number, but colours alone tell the pixels apart. Brown, peach and orange in the owl are close.

- Repeat: is "two dry laps each" the right moment to stop, or does it feel slow? Should a lane critter you send join in (it does now, once it parks)?
- Sure wins: does the level finishing itself feel like a reward, or like being cut short? Is "half the critters done" the right moment? Is about 5 seconds of watching the critters finish it right, or too long?
- Buddies: is the gold rope readable, also on a hidden ("?") critter? Is it clear why a buddy won't go? Enough pairs on Hard (some levels get none)?
- The second batch of models: are they readable at 10,000+ blocks, and fun to peel (the burger and the cake are layered on purpose)?

## V2 ideas

- **Diorama:** Depot as a little 3D town (Orbit, the 3D Critters, is done).
- Orbit: tap a block to see which colours could reach it; a slow turntable spin while idle (costs battery).
- A picture album: every cleared picture collected.
- More yard twists: buddy vehicles in Depot, mystery vehicles, layered cells, a VIP bay.
- A daily level.
