# Emberholm

*Working title.* A single-player open-world RPG for phones, played in landscape. You roam a Nordic island, take quests in the village, fight what lives in the wilds, gather and craft, and grow strong enough to go further. It has the genre of World of Warcraft (quests, levels, loot, gear) and of Valheim (survival, crafting, the wilds as a threat), but its own world, names and look.

**Status: M0 (walk) is built and playable** in `games/emberholm/` (in `npm run dev` and test builds, not yet in release builds; the hub card says Prototype). See [M0 as built](#m0-as-built). This document is the plan; the milestones say what gets built next and when we decide whether to carry on.

## The pitch in one paragraph

You wash ashore on Emberholm. The village keeps a great fire burning, and as long as it burns the wilds keep their distance. But the beacons around the island have gone dark one by one, and the nights are getting worse. You start with a borrowed axe and an empty stomach. Every trip outside the village is a small expedition: eat well before you go, mind the cold and the dark, take on what you can handle, and come back with silver, materials and stories. Craft better gear, level up, relight a beacon, and the next part of the island opens up.

## Pillars

Every feature is checked against these. If it doesn't serve one, it waits.

1. **Every trip out is an expedition.** The world is a threat: hunger, cold, night and what roams in it. Getting home with a full pack feels like a win.
2. **Fights you win with timing, not grinding.** Parry an attack at the right moment and the enemy is open for a heavy counter. A skilled player can beat enemies a few levels above them.
3. **Everything you pick up is worth something.** Loot is silver, materials and gear. Materials become food, gear and upgrades, so even a wolf hide tells you where you're going next.
4. **Made for a phone in your hands.** Landscape, two thumbs, sessions of 5–15 minutes, save anywhere, no rush.
5. **Honest.** See below.

## How it fits the mission

| The mission says | Here that means |
|---|---|
| No ads, no pay-to-win | Silver, materials and gear are earned by playing only. No shop with real money, no premium anything. |
| No tracking, works offline | Single player, no accounts, no servers. Everything ships in the app; the world is generated from a fixed seed on the device. |
| No energy bars or real-time timers | Day and night run on **game time**, only while you play. Enemies and resources come back after in-game days, never real ones. |
| No guilt or punishment for stopping | Close the app at any moment; it saved. Nothing in the world decays while you're away. |
| Lives within a level are fine | Dying is a game mechanic: you wake at your last fire and walk back for your materials. Gear and silver are never lost. |

Its currency rules are its own: [ECONOMY.md](ECONOMY.md) prices help in puzzle levels, and an RPG has no levels in that sense. Rule 9 still holds: never for sale.

## The core loop

```
       ┌──────────────────────── village ────────────────────────┐
       │  eat, rest by the fire, craft and upgrade, sell, stash  │
       │  take quests ─────────────────────────────┐             │
       └───────────────▲─────────────────────────────┼─────────────┘
                       │                             ▼
     come back with silver,                go out: explore, fight,
     materials, gear, XP  ◄──────────────  gather, do the quest,
                                           watch your food and warmth
```

- **Moment to moment (seconds):** move, read an enemy's wind-up, parry or dodge, punish. Pick up what drops.
- **A session (5–15 minutes):** one trip out. Take a quest, prepare (food, a campfire kit), go, do it, decide whether to push on or go home, hand it in.
- **Long term (hours):** levels, better gear tiers, new recipes, the next beacon, the next zone.

## Camera and controls (landscape)

**Camera:** a high chase camera behind and above the player, looking down at about 45°. It follows on its own; drag with the right thumb to turn it. It pulls in a little indoors and in barrows, and out a little in a fight with several enemies.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ ←  ♥▓▓▓▓▓▓▓░░  ⚡▓▓▓▓▓▓▓▓▓░  🍖🍖🍖 ❄          N ·  ◦  · ┌──────────┐│
│    Lv 4 ▓▓▓▓░░░░░ XP                                    │ minimap  ││
│                                                         │          ││
│    ▸ Hunt wolves near the old mill  2/4                 └──────────┘│
│                                                                  ☰   │
│                                                                      │
│                                                     [skill 1]        │
│                                               [skill 2]    [DODGE]   │
│      ( drag anywhere on the                                          │
│        left half to move )             [food]   [PARRY]   ( ATTACK ) │
└──────────────────────────────────────────────────────────────────────┘
```

- **Left half:** a floating move stick, wherever the thumb lands (like Inkfield and Camper Crew).
- **Right half:** a big **Attack** button under the thumb, **Parry** right next to it, **Dodge** above, two ability buttons in an arc, and a quick-use slot for food or a healing mead. Dragging on empty space turns the camera.
- **Targeting:** attacks aim at the nearest enemy in front of you (a soft lock, shown as a small ring). Tap an enemy to lock on to it; tap again to release.
- **Keyboard and gamepad** for desktop and testing, as in Camper Crew.
- **Orientation:** in the Android app this game locks itself to landscape and unlocks when you leave it. In a browser that can't lock, portrait shows a "turn your phone" screen.

## Combat

Two buttons carry it: **Attack** when you want to, **Parry** when they do.

| Action | Input | What it does | Stamina |
|---|---|---|---|
| Light attack | tap Attack | a combo of up to 3 swings; the third hits harder | 8 each |
| Heavy attack | hold Attack ~0.4 s, release | 2.5× damage, staggers small enemies, breaks a block | 20 |
| **Parry** | tap Parry just before a hit lands | the hit does nothing, the enemy staggers, your next attack is a **riposte** | refunds 10 |
| Block | hold Parry | takes most of the damage away; each blocked hit costs stamina; at zero you're guard-broken (stunned ~1 s) | per hit |
| Dodge | tap Dodge | a quick roll in the stick direction, untouchable for a moment | 15 |
| Abilities | the two skill buttons | from your weapon (see Progression); each has a cooldown | varies |

**The parry.** It's the heart of the game, so it gets the most care:

- **Window:** about 180 ms before the hit on Normal. On the **Story** setting 280 ms; on **Hard** 120 ms. All in `config.js`.
- **Forgiving when early:** press too early and you're simply blocking. So a mistimed parry is a block, not a free hit.
- **Reward:** the enemy staggers for ~1.5 s. The next attack inside that time is a **riposte: 3× damage**, always a critical. A riposte with a heavy attack finishes most normal enemies.
- **Feel:** a short freeze of the game on contact (hit-stop, ~120 ms), a bright spark, a ringing "ting", and a haptic pulse. A plain hit gets a shorter hit-stop (~70 ms).
- **Reading attacks:** every enemy attack has a wind-up. A **white glint** means it can be parried. A **red glint** means it can't (a boar's charge, a troll's sweep): dodge it.
- **Enemies parry too.** Raiders block and sometimes parry your light attacks, so you mix in heavies.

**Stamina** (100 at the start) refills after a short pause (~0.8 s), at about 20 per second. Attacking, blocking and dodging all draw on it. Food raises the maximum. Running out is what gets you killed, not the enemy's damage on its own.

**Damage numbers** stay simple: weapon damage × multipliers (heavy, riposte, critical) minus armour. Enemy level vs. your level shifts damage a little (±10% per level, capped), so timing can beat a level gap but not five.

## Survival: the world is the threat

Survival in Emberholm **adds a reason to prepare, never a chore**. Nothing ticks down into death while you stand in the village.

### Food

- You can have **up to three foods** active. Each raises your **maximum health and stamina** for a while (about 10 real minutes of play) and slowly heals you.
- **Healing comes from food** at first. Later a **flask** joins it (a few charges, refilled when you rest by a fire).
- **Hungry is not a damage timer.** It just means base stats, which are low: at level 1 about 50 health with no food, up to ~120 with three good meals. Going out unfed is a real risk, and eating well is a real reward.
- Better food comes from better ingredients and stations: roasted meat at a campfire, stews from the cook pot in the village, later honey bread and mead.

### Warmth

- States: **Warm → Cool → Cold → Freezing.** Night, rain, wind and swimming push you down; fire, a cloak, warm food and shelter push you up.
- **Cold:** stamina refills half as fast. That's enough to make a fight at night in the rain much harder.
- **Freezing** (damage over time) doesn't happen in the first zone. It's how the frost highlands later lock you out until you have the gear.

### Rest and fire

- Sit by a fire with some shelter for a few seconds and you're **Rested**: XP +50% and faster stamina for about 10 minutes.
- **A fire is safety.** Your last fire is where you wake if you fall. The village fire is always one; a **campfire kit** (wood + stone, crafted) lets you make a camp in the wilds: rest, cook, warm up, and set your wake-up point there.

### Day, night and weather

- **A day lasts 24 real minutes of play**: 14 of daylight, 10 of night (a night a little shorter than the day). It only runs while you play. On the island's clock the sun rises at 06:00 and sets at 20:00.
- **Night is darker and meaner:** wolves come in bigger packs, the dead walk out of the barrows, and you see less. Night also has **its own loot**: some herbs only open at night, and wights carry barrow silver. Risk and reward, your choice.
- **Light:** a lantern on your belt (crafted early). It lights a small circle; no fuel to manage in the first version.
- **Weather:** clear, fog (shorter view), rain (wet: colder), storm (later zones). Weather changes are seeded per in-game day.

### Dying

- You wake at your last fire. **Gear and silver are always kept.**
- The **materials you carried stay behind in a cairn** where you fell, marked on the map. Walk back and take them. The cairn never disappears.
- Settings can turn this off ("keep everything on death") for players who want a gentler game.

## Progression

### Character levels

- **Levels 1–10 in the first zone**, up to about 40 over the full game (4 zones).
- XP from **quests (~45%)**, **fights (~35%)** and **discovery (~20%)**: new places, runestones, first time gathering something.
- XP to the next level grows with the level (about `100 × level^1.5`). The first zone takes about **3 hours** to finish at a normal pace.
- A level raises base health and stamina and unlocks better gear tiers. **Enemy levels show as colours** (grey = trivial, green, yellow = even, orange, red = very dangerous).

### Weapons instead of classes

No class choice at the start. **The weapon you hold decides your abilities**, so you can switch playstyle by switching gear.

| Weapon | Feel | Ability 1 | Ability 2 | When |
|---|---|---|---|---|
| **Axe and shield** | solid, good blocks, a bigger parry window | Shield Bash (staggers, interrupts) | Cleave (wide swing, several enemies) | from the start |
| **Spear** | reach and speed, weaker block | Lunge (dash in and stab) | Throw (ranged, pick it up again) | first zone, mid-way |
| **Two-handed hammer** | slow, huge heavies, no shield | Ground Slam (knocks back) | War Cry (+damage for a while) | second zone |
| **Bow** | ranged, aiming helped by the soft lock | Power Shot | Volley | second zone |

Abilities get stronger with **runes** found through quests and bosses (later: a small rune tree per weapon).

### Perks

Every few levels (3, 6, 9 …) you pick one of two **perks**: "+20 ms parry window", "ripostes heal you a little", "cold slows you less", "+4 bag slots". Small, flavourful choices, no stat spreadsheets.

## Loot and items

### What drops

| Kind | Examples | Used for |
|---|---|---|
| **Silver** | coins from enemies, chests, quests, selling | buying basics and recipes from the vendors |
| **Materials** | wood, stone, flint, resin, hide, leather scraps, bone, feathers, copper ore, tin, berries, mushrooms, herbs, raw meat | crafting, cooking, upgrades |
| **Rare materials** | barrow silver (night), wolf pelt (alpha), raider iron, boss trophies | better recipes, upgrades, heirloom gear |
| **Gear** | weapons, shields, helmets, body armour, cloaks, trinkets | wearing, or salvaging into materials |

Materials are picked up by walking over them (with a little "+3 Hide" line). Gear asks for a tap, so you see what it is.

### Gear

- **Slots:** weapon, shield (or off-hand), head, body, cloak (warmth), trinket.
- **Rarity:** **Plain** (no bonus) → **Fine** (1 bonus) → **Rune-marked** (2 bonuses) → **Heirloom** (named, hand-designed, a special effect; from bosses and quest chains).
- **Bonuses** are short and readable: +stamina, +parry window, +riposte damage, +warmth, +carry slots, +XP when rested.
- **No durability.** Repairing on a phone is a chore, not a choice.

### Bag and stash

- **A bag with 24 slots** (more with perks and bigger packs you craft). Materials stack to 50.
- A **stash chest** in the village holds a lot. Stations in the village can use what's in the stash directly, so crafting doesn't mean shuffling items.
- A full bag is a decision ("drop the bone or go home?"), which is part of the expedition feeling.

## Crafting

**Crafted gear is the backbone; drops are the surprise.** You can always craft a solid set for your level. A lucky drop can beat it for a while, and salvaging what you don't need gives materials back.

| Station | Where | Makes |
|---|---|---|
| **Campfire** | the village, and anywhere with a kit | roast meat and simple food, warmth, rest, wake-up point |
| **Workbench** | village | wooden and leather gear, the spear, campfire kits, the lantern, bigger packs |
| **Forge** | village (after a quest) | copper and bronze weapons and armour; upgrades |
| **Cook pot** | village | stews and better food |
| **Mead hall brewing vat** | village, later | healing mead, warming mead |

- **Recipes appear when you first pick up a key material** ("You found copper ore: new recipes at the forge"). Some come from quests and vendors.
- **Upgrades:** every crafted item goes from ★1 to ★3 with more of the same materials plus one rarer one. An upgrade is a clear, felt jump (more damage or armour, and a bonus at ★3).
- **The smith's quest chain** teaches crafting in the first hour: gather wood and stone, build a workbench, make a spear, light the forge.

## Quests

### Who gives them (village, first zone)

| Character | Gives | Teaches |
|---|---|---|
| **The Chieftain** | the main story: why the beacons went dark, relight the first one | where to go next |
| **The Smith** | crafting chain, ore and metal | crafting and upgrades |
| **The Huntress** | hunts, tracking a named beast | combat, parrying |
| **The Herbwife** | herbs, mushrooms, cooking | food and survival |
| **The Skald** | find runestones, explore | the map, lore, discovery XP |

### Kinds of quest

Built from **templates** filled in by the world (which camp, which beast, which herb), plus hand-written text so they don't feel generated:

- **Hunt:** kill N of something, or one named, tougher beast.
- **Gather:** bring N of something (and learn where it grows).
- **Clear:** empty a raider camp or a barrow.
- **Explore:** reach a place, find a runestone, light a waystone.
- **Deliver / escort:** take something somewhere, or walk someone home.
- **Boss:** the end of a chain.

### Rules

- **Sized for a phone:** a single quest takes 5–15 minutes.
- **One tracked quest** at a time, shown at the top left and as a marker on the compass and the map. Up to 10 in the log.
- **The first zone has about 25 quests**: a main chain of ~8 and the rest side quests.
- After the main chain, the **village notice board** has repeatable bounties (new ones each in-game day, seeded), so the zone stays worth playing.

## The world

### Built from a seed, the same for everyone

- The island is **generated from one fixed seed**, then **hand-placed landmarks** are stamped into it: the village, barrows, a raider camp, the old mill, a mine, the beacon. Quests can refer to places, and every player has the same island.
- **The generator is frozen once released**, like the puzzle generators (see the warning in [ARCHITECTURE.md](ARCHITECTURE.md)). Changing it would move everything under players' saves.

### The full island (vision)

| Zone | Levels | Feel | New threat | Beacon boss |
|---|---|---|---|---|
| **1. The Strand** | 1–10 | shore, meadows, birch woods, a bog, low hills | wolves, boars, raiders, the dead at night | the Barrow King |
| 2. The Darkwood | 10–20 | dense pine forest, mist, ravines | trolls, spiders in the dark, poison | to be decided |
| 3. The Frost Fells | 20–30 | snowy uplands, glaciers | **freezing**: warm gear needed | to be decided |
| 4. The Ash Coast | 30–40 | black sand, hot springs, a smoking mountain | fire, raiders from the sea | to be decided |

Zones are walled by sea and mountains. Relighting a beacon opens the pass to the next.

### The first zone, The Strand

- About **1.2 × 1.2 km**: roughly 4–5 minutes to walk across, much longer to really know.
- **Places:** the village with its great fire; the old mill (wolves); the boar meadows; the raider camp on the headland; the bog with its mire crawlers; three barrows (night); a copper mine; the watchtower; the beacon hill.
- **Waystones:** five standing stones. Touch one to light it, then travel between lit ones from the map.
- **Map:** the parchment map fills in as you walk (fog of war). A minimap top right.
- **Respawning:** animals and plants come back after an in-game day, cleared camps after three.

### Enemies of the first zone

| Enemy | Levels | Behaviour | What it teaches |
|---|---|---|---|
| **Wolf** | 1–4 | packs of 2–4; circle and dart in, one bites at a time | parrying, watching your back |
| **Boar** | 2–5 | charges in a line (red: can't be parried) | dodging |
| **Raider** | 4–9 | axe or spear; blocks and sometimes parries; lives in camps | heavies against blocks |
| **Raider archer** | 5–9 | keeps distance, behind the others | closing in, using cover |
| **Mire crawler** | 6–9 | slow, spits poison in the bog | not standing still |
| **Barrow wight** | 6–10 | night and barrows only; fast combos | parrying under pressure |
| **The Barrow King** (boss) | 10 | three phases: sword combos, summons wights, a red sweep across the room | everything at once |

**Ranks:** most enemies come as normal, **elite** (bigger, about 3× health, better loot) and the odd **named rare** with its own name and a guaranteed Fine-or-better drop.

## Look and sound

- **Low-poly, flat-shaded.** Muted greens, slate grey, birch white, dark water, with **warm fire orange as the one strong colour**, because fire means safety. Thick fog that changes colour through the day hides the edge of the loaded world and sets the mood.
- **Models built in code** from a small kit of shapes, as Unscrew does (`models/kit.js`), with heroes and bosses sketched in Blender over MCP first (see [UNSCREW-BLENDER.md](UNSCREW-BLENDER.md)).
- **Characters** are made of rigid parts (head, body, arms, legs, weapon) animated in code: swings, steps, staggers. That fits the low-poly style and needs no animation files. If it looks too stiff in M1, fall back to glTF models with skeletal animation from Blender (shipped in the app, so still offline).
- **UI:** carved wood and iron, a strong readable font (an OFL font, self-hosted like every game's). Big touch targets.
- **Sound:** synthesised like every other game: wind, waves, a crackling fire, footsteps on grass and stone, steel on steel, the parry "ting". Music, if any, as slow synthesised drones.
- **English and Dutch**, like every game.

## How it is built

### Technology

- **three.js r186 (0.186.1) as an ES module**, vendored in `shared/vendor/three-r186/` next to r128 (the other games stay on r128, see [ARCHITECTURE.md](ARCHITECTURE.md)). No bundler needed: like Wallbreaker and Coin Dozer, the game loads plain ES modules. The npm package has no minified build any more, so the files are the plain ones (2.1 MB); minify them before Emberholm goes into release builds. Until then `npm run build` leaves the folder out.
- **No physics engine.** Walking is a character controller on a height field, with circles and boxes for trees, rocks and buildings. Fights are hit shapes (arcs and circles) checked on each step.
- **Fixed-step simulation at 60 Hz**, rendering capped at **30 fps** by default (60 as a setting). Nothing runs while paused, in a menu or in the background.
- **Rules separated from drawing**, as in Starflip and Loopline: combat, stats, survival, loot, crafting and quests run without the DOM, so Node tests can play them.

### The world on a phone

- The island is split into **chunks of 64 × 64 m**. Only the chunks around the player exist (about 5 × 5), with less detail further out. Fog hides the edge at ~150 m.
- Trees, rocks, grass and bushes are **instanced** per chunk (one draw call per kind), so a forest costs a handful of draw calls.
- **Performance budget** (checked with a dev overlay, `?debug`):

  | | Budget |
  |---|---|
  | Draw calls | ≤ 150 |
  | Triangles on screen | ≤ 250,000 |
  | Simulation + game logic per frame | ≤ 8 ms on a mid-range phone |
  | Render resolution | device pixel ratio capped at 1.5, with a quality setting |
  | Download | the game folder ≤ 3 MB |

### Folder layout

```
games/emberholm/
  index.html, style.css, strings.js, game.js   the shell: loop, screens, saving
  src/config.js         every number: combat timings, stats, XP curve, day length, budgets
  src/world/            terrain.js (height field from the seed), landmarks.js, scatter.js, chunks.js
  src/sim/              player.js, combat.js, ai.js, stats.js, survival.js, time.js (day, night, weather)
  src/items/            items.js, loot.js (drop tables), crafting.js, recipes.js
  src/quests/           quests.js (states and templates), data.js (the zone's quests)
  src/render/           scene.js, terrain mesh, models/ (kit.js + one file per kind), characters.js, fx.js
  src/ui/               hud.js, controls.js (touch, keys, gamepad), inventory.js, map.js, dialogue.js
  src/audio.js
tests/emberholm/        rules tests in Node, e2e in a phone browser in landscape
```

### Saving

- Under `emberholm.v1` in localStorage: the character, bag and stash, quest states, lit waystones, the map you've revealed, and **what changed in the world** (cleared camps, opened chests) as short lists of ids. The world itself is never saved; it comes from the seed. Expected size: well under 100 KB.
- Saves on every quest step, craft, level and fire, every 30 seconds, and when the app goes to the background.

### Tests

- **Node:** the parry window and riposte timing; damage sums; loot tables give the same drops for the same seed; crafting and upgrade costs; quest state machines from start to hand-in; the XP curve; old saves load.
- **Phone browser, landscape:** the game starts, the player walks, attacks, opens the bag and the map, saves and loads; no errors. Plus the usual hub smoke test and both languages.

## Scope

### The first playable version: The Strand

- One zone with the village, ~25 quests, levels 1–10
- Axe and shield, plus the spear
- The six enemies and the Barrow King
- Food, warmth, rest, day and night, fog and rain
- Workbench, forge, campfire and cook pot; ★1–★3 upgrades
- Map, minimap, waystones, cairns
- English and Dutch, landscape, touch + keyboard + gamepad

### Not now (maybe later)

- **Multiplayer** of any kind: the mission rules out servers and accounts.
- **Building a base.** A great Valheim feature, but a project in itself, and heavy saves. A later possibility: upgrade the village with your materials.
- **A companion dog** who walks and fights next to you: wanted, after the first zone works.
- Boats (very Nordic, a good zone-2 or zone-3 idea), mounts.
- Character creation beyond a few looks to choose from.
- More zones, weapons and the rune tree: after the first zone has been played and liked.

## Milestones

Each milestone ends with something you can play on the phone and a clear question. If the answer is no, fix it or stop before building the next.

| # | Milestone | What gets built | Done when |
|---|---|---|---|
| **M0** | **Walk** | terrain from the seed, chunks, instanced trees and rocks, the character controller, the chase camera, touch controls in landscape, day/night light and fog, the debug overlay | it holds **30 fps on your phone**, and walking around for five minutes is pleasant |
| **M1** | **Fight** | attack combos, heavy, parry/block/riposte, dodge, stamina, hit-stop and haptics; wolves and a raider; character animation in code | **parrying feels great**, also to someone who hasn't played it before |
| **M2** | **Survive** | food, warmth, rest, campfire kits, night threats, gathering, loot drops, the bag, cairns | a trip out feels like an expedition: you prepare, you come back relieved |
| **M3** | **Grow** | XP and levels, gear and bonuses, stations and recipes, upgrades, stash, village vendors, perks | you want to go out again to craft the next thing |
| **M4** | **Quest** | the village and its five characters, dialogue, the quest system, the zone's quests, map and waystones, barrows and the Barrow King | the first zone can be played from washing ashore to the beacon; on the hub as **Prototype** |
| **M5** | **Polish** | art pass (Blender for heroes and bosses), sound, balance, Story/Hard settings, playtest feedback | testers finish the zone and ask what's next; then decide on zone 2 |

## M0 as built

What the first milestone has, and where it lives. Everything in `games/emberholm/`.

| Part | What | File |
|---|---|---|
| The island | ~1.1 × 1.2 km of land in a 1.5 km square of sea: coast from slow noise, rolling hills, the Fells as a mountain wall in the north, the Blackmire bog, and the places stamped in (levelled ground, Beacon Hill raised, the three barrow mounds). Pure maths, the same on every device (only integer hashing and + − × ÷ √) | `src/world/noise.js`, `terrain.js`, `places.js` |
| Places | Wreck Beach (start), Brandvik (five longhouses round the great fire), the Old Mill, the Barrows, the Blackmire, Raven Point (raider tents), Copper Hollow, the Watchtower, Beacon Hill, five waystones. Their name shows when you walk in | `src/world/places.js`, `src/render/models.js` |
| Trees and rocks | pine, birch, rock, bush, dead tree, placed per 4 m cell from the seed; grass tufts close by. Nothing is saved: a chunk always gets the same things | `src/world/scatter.js` |
| Walking | a circle on the height field: walk or run (stick all the way), slopes slow you and too steep stops you, wading slows you, deep water stops you, trees, rocks and buildings push you out | `src/sim/player.js`, `src/world/collide.js` |
| Day and night | 14 + 10 minutes; sun and moon, fog and light colours through the day, warm at dawn and dusk; a lantern light at night; the village fire lights Brandvik | `src/sim/time.js`, `src/render/world.js` |
| Drawing | terrain chunks of 64 m at 32/16/8 quads by distance (skirts hide the seams), built 2 per frame; nature instanced, a detailed model within 75 m and a simpler one beyond; trees between camera and player fade out (dithered, in the shader) | `src/render/world.js`, `models.js` |
| The hero | rigid low-poly parts animated in code (walk, run, breathe), a round blob shadow | `src/render/hero.js` |
| Camera | high chase camera (21° down, 9.5 m back), drag to turn, swings back behind you while you walk | `src/render/camera.js` |
| Controls | floating stick on the left 45%, camera drag on the right; WASD/arrows, Shift, Q/E, M; gamepad | `src/ui/controls.js` |
| Map | the island picture is drawn a few rows per frame from the terrain; round minimap; tap it for the whole island with the names of places you've found | `src/ui/map.js` |
| Landscape | on a phone, Play asks for full screen and locks landscape where the browser allows it; in portrait a "turn your phone" screen pauses the game | `game.js`, `style.css` |
| Settings | picture quality (Low/Medium/High: pixel ratio 1/1.25/1.5, view 140/175/210 m), 30 or 60 fps, full screen, performance overlay (`?debug` too). Prototype tools: time of day, start over | `game.js` |
| Saving | `emberholm.v1`: position, facing, time and day, places found, settings. Every 10 s, on pause and when the page is hidden | `game.js` |

Measured on the test machine (software rendering, so frame rates mean nothing there): about 1 ms of JavaScript per frame, 30–40 draw calls, 50–120k triangles (forest included). The real test is your phone with "Show performance" on.

Tests: `npm run test:emberholm` (the island's fingerprints, places on dry land and level, nothing growing in the sea or in places, walking speed, deep water, trees and houses stopping you, 14 + 10 minute days) and `tests/emberholm/e2e.mjs` (stick, camera drag, keyboard, map, pause, saving, portrait).

## Risks

| Risk | What we do about it |
|---|---|
| **Too heavy for phones** | M0 is only about this, with a budget and a real phone before anything else is built |
| **Combat on glass feels mushy** | M1 is only about this; soft lock, generous parry on Story, big buttons, hit-stop and haptics |
| **Characters look stiff** without skeletal animation | try code animation in M1; fall back to glTF from Blender |
| **Not enough content** to fill a world | quest templates, enemy ranks, seeded bounties; one zone done well before any second one |
| **Scope creep** (building, multiplayer, boats) | the "Not now" list; anything new must replace something, not add to it |
| **The world generator changes under saves** | freeze it at the first release, test with a fingerprint like Graphite's |

## Open questions

- **The name.** "Emberholm" is a working title; check it like any name ([NAMING.md](NAMING.md)) before a store release.
- **M0 on a real phone:** does it hold 30 fps on Medium? Is the camera angle right? Does the stick feel good?

## Decision log

| Date | Decision |
|---|---|
| 2026-11-27 | A single-player open-world RPG for phones in landscape: quests, levels, loot, gear, crafting, with survival (food, warmth, night) as the threat of the wilds. |
| 2026-11-27 | Camera: a high chase camera you can turn. Combat built on two buttons: **Attack** when you want, **Parry** to answer an attack and earn a riposte. |
| 2026-11-27 | Mood: Nordic. First zone: The Strand. Working title: Emberholm. |
| 2026-11-27 | A day is 24 minutes: 14 of daylight, 10 of night. The death cairn stays as the sting. Healing from food, flasks later. A companion dog later. |
| 2026-11-27 | M0 built on three.js r186 (ES modules, no bundler), as an experimental game: playable in `npm run dev` and test builds, left out of release builds until it's further along. |
