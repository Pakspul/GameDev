# Starflip

*Working title.* Space pinball with **missions that tell you exactly what to shoot**, and **bonus tables** behind a wormhole where you score fast for 30 seconds. One main table, three bonus tables, plain 2D canvas, English and Dutch, fully offline.

**Status: first version, in the release builds** (on the hub, the website and the app), so it can be played on a phone. Needs a playtest: see [Open questions](#open-questions).

## How it plays

- **Controls.** Touch the left or right half of the screen for that flipper (both at once is fine). With a ball in the plunger lane, hold anywhere to pull the plunger and let go to launch. Keys: ← / Z / Left Shift and → / M / Right Shift for the flippers, Space or ↓ for the plunger, Esc to pause.
- **Three balls**, with a 10-second ball save after each launch (one save per ball).
- **Plunger skill.** A soft pull drops the ball into the top lanes (lane 3, then 2, then 1 as you pull harder); a full pull sends it over the top to the left side. The green top lane right after a launch is the **skill shot** (100,000).
- **Top lanes.** Light all three for +1 bonus multiplier (up to ×5). Flipping moves the lit lanes (lane change).
- **Missions.** The **launch pad** in the middle starts the next mission. The banner above the table always says what to do now ("Hit the BUMPERS 4/8", "Shoot the LEFT ORBIT"), with the mission's clock (75 s) and a progress bar; a **gold arrow** on the table blinks at the shot. Missions carry over to the next ball (the clock only runs while a ball is in play); they fail only when the clock runs out, and the launch pad starts them again.

  | # | Mission | Steps | Opens |
  |---|---|---|---|
  | 1 | Liftoff | 8 bumper hits → right orbit | Asteroid Belt |
  | 2 | Asteroid Storm | knock down the 3 asteroid drop targets, twice | Asteroid Belt |
  | 3 | Satellite Repair | left orbit → 3 satellite target hits → launch pad | UFO Attack |
  | 4 | Comet Chase | catch the comet 3 times: it sits on one shot (orange arrow) and moves every 7 s | Gravity Well |
  | 5 | Black Hole Survey | left orbit → right orbit → left orbit → right orbit | Gravity Well |
  | 6 | First Contact | 20 spinner turns → wormhole | UFO Attack |

- **Wormhole and bonus tables.** A finished mission opens the **wormhole** (magenta arrow, upper left). Shoot it with one ball in play and the ball warps to that mission's bonus table: 30 seconds, a 5-second ball save, and losing the ball there costs nothing. The ball then comes back out of the wormhole. Once reached, a bonus table can also be played on its own from the start screen.

  | Bonus table | What scores |
  |---|---|
  | Asteroid Belt | rocks crack (2–3 hits) and break for 25,000; a new rock appears elsewhere |
  | Gravity Well | a black hole pulls the ball in: diving in scores 100,000; the gold star on the ring scores 50,000 and the next one lights; all six is a supernova (300,000) |
  | UFO Attack | a saucer flies to and fro: 3 hits bring it down (250,000) and it comes back faster; 4 alien drop targets below it |

- **Mothership.** With all six missions done, the launch pad starts a 3-ball multiball: every green arrow is a jackpot (200,000), all six a super jackpot (1,000,000). When it ends, the missions start again worth ×2 (then ×3 …).
- **End of ball:** bonus (from bumpers, targets, lanes, orbits and missions) × multiplier.

## How it's built

| File | What |
|---|---|
| `src/config.js` | every number: physics, scoring, timers |
| `src/physics.js` | `World`: balls against segments (walls, targets, one-way gates), circles (bumpers, rocks, the moving UFO), kinematic flippers; line and circle sensors, holes, gravity fields. Fixed 600 Hz, so a ball at top speed moves under half its radius per step and can't pass through a wall. Reports `hit`, `sensor`, `hole`, `drain` events |
| `src/tables.js` | the four tables as data. They share the lower half (inlanes, slingshots, flippers), so timing carries over |
| `src/missions.js` | the missions as data: steps of `{ shot, n }` |
| `src/rules.js` | `Game`: balls, scoring, lanes, missions, Mothership, bonus tables. No DOM; `fx` lists what happened for sound, sparks and call-outs |
| `src/render.js` | 2D canvas: a cached layer per table (space, floor, walls, labels) plus what moves or lights up each frame |
| `src/audio.js` | synthesised sounds (WebAudio, no files) |
| `game.js` | input, frame loop, banner, call-outs, start and result screens, saving (`starflip.v1`) |

Design notes:

- **The roof is two tight corners and a straight top**, not a half circle: on a round top every ball hugs the wall and orbits, so plunger strength meant nothing and the lanes and bumpers were never reached. Now a slow ball leaves the roof and drops in; a fast one follows the corners round.
- **The inlane walls end on top of the flipper pivots**, so a ball rolls onto the flipper instead of resting in a notch.
- **The wormhole sits in the path of a right-flipper shot hit a little early** (about 75° up). Where it first was, in a pocket by the left orbit, a sweep of flipper timings reached it 2% of the time; now about 8%, about as often as the drop targets.

## Tests and tools

- `npm run test:starflip` (`tests/starflip/rules.test.mjs`, in Node on the real physics): plunges leave the lane and reach different lanes, the flippers reach every mission shot, balls never leave any table over whole autoplayed games, same seed + same play = same game, missions start, advance, fail and carry over, the comet, wormhole → bonus table → back, each bonus table's scoring, ball save and game over, lanes, multiplier and skill shot, the Mothership.
- `tests/starflip/e2e.mjs` (in `npm test`): a phone browser with real touches: launch by holding, flippers per half, the banner, pause in the drawer, a bonus table unlocking on the start screen, the result screen.
- `npm run starflip:sim [games] [seed]`: a simple computer player plays whole games and prints scores, missions and bonus rounds, for tuning.

## Open questions

- Is the table the right speed on a phone (gravity 1500, flipper speed)? Is 75 s per mission right?
- Is the wormhole too easy or too hard to hit now? Are the bonus tables too short, or too generous next to the main table?
- Are the arrows and the banner enough to know what to do, without reading "How to play"?
- Ideas for later: a nudge (shake), a second ramp layer, more missions per round, more bonus tables (e.g. a moon base), a daily table seed.
