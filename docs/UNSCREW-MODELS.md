# Unscrew: 3D models

Unscrew's 3D mode lives on the variety of its objects. This page is the **catalogue** (which models exist, sorted into categories, and which ones we could add) plus a **recipe** for adding one. The recipe is written so that one person, or one AI agent, can pick up a single model and finish it in one session. Background: issue [U-1](ISSUES.md#u-1-too-few-3d-models-so-the-levels-feel-the-same).

## The catalogue

Every model is a generator function in [`games/unscrew/game.js`](../games/unscrew/game.js) (`genCottage`, `genVilla`, …), registered in `GENS3D`. A generator builds a different variant every time: sizes, colours and details come from a seeded random generator, and the amount of detail grows with difficulty.

✅ = in the game. The other entries are ideas: pick one, build it, tick it here.

### 1. Houses

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Cottage | ✅ | Planked walls, gabled roof, chimney, fence, garden props |
| Villa | ✅ | Modern: two floors, flat roofs, glass balustrade, solar panels, pool with a screwed-on rim |
| Dutch canal house | | Tall and narrow, a stepped or bell gable, a hoist beam at the top, big sash windows. Good for the Dutch audience. Could stand as a row of two or three |
| Farmhouse with barn | | House plus a barn with big doors, a silo (cylinder plus cladding), hay bales (boxes) |
| Log cabin | | Walls of horizontal round logs (cylinders lying down), a stone chimney, a porch |
| Houseboat | | A hull on blue water, a cabin on deck, plant pots, a gangway |
| Beach hut on stilts | | A small hut on posts, a ladder, a striped awning |
| Treehouse | | A trunk and blob canopy holding a planked hut, a rope ladder, a slide |

### 2. Rooms

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Bedroom | ✅ | Bed, wardrobe, shelves with books, desk and chair, rug, toys |
| Kitchen | | Cabinets with doors, a stove, a fridge, a table, pans on hooks |
| Living room | | Sofa (cushions as cover plates), TV cabinet, bookcase, lamp, plant |
| Workshop | | Workbench, a tool wall with screwed-on tools, shelves with boxes |
| Classroom | | Desks and chairs in rows, a blackboard, a globe |

### 3. Animals

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Giraffe | ✅ | Spots are cover plates hiding screws; leaning neck with a mane, ossicones, an acacia tree |
| Turtle | | The shell is made of hexagonal plates, the perfect take-apart animal |
| Elephant | | Big ears as plates, a trunk of stacked cylinders, a saddle blanket |
| Dinosaur (stegosaurus) | | A row of back plates and a spiked tail |
| Owl | | A round body, feather plates in rows, big eyes, on a branch |
| Cow | | Patches like the giraffe's spots, a bell, in a little meadow with a fence |
| Penguin | | On an ice floe, with a fish |
| Crab | | A wide shell, claws and legs on both sides |

### 4. Vehicles *(empty)*

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Camper van | | Ties in with Camper Crew: a roof box, a bike rack, an awning |
| Tractor | | Big rear wheels, a cab, a trailer with hay bales |
| Fire engine | | A ladder on the roof, hose reels, lights |
| Steam train | | A locomotive (boiler cylinder, chimney, wheels) and one wagon on rails |
| Sailboat | | A hull, a mast, sails as plates, on water |
| Propeller plane | | Wings, a tail, a propeller, on a small runway |
| Helicopter | | Rotor blades, skids, a helipad |
| Hot-air balloon | | An envelope of panels (like the mill's cladding), a basket, ropes |

### 5. Machines and robots

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Robot | ✅ | Box body with cladding, arms, head with antenna |
| Robot dog | | A four-legged robot: reuses the giraffe's legs and the robot's panels |
| Arcade cabinet | | A screen, a control panel with buttons, side art panels (fits the collection) |
| Jukebox or retro radio | | Rounded top, grille, buttons |
| Excavator | | Tracks, a cab, an arm and a bucket |

### 6. Industry *(empty)*

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Factory | | Sheds with saw-tooth roofs, chimneys, pipes, a loading dock |
| Harbour crane with containers | | Stacked containers (boxes with ribbed plates) and a crane over them |
| Wind turbine | | A tall tower, a nacelle, three long blades |
| Water tower | | A tank on legs with cross braces, a ladder |
| Oil rig | | A platform on legs in the sea, a derrick, a helipad |

### 7. Landmarks and history

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Castle | ✅ | Towers with cones or battlements, walls, a gate, a keep |
| Windmill | ✅ | Brick base, gallery, tower, cap and sails |
| Lighthouse | | Striped tower, a lamp room with windows, a keeper's house, rocks |
| Pagoda | | Stacked floors with curved roofs |
| Pyramid | | Layers of stone blocks, a sphinx-like statue optional |
| Greek temple | | Columns (cylinders with cladding), steps, a pediment |
| Clock tower | | Four clock faces, a spire, a bell |

### 8. Space

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Rocket | ✅ | Clad stages, fins, boosters, a launch tower |
| Space station | | Modules (cylinders), solar panel wings, a docking port |
| Lunar lander | | Legs with pads, a gold-foil body, an antenna |
| Mars rover | | Six wheels, a deck, a mast with a camera, solar panels |
| UFO | | A saucer of panels, a dome, legs, lights |

### 9. Everyday objects and food

| Model | Status | Idea / what to unscrew |
|---|---|---|
| Layer cake | | Layers (cylinders), icing plates, candles, cherries |
| Burger | | Stacked layers, the most stackable model there is |
| Ice-cream cart | | A cart with wheels, a parasol, tubs |
| Piano | | Keys as plates, a lid, a stool |
| Cuckoo clock | | A little house with a clock face, pine-cone weights |

### What to build next

1. **Fill the empty categories first:** one vehicle and one industry model do more for variety than a third house.
2. Then a **second animal** (the turtle is the easiest win), and the **Dutch canal house**.
3. Once there are about a dozen models, make the level picker aware of categories (issue U-1, step 3): `GENS3D` gets a category per entry, and `pick3D` avoids two models of one category in a row.

## Recipe: adding a model

### 1. Learn the building blocks

Everything is in `game.js`, between `/*GEN-START*/` and `/*GEN-END*/`. Read two existing generators first: `genVilla` (boxes, cladding, windows) and `genGiraffe` (an animal from boxes and cover plates).

| Helper | What it makes |
|---|---|
| `box(w,h,d,color,pos,quat,{faces})` | A rounded box. `faces` lists the faces that get a grid of screw slots; leave a face out when something will cover it |
| `onFace(host,face,a,b,w,h,depth,color)` | A box lying on a face of another box. By default it also puts a hidden **anchor** screw under itself, so the host can only be removed after it |
| `cyl`, `cone`, `blob` | A cylinder (slots on top and around the side), a cone, a low-poly lump (bushes, rocks) |
| `plankFace`, `cladBox`, `cladCyl` | Cladding: planks over a face, over four walls (with corner posts), or around a cylinder |
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
- Slots pointing more than slightly downward, or lower than 0.1 above the ground, are skipped.
- Use only the generator `R` for randomness (never `Math.random`), so a level number always gives the same object.

### 3. Size and difficulty

- Stay within roughly 10 × 10 units of ground and about 8 high; the camera fits whatever you build, but a much bigger model makes the screws tiny on a phone.
- `cfg.cx` runs from about 0.1 (easy, level 1) to 1.6 (master, later levels). Add details step by step: `if(cx>0.3) …`, `if(cx>0.6) …`. More details means more screws and more hidden layers.
- Aim for a screw count in the range of the other models at each difficulty (see the report below). A model may be a bit lighter or heavier for variety.

### 4. Register it

1. Add `['name', genName]` at the end of `GENS3D`.
2. Add `"obj.name"` to **both** languages in `games/unscrew/strings.js` (the label in the level bar; `npm test` fails on a missing translation).

Adding a model reshuffles which model each 3D level number shows. Saves don't store the object, so nothing breaks, and the save key stays `unscrew.v2` (see the note in [ISSUES.md](ISSUES.md#u-1-too-few-3d-models-so-the-levels-feel-the-same)).

### 5. Check it

```bash
npm run unscrew:models -- name           # screws and parts kept, per difficulty
npm run unscrew:models -- name --shots   # plus screenshots in test-results/unscrew-models/
npm test                                 # everything else still works
```

Done means:

- generation never fails, and needs one seed almost always;
- **90% or more of the parts are kept** at every difficulty. If not, find out which parts are dropped and why (rules above). Hidden inner cores may be dropped without harm; visible parts may not;
- the screenshots look like the thing, from the front *and* the back, at easy and at master;
- `npm test` passes.

### 6. Write it down

- Tick the model in the catalogue above (✅ and a one-line description).
- Add a line to issue U-1 in [ISSUES.md](ISSUES.md), and to today's entry in [HISTORY.md](../HISTORY.md).

### Prompt for an AI agent

> Add the **⟨model⟩** model (category ⟨category⟩) to Unscrew. Follow the recipe in `docs/UNSCREW-MODELS.md` step by step, take screenshots with `npm run unscrew:models -- ⟨name⟩ --shots` and look at them, iterate until 90% or more of the parts are kept at every difficulty, run `npm test`, and update the catalogue, issue U-1 and HISTORY.md.

## Report at the time of writing

Output of `npm run unscrew:models` on 6 November 2026 (screws per level, lowest share of parts kept):

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

The villa's few drops are mostly wall panels behind the front door and the garage door, which only show once those are off.

The older models drop a lot of parts. Part of that is harmless (hidden cores under cladding), part of it is visible: see issue [U-2](ISSUES.md#u-2-older-models-silently-lose-parts). The giraffe is the lightest model: a short level between two long ones.
