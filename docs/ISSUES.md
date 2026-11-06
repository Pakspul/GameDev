# Issues

Problems and feedback, **per game**: things players noticed, bugs, and weak spots in a game's design. For concrete next steps across the whole project, see [TODO.md](../TODO.md); for new games, see [BACKLOG.md](BACKLOG.md).

## How to use this file

- One entry per issue, under its game. Give it the next free ID for that game (`U-2`, `J-1`, …) and never reuse an ID, so commits and the [history](../HISTORY.md) can refer to it.
- Say **where it came from** (a player, a playtest, a test, a review) and **when**, and describe what was noticed before proposing a fix.
- **Status:** `open` → `in progress` → `done` (or `won't fix`, with the reason). Keep done issues in the list, so the reasoning stays findable.
- An issue that turns into a big job gets its own doc (like [UNSCREW-MODELS.md](UNSCREW-MODELS.md)); the entry here then links to it.

| Prefix | Game |
|---|---|
| `J-` | Jade Pavilion |
| `N-` | Nuts & Bolts |
| `O-` | Outbound |
| `U-` | Unscrew |
| `G-` | Graphite |
| `S-` | Crystal Reels (slots) |
| `C-` | Camper Crew |
| `W-` | Wallbreaker |
| `H-` | The hub and anything shared |

## Jade Pavilion

_No issues yet._

## Nuts & Bolts

### N-1: Bolts that only take one colour

- **Status:** in progress (built, needs a playtest)
- **Source:** player idea, November 2026: "you know what is fun, if certain bolts only accept a certain colour."
- **What was noticed:** the rules never change within a level: any nut fits any bolt with room on top of its own colour. Level types vary the shape of the board (bolt lengths, hidden nuts), but not the rules, so a new rule adds a kind of thinking the game doesn't have yet.
- **Done (6 November 2026):** a new level type, **Keyed bolts** (Dutch: *Kleurbouten*). Some bolts have a base in one colour and a tag with that colour's icon, so the rule reads without colour too. Such a bolt only takes nuts of its colour. Other colours may start on it and have to be moved off; it can never be used as a parking spot.
  - The generator keys 2 bolts on Easy and 3 on the other tiers. A keyed bolt is always the bolt that was sized for its colour, so that colour fits on it. Boards where taking nuts off a keyed bolt would leave another colour complete on it are thrown away.
  - The solver knows about keys, so every keyed level is proven solvable and hints work. Dropping a nut on a keyed bolt of the wrong colour shakes the nut, wiggles the tag and says why in a toast.
  - Keyed levels take the second Mixed slot of the level cycle (levels 4, 9, 14, … in every tier) and are the fifth daily type.
- **Side effects:** levels 4, 9, 14, … are new puzzles; stars already earned there stay. All other levels are unchanged (96 sample levels of the other types came out identical before and after). A level in progress resumes as it was. The daily rotation went from four types to five, so today's daily can change type for players who haven't started it.
- **Watch:** an Expert keyed level takes about 0.4 s to build on a desktop (median, worst 1.4 s), against 0.03 s for Mixed, because many Expert candidates with keys turn out to have no solution. Four keys on Expert was twice as slow and no harder, so it's three. Check on a slow phone.
- **Ideas for later:** a keyed empty bolt, and keys combined with Mystery nuts on Expert.

## Outbound

_No issues yet._

## Unscrew

### U-1: Too few 3D models, so the levels feel the same

- **Status:** in progress
- **Source:** player feedback, November 2026
- **What was noticed:** 3D mode had only six models: cottage, bedroom, windmill, castle, rocket and robot. Each one is generated with random sizes, colours and details, but after six levels you have seen every kind of object, and from then on it is "another cottage". Players called it a lack of diversity.
- **Why it matters:** in a take-apart game the object *is* the reward. A new thing to take apart keeps people playing more than a slightly different version of an old one.
- **Plan:**
  1. *Done (6 November 2026):* two new models, from two new categories: a **villa** (a modern house: two floors, flat roofs, a balcony, a pool) and a **giraffe** (the first animal: screwed-on spots, a neck, a mane and an acacia tree). That makes eight.
  2. *In progress:* grow the collection category by category: houses, animals, vehicles, industry and more. The catalogue of categories, model ideas and a step-by-step recipe for adding one (written so that an AI agent can pick up a model on its own) is in [UNSCREW-MODELS.md](UNSCREW-MODELS.md).
     - *6 November 2026:* the models moved out of `game.js` into `games/unscrew/models/` (one file per category), so the collection can grow without one file blowing up. Four new models: a **camper van** (vehicles), a **water tower** (industry), a **turtle** (animals) and a **Dutch canal house** (houses). That makes twelve, in eight categories; all four new ones keep 98–100% of their parts.
     - *6 November 2026, later:* six more models, each built as a puzzle with layers of covers rather than a pile of panels (see "Depth" in [UNSCREW-MODELS.md](UNSCREW-MODELS.md#depth-make-it-a-puzzle-not-a-pile)): a **lighthouse** (landmarks), a **Mars rover** (space), a **steam train** (vehicles), a **wind turbine** (industry), an **arcade cabinet** (machines) and a **layer cake**, the first model of a ninth category, everyday objects. That makes eighteen; the new ones keep 92–100% of their parts.
     - *6 November 2026, evening:* six more, again built as puzzles: a **burger** (objects), a **pagoda** (landmarks), a **harbour crane with containers** (industry), a **fire engine** (vehicles), a **robot dog** (machines) and a **kitchen**, the second model of rooms. That makes twenty-four; the new ones keep 95-100% of their parts.
  3. *Next, now that there are twenty-four:* make the level picker aware of categories, so two houses don't come up in a row. Each entry in `GENS3D` already carries its category.
- **Tool:** `npm run unscrew:models` reports screws and kept parts per model and difficulty, and takes screenshots with `--shots`.
- **Note:** adding a model reshuffles which model each 3D level number shows (the order is a seeded shuffle of all models). Saves only hold level numbers, scores, stars and coins, never the object itself, so nothing breaks. A run in progress just continues on a different object. The save key `unscrew.v2` stays the same on purpose. Apart from adding models, the shuffle never changes: it follows the fixed list `MODEL_ORDER` in `models/order.js`, not the files or the script tags, and `tests/unscrew.mjs` fails if that list is reordered instead of appended to.

### U-2: Older models silently lose parts

- **Status:** open
- **Source:** found while building the villa and the giraffe (U-1), 6 November 2026
- **What was noticed:** `finalize()` drops every part that ends up without a screw. The new report (`npm run unscrew:models`) shows the older models keep only 55–96% of the parts they build: the castle about 55–73%, the cottage and the robot about 68–72%. Some of that is harmless (a hidden core under cladding), but some is visible: the cottage's front wall shows a gap where a plank went missing.
- **Likely causes** (see the rules in [UNSCREW-MODELS.md](UNSCREW-MODELS.md#2-know-the-rules-of-the-screws)): planks closer together than the 0.52 minimum screw spacing (the cottage uses 0.36–0.46 planks), fence rails whose screws are only valid where a picket covers them, and parts that block each other so the solver breaks the deadlock by deleting screws.
- **Proposal:** go through the models one by one with `npm run unscrew:models -- <name> --shots`, fix the visible drops, and aim for 90% kept. This changes the levels (fine, see the note under U-1).

## Graphite

_No issues yet._

## Crystal Reels (slots)

### S-1: End-to-end test: the pick feature screen doesn't appear

- **Status:** open
- **Source:** `npm test`, 6 November 2026 (also fails on the code before that day's changes, so it is older)
- **What was noticed:** in `tests/slots/e2e.mjs`, *Feature: pick on machine 2* reports "✗ the pick feature screen appeared". The pick still ends back in Idle with nothing pending, so the feature runs, but the test doesn't see its screen. Everything else in `npm test` passes, but `npm test` as a whole fails on this one check.
- **Next:** find out whether the screen is skipped or the test looks too late or for the wrong element.

## Camper Crew

_No issues yet._

## Hub and shared

_No issues yet._

## Wallbreaker

_No issues yet._ Built on 6 November 2026; the feel gate (a real phone) is still to come, see [WALLBREAKER.md](WALLBREAKER.md#not-verified-here-needs-a-person-and-a-phone).
