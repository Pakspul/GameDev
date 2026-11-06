# Unscrew: 3D models

Unscrew's 3D mode lives on the variety of its objects. This page is the **catalogue** (which models exist, sorted into categories, and which ones we could add) plus a **recipe** for adding one. The recipe is written so that one person, or one AI agent, can pick up a single model and finish it in one session. Background: issue [U-1](ISSUES.md#u-1-too-few-3d-models-so-the-levels-feel-the-same).

## The catalogue

Every model is a generator function (`genCottage`, `genVilla`, …) in [`games/unscrew/models/`](../games/unscrew/models/), in the file of its category (the file name is under each heading below). A generator builds a different variant every time: sizes, colours and details come from a seeded random generator, and the amount of detail grows with difficulty.

```
games/unscrew/models/
  kit.js        the building blocks every model uses (boxes, cylinders, cladding, windows, scenery) and model()
  houses.js     one file per category; each generator ends with model('name','category',genName)
  …           (houses, rooms, animals, vehicles, machines, industry, landmarks, space, objects)
  order.js      MODEL_ORDER: the fixed order of all models in the level shuffle; it builds GENS3D for game.js
```

✅ = in the game. The other entries are ideas: pick one, build it, tick it here.

### 1. Houses (`houses.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Cottage | ✅ | Planked walls, gabled roof, chimney, fence, garden props |
| Villa | ✅ | Modern: two floors, flat roofs, glass balustrade, solar panels, pool with a screwed-on rim |
| Dutch canal house | ✅ | A row of one to three tall, narrow houses on a canal: brick courses, stepped gables, hoist beams, pairs of sash windows, a moored boat |
| Farmhouse with barn | | House plus a barn with big doors, a silo (cylinder plus cladding), hay bales (boxes) |
| Log cabin | | Walls of horizontal round logs (cylinders lying down), a stone chimney, a porch |
| Houseboat | | A hull on blue water, a cabin on deck, plant pots, a gangway |
| Beach hut on stilts | | A small hut on posts, a ladder, a striped awning |
| Treehouse | | A trunk and blob canopy holding a planked hut, a rope ladder, a slide |

### 2. Rooms (`rooms.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Bedroom | ✅ | Bed, wardrobe, shelves with books, desk and chair, rug, toys |
| Kitchen | ✅ | A run of units along the back wall, each as wide as two wall panels: base cabinets (two doors with knob plates, a counter, a cutting board and a bowl on it), a stove (an oven door with a window plate, a hob over one burner, a pan and a lid), upper units with handle plates, a hood and a fridge; a table with a runner and a centrepiece, chairs, a rug and a pan rail |
| Living room | | Sofa (cushions as cover plates), TV cabinet, bookcase, lamp, plant |
| Workshop | | Workbench, a tool wall with screwed-on tools, shelves with boxes |
| Classroom | | Desks and chairs in rows, a blackboard, a globe |

### 3. Animals (`animals.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Giraffe | ✅ | Spots are cover plates hiding screws; leaning neck with a mane, ossicones, an acacia tree |
| Turtle | ✅ | A tiered shell: rims of scutes around two cores, hexagonal plates on top that each hide a screw; flippers, a head on a neck, a pond |
| Elephant | | Big ears as plates, a trunk of stacked cylinders, a saddle blanket |
| Dinosaur (stegosaurus) | | A row of back plates and a spiked tail |
| Owl | | A round body, feather plates in rows, big eyes, on a branch |
| Cow | | Patches like the giraffe's spots, a bell, in a little meadow with a fence |
| Penguin | | On an ice floe, with a fish |
| Crab | | A wide shell, claws and legs on both sides |

### 4. Vehicles (`vehicles.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Camper van | ✅ | Ties in with Camper Crew: two-tone panels, a sliding door, a spare wheel, a roof box and rails, an awning, a camping table |
| Tractor | | Big rear wheels, a cab, a trailer with hay bales |
| Fire engine | ✅ | A cab and a rear body clad in red and white panels, window and door plates, roller shutters with handle plates over the equipment lockers, a rack plate on the roof under a two-rail ladder, a light bar with a lamp over each screw, a hose reel, bumpers, hydrants |
| Steam train | ✅ | A locomotive with a boiler lying on its side (clad above the waterline), a smokebox, chimney, domes, a cab and a tender with coal, and up to two wagons, on rails; the wheels block the frames' screws |
| Sailboat | | A hull, a mast, sails as plates, on water |
| Propeller plane | | Wings, a tail, a propeller, on a small runway |
| Helicopter | | Rotor blades, skids, a helipad |
| Hot-air balloon | | An envelope of panels (like the mill's cladding), a basket, ropes |

### 5. Machines and robots (`machines.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Robot | ✅ | Box body with cladding, arms, head with antenna |
| Robot dog | ✅ | Four legs that are stacks (paw, shin, thigh, body) with hip caps and plates over the side screws, a body with panels and vent plates, a plate that carries a battery, a chest plate with a badge, a neck under a head with a snout and a nose plate, ear panels, a visor and a sensor module, a tail with a tip, a bone and a bowl |
| Arcade cabinet | ✅ | Bands of covers up the front: a coin door with two coin plates, a bezel under a screen, a tilted control deck whose buttons and joystick each stand on a screw, a speaker plate, a marquee with a sign and stars; art plates on the sides; a stool |
| Jukebox or retro radio | | Rounded top, grille, buttons |
| Excavator | | Tracks, a cab, an arm and a bucket |

### 6. Industry (`industry.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Water tower | ✅ | Four legs with beams that cover their screws, cross braces, a ladder, a railed platform, a tank of staves with a cone roof, a pump house |
| Factory | | Sheds with saw-tooth roofs, chimneys, pipes, a loading dock |
| Harbour crane with containers | ✅ | A two-by-two block of container stacks (screws only on the top and the outer faces, ribbed plates and door plates over the outer ones) and a portal crane around it: feet, legs whose only screws hide under plates and beams, two beams, a girder with stoppers and a trolley, and a spreader sitting on the tallest stack |
| Wind turbine | ✅ | A tower of narrowing clad segments, a nacelle with a hatch plate carrying an anemometer, a hub that hides every blade's root screw, blades with stripe plates, a transformer hut |
| Oil rig | | A platform on legs in the sea, a derrick, a helipad |

### 7. Landmarks and history (`landmarks.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Castle | ✅ | Towers with cones or battlements, walls, a gate, a keep |
| Windmill | ✅ | Brick base, gallery, tower, cap and sails |
| Lighthouse | ✅ | Striped tower of narrowing segments, a door with its own window plate, a railed gallery, a glass lamp room under a cap, a keeper's house with a pyramid roof, rocks |
| Pagoda | ✅ | A stone platform with steps and corner lanterns, three to five floors of clad walls with door and window plates, roof slabs whose screws all hide under the next floor (tile plates with lanterns on the rim), a four-sided cap and a spire |
| Pyramid | | Layers of stone blocks, a sphinx-like statue optional |
| Greek temple | | Columns (cylinders with cladding), steps, a pediment |
| Clock tower | | Four clock faces, a spire, a bell |

### 8. Space (`space.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Rocket | ✅ | Clad stages, fins, boosters, a launch tower |
| Space station | | Modules (cylinders), solar panel wings, a docking port |
| Lunar lander | | Legs with pads, a gold-foil body, an antenna |
| Mars rover | ✅ | Six wheels capped over their screws, a chassis only the wheels and the body leave free, a body with a deck plate, a camera mast and head, a dish, a science box, solar plates with plates on them, an RTG and an arm with a drill |
| UFO | | A saucer of panels, a dome, legs, lights |

### 9. Everyday objects and food (`objects.js`)

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Layer cake | ✅ | Two to four tiers of clad cylinders on a board (the board's screws all sit under the first tier), fondant squares, rings of icing dollops that each hide a screw, a top plate with candles and a cherry, berries |
| Burger | 15-57, 100% | 45-66, 100% | 69-75, 100% | 72-78, 100% |
| Pagoda | 66-126, 98% | 120-138, 100% | 189, 100% | 219-240, 100% |
| Harbour crane | 51-78, 99% | 96-138, 100% | 132-156, 100% | 147-189, 100% |
| Fire engine | 60-78, 100% | 87-99, 100% | 108-114, 98% | 111-117, 100% |
| Robot dog | 30-60, 100% | 54-66, 100% | 66-69, 100% | 66-72, 100% |
| Kitchen | 78-81, 95% | 123-138, 96% | 159-162, 97% | 144-168, 97% |
| Burger | ✅ | A plate, a bun in a paper wrapper, lettuce with a ring of onion dots, patties, cheese, bacon, tomato and onion (the harder the level, the more layers), a top bun whose screws are under sesame seeds, a flag plate; fries and a cup with a lid on the side |
| Ice-cream cart | | A cart with wheels, a parasol, tubs |
| Piano | | Keys as plates, a lid, a stool |
| Cuckoo clock | | A little house with a clock face, pine-cone weights |

### What to build next

1. ~~Fill the empty categories first~~ *(done: camper van, water tower)*, ~~a second animal and the Dutch canal house~~ *(done: turtle, canal house)*, ~~a second model in the thinnest categories: space, machines, vehicles, industry, and the first everyday object~~ *(done: Mars rover, arcade cabinet, steam train, wind turbine, layer cake; plus a lighthouse)*. Then six more, spread over six categories: ~~burger, pagoda, harbour crane, fire engine, robot dog, kitchen~~ *(done)*.
2. **Make the level picker aware of categories** (issue U-1, step 3), now that there are twenty-four models: each `GENS3D` entry already carries its category (`[name, generator, category]`), so `pick3D` can avoid two models of one category in a row. This reshuffles the levels once, like adding a model.
3. Then more depth in the older models (issue [U-2](ISSUES.md#u-2-older-models-silently-lose-parts)), and the next ideas: a living room, a workshop, a tractor, an excavator, a space station, a Greek temple, a clock tower.

## Recipe: adding a model

### 1. Learn the building blocks

The building blocks are in [`models/kit.js`](../games/unscrew/models/kit.js). Read two or three existing generators first: `genVilla` or `genCanalHouse` in `houses.js` (boxes, cladding, windows), `genGiraffe` or `genTurtle` in `animals.js` (an animal from boxes, cylinders and cover plates), and `genCamper` in `vehicles.js` (windows and lights placed on the screw grid of the panels).

| Helper | What it makes |
|---|---|
| `box(w,h,d,color,pos,quat,{faces})` | A rounded box. `faces` lists the faces that get a grid of screw slots; leave a face out when something will cover it |
| `onFace(host,face,a,b,w,h,depth,color)` | A box lying on a face of another box. By default it also puts a hidden **anchor** screw under itself, so the host can only be removed after it |
| `cyl`, `cone`, `blob` | A cylinder (slots on top and around the side), a cone, a low-poly lump (bushes, rocks). A `cyl` lying on its side has side slots that point down: leave those planks out with `keep` (below) |
| `plankFace`, `cladBox`, `cladCyl` | Cladding: planks over a face, over four walls (with corner posts), or around a cylinder. `cladCyl` takes `keep:(angle,k)=>bool` to skip planks (the steam train's boiler skips the ones under it); `plankFace` takes `ext` to run planks past the corner |
| `win(host,face,a,b,w,h,gap,pal)` | A window with a frame and glass; options for shutters and a flower box |
| `deck`, `pad`, static `box` | The ground the model stands on. Static parts never get screws |
| `fenceLine`, `props` | A fence between two points; crates, barrels, trees and bushes on given spots |
| `decor(part,mesh)` | A purely visual mesh attached to a part (eyes, handles, water). It has no screws and doesn't block anything |

### 2. Know the rules of the screws

`finalize()` turns the slots into screws and makes sure the level can be solved. Parts that end up with **no screw are silently dropped**, which shows up as a hole in the model. These rules came out of building the villa and the giraffe:

- **A screw is blocked** while the line straight out of its head hits another part. Removing the blocking part frees it.
- **Two parts must never block each other** (A's screw points at B, B's screw points at A). `finalize()` breaks such a deadlock by deleting screws at random, and often a whole part goes with them. Make outer parts (fences, railings, trees) face their screws *away* from the model, and keep big props out of the line of the model's screws.
- **A cover plate must be at least 0.14 thick** to hide the screw under it (the check sits at 0.125 above the surface). It must also extend at least **0.15 beyond the screw in every direction**, so line plates up with the screw grid of the face beneath (`axisOffs` gives the positions).
- **Screws on one face stay 0.52 apart.** Planks or plates stacked closer than that crowd each other out, and some end up without a screw. Keep plank spacing ≥ 0.53 (the villa uses `w:0.6`).
- **Each screw needs a footprint of 0.15 around it** that is all air or all one cover part. A slot too close to the ground, an edge or a neighbouring part is rejected.
- **A part on top of panels either covers a panel screw completely or stays 0.15 clear of it.** Something that half-covers a screw (a window frame reaching 0.005 into the footprint is enough) kills that screw, and a panel that loses all its screws is dropped. So centre windows, doors and lights on the panel's screw positions (`axisOffs` of the panel length; the camper does this), or keep them in the free middle (the canal house's fronts are under 2.4 wide, so their brick courses have screws only near the ends).
- **Parts that touch block each other's screws.** Anything within 0.13 in front of a screw rejects it. A head pressed against a shell plate, or a bumper right under the lowest panel screw, costs that plate or panel its screws. Leave a gap and bridge it with decoration (the turtle's neck).
- **Screws that point different ways must stay 0.42 apart**, even on different parts: a screw on top of a part next to the side screws of the part beside it crowds them out (the turtle's tail, the ring of screws that used to sit on its rim).
- **Corner posts crowd narrow walls.** A wall under 2.4 long gets two screw columns, each exactly 0.41 from a corner post's screw, so if both posts keep theirs the wall's panels lose everything. Make walls without posts: run the side panels past the corner with `plankFace(core,f,{ext:2*PT})` and cover the end wall between them (the steam train's cab, tender and wagons, the lighthouse's house, the wind turbine's nacelle). `cladBox` is fine for walls of 2.4 and more, which keep a middle column.
- **Panel rows must be at least 0.52 high** (`w:0.62` is a safe value): at 0.46 the rows of a wall crowd each other out.
- **Keep wheels and other neighbours 0.14 away from panels.** The steam train's wheels first sat 0.82 from the centre line, inside the cab's planks; moving them to 1.2 gave back every plank. Also keep a taller frame (0.5) under planks that overhang it: the screws on a thin frame's side sit against the planks' undersides.
- **A cover's own screws must not crowd the screw it hides.** A part that is held by one hidden anchor (the rover's mast, hidden under its camera head) is dropped when the head's own front screw lies within 0.42 of that anchor, and the head then floats. Give such covers only a top screw.
- **Parts that overlap each other** (railing rails meeting at a post) put a screw near the end inside the neighbour. Give such parts one screw in the middle: `faceSlot(part, face, 0, 0)` on a box made with `faces:[]`.
- **A cover's own screw needs 0.42 of free space towards screws pointing another way.** The pagoda's tile plates on a roof rim were dropped until they moved 0.55 out from the next floor, whose panel and window screws sat 0.3 away. Check the screws of the part *above and beside* a plate too, not only those under it.
- **Two top screws on one part 0.4 apart cost you one of them.** The kitchen's hob had a slot at each burner and kept only one, so one burner had no screw and was dropped: give such a part one slot of its own (`faces:[]` plus `faceSlot`) and make the rest decoration.
- **Anything that floats just above a part's top screw blocks it.** A plant of low-poly blobs 0.15 over a vase took the vase's screw and made both parts block each other: make leaves decoration (`decor`).
- Scenery that belongs to the ground (a stoop, a pond, water, a boat at the back) can be decoration on the ground part (`decor(ground, mesh)`, or `decor(BLD.parts[0], mesh)` with `pad`): it stays when the level is done and never gets in the way.
- Slots pointing more than slightly downward, or lower than 0.1 above the ground, are skipped.
- Use only the generator `R` for randomness (never `Math.random`), so a level number always gives the same object.

### 3. Size and difficulty

- Stay within roughly 10 × 10 units of ground and about 8 high; the camera fits whatever you build, but a much bigger model makes the screws tiny on a phone.
- `cfg.cx` runs from about 0.1 (easy, level 1) to 1.6 (master, later levels). Add details step by step: `if(cx>0.3) …`, `if(cx>0.6) …`. More details means more screws and more hidden layers.
- Aim for a screw count in the range of the other models at each difficulty (see the report below). A model may be a bit lighter or heavier for variety.

### Depth: make it a puzzle, not a pile

A model is a puzzle when the order in which you take it apart is not obvious. These are the ways the newer models build that in; use at least two or three per model, and let `cx` switch them on one by one so that easy stays shallow:

- **Chains of covers.** A plate hides the screw of the part under it, and has screws of its own that a smaller plate hides again: the lighthouse's door, with a window plate on it, on a panel, on the core (four deep); the wind turbine's hatch plate carrying an anemometer; the arcade's sign plate with a star over each of its screws. `onFace` already puts the hidden anchor under the cover.
- **Layers that sit on each other's screws.** The cake board's screws all lie under the first tier, the tier's top screws under the next tier, the top tier's under a cap, the cap's under the candles: a long chain with one possible order. The rover's chassis lies under the body, which lies under the deck plate, which lies under the mast plate, the mast and the camera head.
- **Parts that block a neighbour's screws.** The steam train's wheels in front of the frames, the rover's wheels in front of the chassis, the tender in front of the cab's rear wall: a part has to come off before the one behind it, without the two ever pointing at each other.
- **One cover for many screws.** The wind turbine's hub hides the root screw of all three blades; the arcade's screen hides all six screws of its bezel; the rover's body hides nine chassis screws. Taking the cover off frees a whole group at once.
- **A part whose only screws are hidden.** Make a part with `faces:[]` and give it slots yourself (`faceSlot`) under the part that sits on it, or let `onFace` add the anchors: the harbour crane's legs, beams and girder, the pagoda's roof slabs and the robot dog's leg segments can only come off after what stands on them. This is what turns a pile into a chain.
- **Rows that come off from the top.** The container stacks have screws only on their top and their outer faces, and plates over the outer ones, so every stack comes apart top-down, and which stack to start with is the choice. A cap, a plate or a seed over each screw (the burger's sesame seeds and onion dots, the pagoda's tile plates and lanterns, the kitchen's pan and its lid) adds one more layer on top of such a chain.
- **Things on a wall line up with its panels.** The kitchen's units are as wide as two wall panels and start on a panel edge, so each one covers whole panels' screws and never half of one.
- **Hidden screws are what the solver prefers on harder levels** (`hidPref` in `cfgFor`), so every slot you hide under a cover makes the harder levels deeper.

### 4. Register it

1. Write `genName` in the file of its category, `games/unscrew/models/<category>.js`, and register it right below: `model('name','<category>',genName);`. The category is the file name without `.js`.
2. A new category gets a new file (copy the three header lines of an existing one), plus a `<script src="models/<category>.js">` in `games/unscrew/index.html`, between `models/kit.js` and `models/order.js`.
3. Add `'name'` at the **end** of `MODEL_ORDER` in `models/order.js`. Never reorder or remove names there: the position of each model decides which model each 3D level number shows.
4. Add `"obj.name"` to **both** languages in `games/unscrew/strings.js` (the label in the level bar).

`node tests/unscrew.mjs` (part of `npm test`) checks all four steps: a file that isn't loaded, a model missing from `MODEL_ORDER` or registered twice, a wrong category, a reordered list, a missing name. The game itself also refuses to start when a registered model is missing from `MODEL_ORDER`.

Adding a model reshuffles which model each 3D level number shows. Saves don't store the object, so nothing breaks, and the save key stays `unscrew.v2` (see the note in [ISSUES.md](ISSUES.md#u-1-too-few-3d-models-so-the-levels-feel-the-same)).

### 5. Check it

While building, keep the **model inspector** open: run `npm run dev` and open `http://localhost:8080/games/unscrew/index.html?models` (or `?models=giraffe` to start on one model). It shows one model at a time, at any difficulty, level and variant (variant 0 is exactly what that level shows in a run), and refreshing the page keeps your choice, so edit, refresh and look. It shows:

- **Dropped parts** as red ghosts: the parts `finalize()` gave no screw. Tap one for its shape, size and position.
- **Unused slots** as grey stubs, and **anchors lost** in red: slots that didn't become a screw (an anchor is the hidden slot under a cover that should hold it).
- **X-ray** for the screws hidden under covers, and an **Explode** slider to pull the parts apart.
- **Tap a part** to see what holds it: in red the parts that must come off first, in blue the parts whose screws it blocks.
- **Step** and **Take apart** remove the screws in the order `finalize()` proved solvable, so you see the model come apart layer by layer.
- **Play this level** plays that model for real. Nothing is saved while the inspector is open.

The inspector lives in `games/unscrew/dev/` and is development-only: `npm run build` removes that folder and the `// <debug>` block in `game.js` that loads it, and fails if it can't.

```bash
npm run unscrew:models -- name           # screws and parts kept, per difficulty
npm run unscrew:models -- name --drops   # plus every dropped part: shape, size, position
npm run unscrew:models -- name --shots   # plus screenshots in test-results/unscrew-models/
npm test                                 # everything else still works
```

Done means:

- generation never fails, and needs one seed almost always;
- **90% or more of the parts are kept** at every difficulty. If not, find out which parts are dropped (`--drops`) and why (rules above). Hidden inner cores may be dropped without harm; visible parts may not;
- the screenshots look like the thing, from the front *and* the back, at easy and at master;
- `npm test` passes.

### 6. Write it down

- Tick the model in the catalogue above (✅ and a one-line description).
- Add a line to issue U-1 in [ISSUES.md](ISSUES.md), and to today's entry in [HISTORY.md](../HISTORY.md).

### Prompt for an AI agent

> Add the **⟨model⟩** model (category ⟨category⟩, file `games/unscrew/models/⟨category⟩.js`) to Unscrew. Follow the recipe in `docs/UNSCREW-MODELS.md` step by step, take screenshots with `npm run unscrew:models -- ⟨name⟩ --shots` and look at them, iterate with `--drops` until 90% or more of the parts are kept at every difficulty, run `npm test`, and update the catalogue, issue U-1 and HISTORY.md.

## Report at the time of writing

Output of `npm run unscrew:models` on 6 November 2026, after the lighthouse, Mars rover, steam train, wind turbine, arcade cabinet, layer cake, burger, pagoda, harbour crane, fire engine, robot dog and kitchen were added (screws per level, lowest share of parts kept):

| Model | Easy | Normal | Hard | Master |
|---|---|---|---|---|
| Cottage | 78–120, 72% | 129–138, 68% | 159–189, 68% | 195–216, 68% |
| Bedroom | 75–78, 81% | 114–126, 70% | 129–147, 74% | 126–150, 71% |
| Windmill | 72–78, 89% | 120–126, 95% | 141–144, 95% | 150–159, 96% |
| Castle | 60–141, 73% | 111–126, 67% | 126–141, 55% | 165–183, 59% |
| Rocket | 51–75, 77% | 63–120, 80% | 111–141, 80% | 129–150, 81% |
| Robot | 60–69, 69% | 69–78, 68% | 87, 69% | 84–96, 69% |
| Villa | 78–84, 94% | 129–138, 94% | 156–180, 89% | 162–180, 92% |
| Giraffe | 33–63, 100% | 48–66, 100% | 63–72, 100% | 66–72, 100% |
| Camper van | 48–66, 98% | 66–75, 98% | 81–87, 100% | 84–90, 98% |
| Water tower | 48–78, 100% | 84–102, 100% | 111–114, 100% | 117–126, 100% |
| Turtle | 39–51, 100% | 45–54, 100% | 54–60, 100% | 57–60, 100% |
| Canal house | 30–105, 98% | 117–138, 100% | 189, 100% | 216–231, 100% |
| Lighthouse | 69–84, 100% | 126–138, 100% | 147–168, 100% | 171–177, 100% |
| Mars rover | 24–54, 100% | 39–60, 100% | 57–63, 100% | 60–63, 100% |
| Steam train | 69–84, 97% | 84–138, 100% | 135–171, 100% | 174–183, 100% |
| Wind turbine | 75–78, 100% | 87–114, 98% | 129–132, 100% | 129–138, 98% |
| Arcade cabinet | 39–60, 92% | 54–63, 94% | 66–72, 95% | 69–75, 95% |
| Layer cake | 45–102, 97% | 90–135, 98% | 105–147, 98% | 135–147, 97% |

The villa's few drops are mostly wall panels behind the front door and the garage door, which only show once those are off.

The older models drop a lot of parts. Part of that is harmless (hidden cores under cladding), part of it is visible: see issue [U-2](ISSUES.md#u-2-older-models-silently-lose-parts). The giraffe, the turtle and the Mars rover are the lightest models: short levels between long ones. The steam train and the lighthouse are the heaviest of the new ones, and their screw counts grow the most with difficulty (the train gets a second wagon from `cx` 1.1, the lighthouse a fourth tower segment from 0.9). The canal house grows from one house (easy, level 1) to a row of three; at hard it always reaches the screw cap of that difficulty (190), like the cottage sometimes does.

The six newest models all keep 95% or more of their parts. The kitchen's few drops are floor planks and a wall panel hidden under the wall and the units. The pagoda reaches the screw cap of its difficulty (190 at hard, 240 at master) once it has four or five floors. The burger is the lightest of them (15 screws on level 1); the pagoda and the kitchen are the heaviest.
